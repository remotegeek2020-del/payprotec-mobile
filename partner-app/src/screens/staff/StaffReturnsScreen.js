import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS } from '../../config';
import { staffRequest } from '../../staff-api';

const STATUS_FILTERS = [
  { label: 'All',       value: '' },
  { label: 'Open',      value: 'Open' },
  { label: 'Completed', value: 'Closed' },
];

// Mirrors returns-dashboard.html finalizeRMA conditionMap
const DESTINATIONS = [
  { value: 'Warsaw Office',  label: 'Warsaw Office — Back to Stock',  condition: 'Working (Back to Stock)' },
  { value: 'Warsaw Repairs', label: 'Warsaw Repairs — Defective',     condition: 'Defective (Received in Repairs)' },
  { value: 'Scrap',          label: 'Scrap — Decommission',           condition: 'Scrapped' },
];

const STATUS_COLORS = {
  open:   { bg: '#fef3c7', text: '#d97706' },
  closed: { bg: '#d1fae5', text: '#059669' },
};

function statusColor(st) {
  return STATUS_COLORS[(st || '').toLowerCase()] || STATUS_COLORS.open;
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

// ── Return card ────────────────────────────────────────────────────────────────
function ReturnCard({ item, onOpen }) {
  const sc = statusColor(item.status);
  const items = item.items || [];
  const serials = items.map(i => i.serial_number).filter(Boolean);
  return (
    <TouchableOpacity style={s.card} onPress={() => onOpen(item)} activeOpacity={0.75}>
      <View style={s.cardTop}>
        <Text style={s.returnNum}>{item.return_id || '—'}</Text>
        <View style={[s.badge, { backgroundColor: sc.bg }]}>
          <Text style={[s.badgeText, { color: sc.text }]}>{(item.status || 'Open').toUpperCase()}</Text>
        </View>
      </View>
      <Text style={s.merchant} numberOfLines={1}>{item.merchants?.dba_name || item.legacy_deployments?.mid || '—'}</Text>
      <Text style={s.itemsLine} numberOfLines={1}>
        {item.is_bulk
          ? `📦 ${items.length} unit${items.length !== 1 ? 's' : ''}`
          : `🔢 ${serials[0] || item.legacy_deployments?.serial_number || '—'}`}
        {item.return_reason ? ` · ${item.return_reason}` : ''}
      </Text>
      <View style={s.cardBottom}>
        {item.condition ? <Text style={s.meta}>{item.condition}</Text> : null}
        <Text style={s.date}>
          {formatDate(item.return_date_initiated) || formatDate(item.created_at)}
          {item.equipment_received_date ? ` → ${formatDate(item.equipment_received_date)}` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Detail modal ───────────────────────────────────────────────────────────────
function DetailModal({ ret, onClose, onChanged }) {
  const [working, setWorking]           = useState(false);
  // Complete return form
  const [showComplete, setShowComplete] = useState(false);
  const [destination, setDestination]   = useState('Warsaw Office');
  const [receivedDate, setReceivedDate] = useState(todayISO());
  // Add items flow
  const [showAdd, setShowAdd]           = useState(false);
  const [addable, setAddable]           = useState([]);
  const [rmaUuid, setRmaUuid]           = useState(null);
  const [addLoading, setAddLoading]     = useState(false);
  const [selectedIds, setSelectedIds]   = useState([]);

  useEffect(() => {
    setShowComplete(false); setShowAdd(false);
    setDestination('Warsaw Office'); setReceivedDate(todayISO());
    setAddable([]); setRmaUuid(null); setSelectedIds([]);
  }, [ret?.id]);

  if (!ret) return null;

  const sc = statusColor(ret.status);
  const items = ret.items || [];
  const isOpen = ret.status === 'Open';

  async function loadAddable() {
    if (!ret.return_id) { Alert.alert('Error', 'This return has no RMA number.'); return; }
    setShowAdd(true);
    setAddLoading(true);
    try {
      const res = await staffRequest('/api/returns', {
        action: 'get_addable_items',
        return_display_id: ret.return_id,
      });
      if (res.success) {
        setAddable(res.items || []);
        setRmaUuid(res.rma_uuid || null);
      } else {
        Alert.alert('Error', res.message || 'Could not load addable items.');
        setShowAdd(false);
      }
    } catch (e) {
      if (!e?.sessionExpired) { Alert.alert('Error', 'Could not load addable items.'); setShowAdd(false); }
    }
    setAddLoading(false);
  }

  function toggleSelected(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function submitAddItems() {
    if (!rmaUuid || selectedIds.length === 0) { Alert.alert('Required', 'Select at least one unit to add.'); return; }
    setWorking(true);
    try {
      const res = await staffRequest('/api/returns', {
        action: 'add_items',
        return_uuid: rmaUuid,
        equipment_ids: selectedIds,
      });
      if (res.success) {
        Alert.alert('Success', `${res.added || selectedIds.length} unit(s) added to ${ret.return_id}.`);
        onChanged();
        onClose();
      } else {
        Alert.alert('Error', res.message || 'Could not add items.');
      }
    } catch (e) {
      if (!e?.sessionExpired) Alert.alert('Error', 'Could not add items.');
    }
    setWorking(false);
  }

  function submitComplete() {
    if (!receivedDate.trim()) { Alert.alert('Required', 'Enter the date received (YYYY-MM-DD).'); return; }
    const dest = DESTINATIONS.find(d => d.value === destination);
    Alert.alert(
      'Complete Return',
      `Close ${ret.return_id || 'this RMA'}?\nUnit(s) will be moved to ${destination}.${destination === 'Scrap' ? '\nThis permanently decommissions the unit.' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete', style: destination === 'Scrap' ? 'destructive' : 'default',
          onPress: async () => {
            setWorking(true);
            try {
              const res = await staffRequest('/api/returns', {
                action: 'complete_return',
                payload: {
                  id: ret.id,
                  equipment_id: ret.equipment_id || null,
                  condition: dest?.condition,
                  destination,
                  equipment_received_date: receivedDate.trim(),
                },
              });
              if (res.success) {
                Alert.alert('Success', `RMA closed. Unit(s) moved to ${destination}.`);
                onChanged();
                onClose();
              } else {
                Alert.alert('Error', res.message || 'Could not complete return.');
              }
            } catch (e) {
              if (!e?.sessionExpired) Alert.alert('Error', 'Could not complete return.');
            }
            setWorking(false);
          },
        },
      ]
    );
  }

  function submitDelete() {
    Alert.alert(
      'Delete Return',
      `Permanently delete ${ret.return_id || 'this RMA'}? In-transit units will be reset to stock. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            setWorking(true);
            try {
              const res = await staffRequest('/api/returns', { action: 'delete', return_uuid: ret.id });
              if (res.success) {
                Alert.alert('Deleted', 'Return record removed.');
                onChanged();
                onClose();
              } else {
                Alert.alert('Error', res.message || 'Could not delete return.');
              }
            } catch (e) {
              if (!e?.sessionExpired) Alert.alert('Error', 'Could not delete return.');
            }
            setWorking(false);
          },
        },
      ]
    );
  }

  const detailRows = [
    ['RMA #',         ret.return_id],
    ['Merchant',      ret.merchants?.dba_name],
    ['MID',           ret.merchants?.merchant_id],
    ['Status',        ret.status],
    ['Reason',        ret.return_reason],
    ['Condition',     ret.condition],
    ['Destination',   ret.destination],
    ['Initiated',     formatDate(ret.return_date_initiated)],
    ['Received',      formatDate(ret.equipment_received_date)],
    ['Created By',    ret.created_by_name],
    ['Updated By',    ret.updated_by_name],
  ].filter(([, v]) => v);

  return (
    <Modal visible={!!ret} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle} numberOfLines={2}>{ret.return_id || 'Return'}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <View style={[s.badge, { backgroundColor: sc.bg }]}>
                  <Text style={[s.badgeText, { color: sc.text }]}>{(ret.status || 'Open').toUpperCase()}</Text>
                </View>
                {ret.is_bulk ? (
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

              <Text style={s.fieldLabel}>Items ({items.length})</Text>
              {items.length === 0 ? <Text style={s.emptySmall}>No items on this return</Text> : items.map((it, i) => (
                <View key={it.equipment_id || i} style={s.itemRow}>
                  <Text style={s.itemSerial}>🔢 {it.serial_number || '—'}</Text>
                  <Text style={s.itemMeta}>{it.terminal_type || ''}{it.condition ? ` · ${it.condition}` : ''}</Text>
                </View>
              ))}

              {isOpen ? (
                <View>
                  {/* Add Items */}
                  <TouchableOpacity style={s.actionBtn} onPress={() => (showAdd ? setShowAdd(false) : loadAddable())}>
                    <Text style={s.actionBtnText}>➕  Add Items to RMA</Text>
                  </TouchableOpacity>
                  {showAdd ? (
                    <View style={s.formBox}>
                      {addLoading ? (
                        <ActivityIndicator color={COLORS.primary} style={{ margin: 12 }} />
                      ) : addable.length === 0 ? (
                        <Text style={s.emptySmall}>No deployed units left to add from this deployment.</Text>
                      ) : (
                        <View>
                          <Text style={s.fieldLabel}>Select Units</Text>
                          {addable.map((a, i) => {
                            const id = a.equipment_id;
                            const on = selectedIds.includes(id);
                            return (
                              <TouchableOpacity key={id || i} style={[s.selectRow, on && s.selectRowActive]} onPress={() => toggleSelected(id)}>
                                <Text style={s.selectCheck}>{on ? '☑️' : '⬜'}</Text>
                                <View style={{ flex: 1 }}>
                                  <Text style={s.itemSerial}>{a.equip?.serial_number || '—'}</Text>
                                  <Text style={s.itemMeta}>{a.equip?.terminal_type || ''}</Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                          <TouchableOpacity style={[s.primaryBtn, (working || selectedIds.length === 0) && { opacity: 0.6 }]} onPress={submitAddItems} disabled={working || selectedIds.length === 0}>
                            {working ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Add {selectedIds.length || ''} Unit(s)</Text>}
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ) : null}

                  {/* Complete return */}
                  <TouchableOpacity style={s.actionBtn} onPress={() => setShowComplete(v => !v)}>
                    <Text style={s.actionBtnText}>✅  Complete Return</Text>
                  </TouchableOpacity>
                  {showComplete ? (
                    <View style={s.formBox}>
                      <Text style={s.fieldLabel}>Destination</Text>
                      {DESTINATIONS.map(d => {
                        const on = destination === d.value;
                        return (
                          <TouchableOpacity key={d.value} style={[s.selectRow, on && s.selectRowActive]} onPress={() => setDestination(d.value)}>
                            <Text style={s.selectCheck}>{on ? '🔘' : '⚪'}</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={[s.itemSerial, d.value === 'Scrap' && { color: COLORS.danger }]}>{d.label}</Text>
                              <Text style={s.itemMeta}>{d.condition}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                      <Text style={s.fieldLabel}>Date Received (YYYY-MM-DD)</Text>
                      <TextInput style={s.input} value={receivedDate} onChangeText={setReceivedDate} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.light} />
                      <TouchableOpacity style={[s.primaryBtn, working && { opacity: 0.6 }]} onPress={submitComplete} disabled={working}>
                        {working ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Complete Return</Text>}
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <TouchableOpacity style={[s.deleteBtn, working && { opacity: 0.6 }]} onPress={submitDelete} disabled={working}>
                <Text style={s.deleteBtnText}>🗑️  Delete Return</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export default function StaffReturnsScreen({ navigation }) {
  const [returns, setReturns]         = useState([]);
  const [metrics, setMetrics]         = useState(null);
  const [loading, setLoading]         = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [selected, setSelected]       = useState(null);
  const [query, setQuery]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [offset, setOffset]           = useState(0);
  const [totalCount, setTotalCount]   = useState(0);
  const LIMIT = 20;

  const load = useCallback(async (off = 0, q = query, sf = statusFilter, append = false) => {
    setLoading(true);
    try {
      const res = await staffRequest('/api/returns', {
        action: 'list',
        query: q.trim() || undefined,
        limit: LIMIT,
        offset: off,
        statusFilter: sf || undefined,
      });
      if (res.success) {
        setReturns(prev => append ? [...prev, ...(res.data || [])] : (res.data || []));
        setMetrics(res.metrics || null);
        setOffset(off);
        setTotalCount(res.totalCount || res.count || 0);
      }
    } catch (e) { /* session expired — fail quietly */ }
    setLoading(false);
    setRefreshing(false);
  }, [query, statusFilter]);

  useEffect(() => { load(0); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => load(0, query, statusFilter, false), 400);
    return () => clearTimeout(t);
  }, [query, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  function loadMore() {
    if (!loading && returns.length < totalCount) load(offset + LIMIT, query, statusFilter, true);
  }

  return (
    <View style={s.root}>
      <View style={s.searchBar}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Search RMA #, merchant, serial…"
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
        {metrics ? (
          <View style={s.metricsInline}>
            <Text style={s.metricsText}>Open: {metrics.open} · Defective: {metrics.defective}</Text>
          </View>
        ) : null}
      </View>

      <FlatList
        data={returns}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => <ReturnCard item={item} onOpen={setSelected} />}
        contentContainerStyle={s.list}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(0); }} tintColor={COLORS.primary} />}
        ListFooterComponent={loading && !refreshing ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> : null}
        ListEmptyComponent={!loading ? <Text style={s.empty}>No returns found</Text> : null}
      />

      <DetailModal ret={selected} onClose={() => setSelected(null)} onChanged={() => load(0)} />
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: COLORS.bg },
  searchBar:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, margin: 12, marginBottom: 8, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border },
  searchIcon:    { fontSize: 16, marginRight: 6 },
  searchInput:   { flex: 1, paddingVertical: 11, fontSize: 15, color: COLORS.text },
  filterRow:     { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' },
  metricsInline: { marginLeft: 'auto' },
  metricsText:   { fontSize: 11, color: COLORS.muted, fontWeight: '700' },
  list:          { paddingHorizontal: 12, paddingBottom: 30 },
  card:          { backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, gap: 8 },
  returnNum:     { fontSize: 13, fontWeight: '800', color: COLORS.primary, fontFamily: 'monospace' },
  badge:         { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:     { fontSize: 10, fontWeight: '800' },
  merchant:      { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  itemsLine:     { fontSize: 12, color: COLORS.muted, marginBottom: 6 },
  cardBottom:    { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
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
  actionBtn:     { backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  actionBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  formBox:       { backgroundColor: COLORS.bg, borderRadius: 12, padding: 12, marginTop: 8 },
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
  deleteBtn:     { borderWidth: 1.5, borderColor: COLORS.danger, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 18 },
  deleteBtnText: { color: COLORS.danger, fontSize: 14, fontWeight: '800' },
});
