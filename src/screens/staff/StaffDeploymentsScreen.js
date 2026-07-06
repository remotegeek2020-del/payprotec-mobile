import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS } from '../../config';
import { staffRequest } from '../../staff-api';

const STATUS_FILTERS = [
  { label: 'All',        value: '' },
  { label: 'Open',       value: 'Open' },
  { label: 'In Transit', value: 'In Transit' },
  { label: 'Closed',     value: 'Closed' },
];

const RETURN_REASONS = ['Merchant Cancellation', 'Equipment Type Swap', 'Technical Issue Swap', 'Other'];

const STATUS_COLORS = {
  open:         { bg: '#dbeafe', text: '#1d4ed8' },
  'in transit': { bg: '#fef3c7', text: '#d97706' },
  closed:       { bg: '#d1fae5', text: '#059669' },
};

function statusColor(s) {
  return STATUS_COLORS[(s || '').toLowerCase()] || STATUS_COLORS.open;
}

function formatDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// ── Deployment card ────────────────────────────────────────────────────────────
function DeploymentCard({ item, onOpen }) {
  const sc = statusColor(item.status);
  const items = item.items || [];
  const serials = items.map(i => i.serial_number).filter(Boolean);
  return (
    <TouchableOpacity style={s.card} onPress={() => onOpen(item)} activeOpacity={0.75}>
      <View style={s.cardTop}>
        <Text style={s.cardTitle} numberOfLines={1}>{item.merchants?.dba_name || '—'}</Text>
        <View style={[s.badge, { backgroundColor: sc.bg }]}>
          <Text style={[s.badgeText, { color: sc.text }]}>{(item.status || 'Open').toUpperCase()}</Text>
        </View>
      </View>
      <Text style={s.serial} numberOfLines={1}>
        {item.is_bulk ? `📦 Bulk · ${items.length} unit${items.length !== 1 ? 's' : ''}` : `🔢 ${serials[0] || '—'}`}
      </Text>
      <View style={s.cardBottom}>
        <Text style={s.meta}>{items[0]?.terminal_type || (item.is_bulk ? 'Multiple' : '—')}</Text>
        {item.purchase_type ? <Text style={s.meta}>{item.purchase_type}</Text> : null}
        <Text style={s.date}>{formatDate(item.target_deployment_date) || formatDate(item.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Detail modal ───────────────────────────────────────────────────────────────
function DetailModal({ dep, onClose, onChanged }) {
  const [rma, setRma]               = useState(null);   // open return record or null
  const [rmaLoading, setRmaLoading] = useState(false);
  const [working, setWorking]       = useState(false);
  // Log Return form
  const [showLogReturn, setShowLogReturn] = useState(false);
  const [reason, setReason]               = useState('');
  const [otherReason, setOtherReason]     = useState('');
  const [retNotes, setRetNotes]           = useState('');
  const [retDate, setRetDate]             = useState(todayISO());
  // Complete RMA form
  const [showComplete, setShowComplete]   = useState(false);
  const [destination, setDestination]     = useState('Warsaw Office');
  const [receivedDate, setReceivedDate]   = useState(todayISO());
  // Return to Office (initiate transit) form
  const [showRTO, setShowRTO]             = useState(false);
  const [rtoNotes, setRtoNotes]           = useState('');
  const [rtoDate, setRtoDate]             = useState(todayISO());
  const [selectedIds, setSelectedIds]     = useState([]);

  useEffect(() => {
    setRma(null);
    setShowLogReturn(false); setShowComplete(false); setShowRTO(false);
    setReason(''); setOtherReason(''); setRetNotes(''); setRetDate(todayISO());
    setDestination('Warsaw Office'); setReceivedDate(todayISO());
    setRtoNotes(''); setRtoDate(todayISO());
    setSelectedIds((dep?.items || []).map(i => i.equipment_id));
    if (!dep?.id) return;
    setRmaLoading(true);
    staffRequest('/api/deployments', { action: 'check_rma', payload: { deployment_id: dep.id } })
      .then(res => { if (res.success) setRma(res.data || null); })
      .catch(() => {})
      .finally(() => setRmaLoading(false));
  }, [dep?.id]);

  if (!dep) return null;

  const sc = statusColor(dep.status);
  const items = dep.items || [];
  const equipmentId = dep.equipment_id || items[0]?.equipment_id || null;

  function toggleSelected(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function runMutation(body, successMsg) {
    setWorking(true);
    try {
      const res = await staffRequest('/api/deployments', body);
      if (res.success) {
        Alert.alert('Success', successMsg);
        onChanged();
        onClose();
      } else {
        Alert.alert('Error', res.message || res.error || 'Operation failed.');
      }
    } catch (e) {
      if (!e?.sessionExpired) Alert.alert('Error', 'Operation failed.');
    }
    setWorking(false);
  }

  function submitLogReturn() {
    const finalReason = reason === 'Other' ? (otherReason.trim() || 'Other') : reason;
    if (!finalReason) { Alert.alert('Required', 'Select a return reason.'); return; }
    if (!retDate.trim()) { Alert.alert('Required', 'Enter the return initiation date (YYYY-MM-DD).'); return; }
    Alert.alert(
      'Log Return',
      `File a return for this deployment?\nReason: ${finalReason}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Return', style: 'destructive',
          onPress: () => runMutation({
            action: 'log_return',
            payload: {
              equipment_id: equipmentId,
              merchant_id: dep.merchant_id,
              deployment_id: dep.id,
              reason: finalReason,
              notes: retNotes.trim() || null,
              return_date_initiated: retDate.trim(),
            },
          }, 'Return logged.'),
        },
      ]
    );
  }

  function submitReturnToOffice() {
    if (!rtoDate.trim()) { Alert.alert('Required', 'Enter the initiation date (YYYY-MM-DD).'); return; }
    if (dep.is_bulk && selectedIds.length === 0) { Alert.alert('Required', 'Select at least one unit to return.'); return; }
    const count = dep.is_bulk ? selectedIds.length : 1;
    Alert.alert(
      'Return to Office',
      `Mark ${count} unit${count !== 1 ? 's' : ''} In Transit back to the office?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm', style: 'destructive',
          onPress: () => runMutation({
            action: 'return_to_office',
            payload: {
              equipment_id: dep.is_bulk ? null : equipmentId,
              merchant_id: dep.merchant_id,
              deployment_id: dep.id,
              return_type: 'In Transit',
              return_date_initiated: rtoDate.trim(),
              notes: rtoNotes.trim() || null,
              selected_equipment_ids: dep.is_bulk ? selectedIds : undefined,
            },
          }, 'Unit(s) marked In Transit.'),
        },
      ]
    );
  }

  function submitCompleteRMA() {
    if (!rma?.id) return;
    if (!receivedDate.trim()) { Alert.alert('Required', 'Enter the date received (YYYY-MM-DD).'); return; }
    Alert.alert(
      'Complete RMA',
      `Close ${rma.return_id || 'this RMA'} and receive the unit at ${destination}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete', style: 'destructive',
          onPress: () => runMutation({
            action: 'complete_rma',
            payload: {
              return_id: rma.id,
              equipment_id: equipmentId,
              destination,
              equipment_received_date: receivedDate.trim(),
            },
          }, 'RMA completed and unit received.'),
        },
      ]
    );
  }

  const detailRows = [
    ['Deployment ID', dep.deployment_id],
    ['Merchant',      dep.merchants?.dba_name],
    ['MID',           dep.merchants?.merchant_id],
    ['Status',        dep.status],
    ['Purchase Type', dep.purchase_type],
    ['TID',           dep.tid],
    ['Tracking',      dep.tracking_id],
    ['Target Date',   formatDate(dep.target_deployment_date)],
    ['Received by Merchant', formatDate(dep.merchant_received_date)],
    ['Created',       formatDate(dep.created_at)],
    ['Created By',    dep.created_by_name],
    ['Updated By',    dep.updated_by_name],
    ['Notes',         dep.notes],
  ].filter(([, v]) => v);

  const isClosed = (dep.status || '').toLowerCase() === 'closed';

  return (
    <Modal visible={!!dep} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle} numberOfLines={2}>{dep.merchants?.dba_name || dep.deployment_id || 'Deployment'}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <View style={[s.badge, { backgroundColor: sc.bg }]}>
                  <Text style={[s.badgeText, { color: sc.text }]}>{(dep.status || 'Open').toUpperCase()}</Text>
                </View>
                {dep.is_bulk ? (
                  <View style={[s.badge, { backgroundColor: '#ede9fe' }]}>
                    <Text style={[s.badgeText, { color: '#6d28d9' }]}>BULK</Text>
                  </View>
                ) : null}
              </View>

              {detailRows.map(([label, value]) => (
                <View key={label} style={s.detailRow}>
                  <Text style={s.detailLabel}>{label}</Text>
                  <Text style={s.detailValue}>{String(value)}</Text>
                </View>
              ))}

              <Text style={s.fieldLabel}>Equipment ({items.length})</Text>
              {items.length === 0 ? <Text style={s.emptySmall}>No equipment linked</Text> : items.map((it, i) => (
                <View key={it.equipment_id || i} style={s.itemRow}>
                  <Text style={s.itemSerial}>🔢 {it.serial_number || '—'}</Text>
                  <Text style={s.itemMeta}>{it.terminal_type || ''}{it.tid ? ` · TID ${it.tid}` : ''}{it.status ? ` · ${it.status}` : ''}</Text>
                </View>
              ))}

              {/* RMA status */}
              <Text style={s.fieldLabel}>RMA</Text>
              {rmaLoading ? (
                <ActivityIndicator color={COLORS.primary} style={{ margin: 8 }} />
              ) : rma ? (
                <View style={s.rmaBox}>
                  <Text style={s.rmaText}>📋 {rma.return_id || 'RMA'} — {rma.status}{rma.return_reason ? ` · ${rma.return_reason}` : ''}</Text>
                </View>
              ) : (
                <Text style={s.emptySmall}>No open RMA on this deployment</Text>
              )}

              {/* Actions */}
              {!isClosed && !rma ? (
                <View>
                  <TouchableOpacity style={s.actionBtn} onPress={() => { setShowLogReturn(v => !v); setShowRTO(false); }}>
                    <Text style={s.actionBtnText}>↩️  Log Return</Text>
                  </TouchableOpacity>
                  {showLogReturn ? (
                    <View style={s.formBox}>
                      <Text style={s.fieldLabel}>Return Reason *</Text>
                      <View style={s.chipRow}>
                        {RETURN_REASONS.map(r => (
                          <TouchableOpacity key={r} style={[s.chip, reason === r && s.chipActive]} onPress={() => setReason(r)}>
                            <Text style={[s.chipText, reason === r && s.chipTextActive]}>{r}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {reason === 'Other' ? (
                        <TextInput style={s.input} placeholder="Please specify reason…" placeholderTextColor={COLORS.light} value={otherReason} onChangeText={setOtherReason} />
                      ) : null}
                      <Text style={s.fieldLabel}>Initiation Date (YYYY-MM-DD)</Text>
                      <TextInput style={s.input} value={retDate} onChangeText={setRetDate} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.light} />
                      <Text style={s.fieldLabel}>Notes</Text>
                      <TextInput style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]} multiline value={retNotes} onChangeText={setRetNotes} placeholder="Optional notes…" placeholderTextColor={COLORS.light} />
                      <TouchableOpacity style={[s.dangerBtn, working && { opacity: 0.6 }]} onPress={submitLogReturn} disabled={working}>
                        {working ? <ActivityIndicator color="#fff" /> : <Text style={s.dangerBtnText}>Log Return (Open RMA)</Text>}
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  <TouchableOpacity style={s.actionBtn} onPress={() => { setShowRTO(v => !v); setShowLogReturn(false); }}>
                    <Text style={s.actionBtnText}>🏢  Return to Office (In Transit)</Text>
                  </TouchableOpacity>
                  {showRTO ? (
                    <View style={s.formBox}>
                      {dep.is_bulk ? (
                        <View>
                          <Text style={s.fieldLabel}>Select Units to Return</Text>
                          {items.map((it, i) => {
                            const on = selectedIds.includes(it.equipment_id);
                            return (
                              <TouchableOpacity key={it.equipment_id || i} style={[s.selectRow, on && s.selectRowActive]} onPress={() => toggleSelected(it.equipment_id)}>
                                <Text style={s.selectCheck}>{on ? '☑️' : '⬜'}</Text>
                                <View style={{ flex: 1 }}>
                                  <Text style={s.itemSerial}>{it.serial_number || '—'}</Text>
                                  <Text style={s.itemMeta}>{it.terminal_type || ''}{it.tid ? ` · TID ${it.tid}` : ''}</Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ) : null}
                      <Text style={s.fieldLabel}>Initiation Date (YYYY-MM-DD)</Text>
                      <TextInput style={s.input} value={rtoDate} onChangeText={setRtoDate} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.light} />
                      <Text style={s.fieldLabel}>Reason / Notes</Text>
                      <TextInput style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]} multiline value={rtoNotes} onChangeText={setRtoNotes} placeholder="Reason for return…" placeholderTextColor={COLORS.light} />
                      <TouchableOpacity style={[s.dangerBtn, working && { opacity: 0.6 }]} onPress={submitReturnToOffice} disabled={working}>
                        {working ? <ActivityIndicator color="#fff" /> : <Text style={s.dangerBtnText}>Mark In Transit</Text>}
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {rma && rma.status === 'Open' ? (
                <View>
                  <TouchableOpacity style={s.actionBtn} onPress={() => setShowComplete(v => !v)}>
                    <Text style={s.actionBtnText}>✅  Complete RMA</Text>
                  </TouchableOpacity>
                  {showComplete ? (
                    <View style={s.formBox}>
                      <Text style={s.fieldLabel}>Destination</Text>
                      <View style={s.chipRow}>
                        {['Warsaw Office', 'Warsaw Repairs'].map(d => (
                          <TouchableOpacity key={d} style={[s.chip, destination === d && s.chipActive]} onPress={() => setDestination(d)}>
                            <Text style={[s.chipText, destination === d && s.chipTextActive]}>{d}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Text style={s.fieldLabel}>Date Received (YYYY-MM-DD)</Text>
                      <TextInput style={s.input} value={receivedDate} onChangeText={setReceivedDate} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.light} />
                      <TouchableOpacity style={[s.primaryBtn, working && { opacity: 0.6 }]} onPress={submitCompleteRMA} disabled={working}>
                        {working ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Complete RMA</Text>}
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export default function StaffDeploymentsScreen({ navigation, route }) {
  const [deployments, setDeployments] = useState([]);
  const [metrics, setMetrics]         = useState(null);
  const [loading, setLoading]         = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [selected, setSelected]       = useState(null);
  const [query, setQuery]             = useState(route?.params?.serial || '');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);

  const load = useCallback(async (pageNum = 1, q = query, sf = statusFilter, append = false) => {
    setLoading(true);
    try {
      const res = await staffRequest('/api/deployments', {
        action: 'list',
        query: q.trim() || undefined,
        page: pageNum,
        limit: 20,
        statusFilter: sf || undefined,
      });
      if (res.success) {
        setDeployments(prev => append ? [...prev, ...(res.data || [])] : (res.data || []));
        setMetrics(res.metrics || null);
        setPage(pageNum);
        setTotalPages(res.pagination?.totalPages || 1);
      }
    } catch (e) { /* session expired — fail quietly */ }
    setLoading(false);
    setRefreshing(false);
  }, [query, statusFilter]);

  useEffect(() => { load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Serial handed in from the scanner → pre-filter the list to that unit.
  useEffect(() => {
    if (route?.params?.serial) setQuery(route.params.serial);
  }, [route?.params?.serial]);

  useEffect(() => {
    const t = setTimeout(() => load(1, query, statusFilter, false), 400);
    return () => clearTimeout(t);
  }, [query, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  function loadMore() {
    if (!loading && page < totalPages) load(page + 1, query, statusFilter, true);
  }

  return (
    <View style={s.root}>
      <View style={s.searchBar}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Search merchant, serial, TID, tracking…"
          placeholderTextColor={COLORS.light}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <View style={s.filterRow}>
        {STATUS_FILTERS.map(f => {
          const active = statusFilter === f.value;
          return (
            <TouchableOpacity key={f.label} style={[s.chip, active && s.chipActive]} onPress={() => setStatusFilter(f.value)}>
              <Text style={[s.chipText, active && s.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {metrics ? (
        <View style={s.metricsRow}>
          <View style={s.metricBox}><Text style={s.metricValue}>{metrics.active}</Text><Text style={s.metricLabel}>Active</Text></View>
          <View style={s.metricBox}><Text style={s.metricValue}>{metrics.today}</Text><Text style={s.metricLabel}>Today</Text></View>
          <View style={s.metricBox}><Text style={s.metricValue}>{metrics.total}</Text><Text style={s.metricLabel}>Total</Text></View>
        </View>
      ) : null}

      <FlatList
        data={deployments}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => <DeploymentCard item={item} onOpen={setSelected} />}
        contentContainerStyle={s.list}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(1); }} tintColor={COLORS.primary} />}
        ListFooterComponent={loading && !refreshing ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> : null}
        ListEmptyComponent={!loading ? <Text style={s.empty}>No deployments found</Text> : null}
      />

      <DetailModal dep={selected} onClose={() => setSelected(null)} onChanged={() => load(1)} />
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: COLORS.bg },
  searchBar:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, margin: 12, marginBottom: 8, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border },
  searchIcon:    { fontSize: 16, marginRight: 6 },
  searchInput:   { flex: 1, paddingVertical: 11, fontSize: 15, color: COLORS.text },
  filterRow:     { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginBottom: 8, flexWrap: 'wrap' },
  metricsRow:    { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginBottom: 8 },
  metricBox:     { flex: 1, backgroundColor: COLORS.card, borderRadius: 12, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  metricValue:   { fontSize: 16, fontWeight: '900', color: COLORS.primary },
  metricLabel:   { fontSize: 10, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase' },
  list:          { paddingHorizontal: 12, paddingBottom: 30 },
  card:          { backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  cardTitle:     { flex: 1, fontSize: 15, fontWeight: '800', color: COLORS.text },
  badge:         { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:     { fontSize: 10, fontWeight: '800' },
  serial:        { fontSize: 12, color: COLORS.primary, fontWeight: '700', fontFamily: 'monospace', marginBottom: 6 },
  cardBottom:    { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  meta:          { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
  date:          { fontSize: 11, color: COLORS.light, marginLeft: 'auto' },
  empty:         { textAlign: 'center', color: COLORS.muted, padding: 40, fontSize: 14 },
  emptySmall:    { color: COLORS.muted, fontSize: 12, marginBottom: 8 },
  // Modal
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard:     { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '88%' },
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  modalTitle:    { flex: 1, fontSize: 17, fontWeight: '900', color: COLORS.text },
  modalClose:    { fontSize: 18, color: COLORS.muted, fontWeight: '700' },
  detailRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12 },
  detailLabel:   { fontSize: 13, color: COLORS.muted, fontWeight: '600' },
  detailValue:   { fontSize: 13, color: COLORS.text, fontWeight: '700', maxWidth: '60%', textAlign: 'right' },
  fieldLabel:    { fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
  itemRow:       { backgroundColor: COLORS.bg, borderRadius: 10, padding: 10, marginBottom: 6 },
  itemSerial:    { fontSize: 13, fontWeight: '800', color: COLORS.primary, fontFamily: 'monospace' },
  itemMeta:      { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  rmaBox:        { backgroundColor: '#fff1f2', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#fecdd3' },
  rmaText:       { fontSize: 13, fontWeight: '700', color: '#be123c' },
  actionBtn:     { backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  actionBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  formBox:       { backgroundColor: COLORS.bg, borderRadius: 12, padding: 12, marginTop: 8 },
  chipRow:       { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:          { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#fff' },
  chipActive:    { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:      { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  chipTextActive:{ color: '#fff' },
  input:         { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, marginBottom: 4, backgroundColor: '#fff' },
  selectRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 10, marginBottom: 6 },
  selectRowActive: { borderColor: COLORS.primary },
  selectCheck:   { fontSize: 16 },
  primaryBtn:    { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  primaryBtnText:{ color: '#fff', fontSize: 14, fontWeight: '800' },
  dangerBtn:     { backgroundColor: COLORS.danger, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  dangerBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
