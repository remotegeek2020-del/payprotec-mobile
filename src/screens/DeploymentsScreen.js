import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS } from '../config';
import { Deployments, Merchants } from '../api';
import DatePickerModal from '../components/DatePickerModal';

// Status values used by the backend
const STATUSES = ['Open', 'In Transit', 'Deployed', 'Closed'];

const STATUS_COLORS = {
  'open':       { bg: '#dbeafe', text: '#1d4ed8' },
  'in transit': { bg: '#fef3c7', text: '#d97706' },
  'deployed':   { bg: '#d1fae5', text: '#059669' },
  'closed':     { bg: '#d1fae5', text: '#059669' },
};

function statusColor(status) {
  return STATUS_COLORS[(status || '').toLowerCase()] || { bg: '#f1f5f9', text: '#64748b' };
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function DeploymentCard({ item, onOpen }) {
  const statusC = statusColor(item.status);
  const isBulk  = item.is_bulk;
  const serial  = isBulk
    ? `${item.items?.length || 0} units`
    : (item.equipments?.serial_number || '—');

  return (
    <TouchableOpacity style={s.card} onPress={() => onOpen(item)} activeOpacity={0.75}>
      <View style={s.cardTop}>
        <Text style={s.depId}>{item.deployment_id || '—'}</Text>
        <View style={[s.badge, { backgroundColor: statusC.bg }]}>
          <Text style={[s.badgeText, { color: statusC.text }]}>{item.status?.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={s.merchant} numberOfLines={1}>{item.merchants?.dba_name || '—'}</Text>
      <View style={s.cardBottom}>
        <Text style={s.serial}>{serial}</Text>
        {item.target_deployment_date
          ? <Text style={s.date}>{new Date(item.target_deployment_date).toLocaleDateString()}</Text>
          : null}
      </View>
      {item.created_by_name ? <Text style={s.audit}>Created by {item.created_by_name}</Text> : null}
    </TouchableOpacity>
  );
}

// ── Detail modal ───────────────────────────────────────────────────────────────

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
}

function DeploymentDetailModal({ item, onClose, onChanged }) {
  const [status, setStatus]         = useState('');
  const [trackingId, setTrackingId] = useState('');
  const [notes, setNotes]           = useState('');
  const [saving, setSaving]         = useState(false);
  const [rma, setRma]               = useState(null);

  useEffect(() => {
    if (!item) return;
    setStatus(item.status || 'Open');
    setTrackingId(item.tracking_id || '');
    setNotes(item.notes || '');
    setRma(null);
    // Check whether this deployment has an associated RMA
    Deployments.checkRma(item.id)
      .then(data => { if (data?.success && data.data) setRma(data.data); })
      .catch(() => {});
  }, [item?.id]);

  if (!item) return null;

  const items = item.items || item.deployment_items || [];
  const dirty =
    status !== (item.status || 'Open') ||
    trackingId !== (item.tracking_id || '') ||
    notes !== (item.notes || '');

  async function save() {
    setSaving(true);
    try {
      const res = await Deployments.update({
        deployment_id: item.id, // backend matches on the row UUID
        status,
        tracking_id: trackingId.trim() || null,
        target_date: item.target_deployment_date || null,
        notes: notes.trim() || null,
        purchase_type: item.purchase_type || null,
        merchant_received_date: item.merchant_received_date || null,
      });
      if (res.success) {
        onChanged();
      } else {
        Alert.alert('Error', res.error || res.message || 'Could not update deployment.');
      }
    } catch {
      Alert.alert('Error', 'Could not update deployment. Check your connection.');
    }
    setSaving(false);
  }

  return (
    <Modal visible={!!item} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{item.deployment_id || 'Deployment'}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
              <DetailRow label="Merchant"      value={item.merchants?.dba_name} />
              <DetailRow label="MID"           value={item.merchants?.merchant_id} />
              <DetailRow label="TID"           value={item.tid} />
              {!item.is_bulk ? (
                <DetailRow label="Serial" value={item.equipments?.serial_number} />
              ) : null}
              <DetailRow label="Terminal"      value={item.equipments?.terminal_type} />
              <DetailRow label="Purchase Type" value={item.purchase_type} />
              <DetailRow label="Target Date"   value={formatDate(item.target_deployment_date)} />
              <DetailRow label="Received"      value={formatDate(item.merchant_received_date)} />
              <DetailRow label="Created"       value={formatDate(item.created_at)} />
              <DetailRow label="Created by"    value={item.created_by_name} />
              <DetailRow label="Updated by"    value={item.updated_by_name} />

              {rma ? (
                <View style={s.rmaBox}>
                  <Text style={s.rmaText}>
                    RMA {rma.return_id || ''} ({rma.status || '—'}) — {rma.return_reason || 'no reason'}
                  </Text>
                </View>
              ) : null}

              {items.length > 0 ? (
                <View>
                  <Text style={s.sectionLabel}>Items ({items.length})</Text>
                  {items.map((it, i) => (
                    <View key={it.item_id || it.id || it.equipment_id || i} style={s.itemRow}>
                      <Text style={s.itemSerial}>{it.serial_number || it.equip?.serial_number || '—'}</Text>
                      <Text style={s.itemType}>{it.terminal_type || it.equip?.terminal_type || ''}</Text>
                      {it.tid ? <Text style={s.itemTid}>TID {it.tid}</Text> : null}
                    </View>
                  ))}
                </View>
              ) : null}

              <Text style={s.sectionLabel}>Status</Text>
              <View style={s.chipRow}>
                {STATUSES.map(st => {
                  const active = status.toLowerCase() === st.toLowerCase();
                  const sc = statusColor(st);
                  return (
                    <TouchableOpacity
                      key={st}
                      style={[s.chip, active && { backgroundColor: sc.bg, borderColor: sc.text }]}
                      onPress={() => setStatus(st)}
                    >
                      <Text style={[s.chipText, active && { color: sc.text }]}>{st}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.sectionLabel}>Tracking ID</Text>
              <TextInput
                style={s.input}
                placeholder="Tracking number"
                placeholderTextColor={COLORS.light}
                value={trackingId}
                onChangeText={setTrackingId}
                autoCapitalize="characters"
              />

              <Text style={s.sectionLabel}>Notes</Text>
              <TextInput
                style={[s.input, s.inputMultiline]}
                placeholder="Notes"
                placeholderTextColor={COLORS.light}
                value={notes}
                onChangeText={setNotes}
                multiline
              />

              <TouchableOpacity
                style={[s.primaryBtn, (!dirty || saving) && { opacity: 0.5 }]}
                onPress={save}
                disabled={!dirty || saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Create deployment modal ────────────────────────────────────────────────────

function CreateDeploymentModal({ visible, onClose, onCreated }) {
  const [merchantQuery, setMerchantQuery]   = useState('');
  const [merchantResults, setMerchantResults] = useState([]);
  const [merchant, setMerchant]             = useState(null);
  const [equipQuery, setEquipQuery]         = useState('');
  const [equipResults, setEquipResults]     = useState([]);
  const [equipment, setEquipment]           = useState(null);
  const [targetDate, setTargetDate]         = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tid, setTid]                       = useState('');
  const [trackingId, setTrackingId]         = useState('');
  const [notes, setNotes]                   = useState('');
  const [searchingMerchant, setSearchingMerchant] = useState(false);
  const [searchingEquip, setSearchingEquip] = useState(false);
  const [saving, setSaving]                 = useState(false);

  function reset() {
    setMerchantQuery(''); setMerchantResults([]); setMerchant(null);
    setEquipQuery(''); setEquipResults([]); setEquipment(null);
    setTargetDate(''); setTid(''); setTrackingId(''); setNotes('');
  }

  async function searchMerchants() {
    const q = merchantQuery.trim();
    if (!q) return;
    setSearchingMerchant(true);
    try {
      const data = await Merchants.list(q, 1, 8);
      setMerchantResults(data.data || []);
    } catch {}
    setSearchingMerchant(false);
  }

  async function searchEquipment() {
    const q = equipQuery.trim();
    if (!q) return;
    setSearchingEquip(true);
    try {
      const data = await Deployments.getLookups(q);
      setEquipResults(data.inventory || []);
    } catch {}
    setSearchingEquip(false);
  }

  async function submit() {
    if (!merchant)     { Alert.alert('Required', 'Select a merchant.'); return; }
    if (!equipment)    { Alert.alert('Required', 'Select equipment to deploy.'); return; }
    if (!targetDate.trim()) { Alert.alert('Required', 'Enter a target date.'); return; }
    setSaving(true);
    try {
      const payload = {
        merchant_id: merchant.id,
        equipment_id: equipment.id,
        target_date: targetDate.trim(),
      };
      if (tid.trim())       payload.tid         = tid.trim();
      if (trackingId.trim()) payload.tracking_id = trackingId.trim();
      if (notes.trim())     payload.notes        = notes.trim();

      const res = await Deployments.create(payload);
      if (res.success) {
        reset();
        onCreated();
      } else {
        Alert.alert('Error', res.message || 'Could not create deployment.');
      }
    } catch {
      Alert.alert('Error', 'Could not create deployment. Check your connection.');
    }
    setSaving(false);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { reset(); onClose(); }}>
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>New Deployment</Text>
              <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
              {/* Merchant */}
              <Text style={s.sectionLabel}>Merchant *</Text>
              {merchant ? (
                <View style={s.selectedRow}>
                  <Text style={s.selectedText} numberOfLines={1}>{merchant.dba_name} ({merchant.merchant_id})</Text>
                  <TouchableOpacity onPress={() => setMerchant(null)}>
                    <Text style={s.selectedClear}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <View style={s.searchRow}>
                    <TextInput
                      style={[s.input, { flex: 1, marginBottom: 0 }]}
                      placeholder="Search merchants…"
                      placeholderTextColor={COLORS.light}
                      value={merchantQuery}
                      onChangeText={setMerchantQuery}
                      onSubmitEditing={searchMerchants}
                      returnKeyType="search"
                    />
                    <TouchableOpacity style={s.searchBtn} onPress={searchMerchants}>
                      {searchingMerchant
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={s.searchBtnText}>Search</Text>}
                    </TouchableOpacity>
                  </View>
                  {merchantResults.map(m => (
                    <TouchableOpacity key={m.id} style={s.resultRow} onPress={() => { setMerchant(m); setMerchantResults([]); }}>
                      <Text style={s.resultName} numberOfLines={1}>{m.dba_name}</Text>
                      <Text style={s.resultMid}>{m.merchant_id}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Equipment */}
              <Text style={s.sectionLabel}>Equipment *</Text>
              {equipment ? (
                <View style={s.selectedRow}>
                  <Text style={s.selectedText} numberOfLines={1}>{equipment.serial_number} {equipment.terminal_type ? `(${equipment.terminal_type})` : ''}</Text>
                  <TouchableOpacity onPress={() => setEquipment(null)}>
                    <Text style={s.selectedClear}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <View style={s.searchRow}>
                    <TextInput
                      style={[s.input, { flex: 1, marginBottom: 0 }]}
                      placeholder="Search by serial or type…"
                      placeholderTextColor={COLORS.light}
                      value={equipQuery}
                      onChangeText={setEquipQuery}
                      onSubmitEditing={searchEquipment}
                      returnKeyType="search"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity style={s.searchBtn} onPress={searchEquipment}>
                      {searchingEquip
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={s.searchBtnText}>Search</Text>}
                    </TouchableOpacity>
                  </View>
                  {equipResults.map(eq => (
                    <TouchableOpacity key={eq.id} style={s.resultRow} onPress={() => { setEquipment(eq); setEquipResults([]); }}>
                      <Text style={s.resultName} numberOfLines={1}>{eq.serial_number}</Text>
                      <Text style={s.resultMid}>{eq.terminal_type || eq.status || ''}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Target date */}
              <Text style={s.sectionLabel}>Target Date *</Text>
              <TouchableOpacity style={s.dateField} onPress={() => setShowDatePicker(true)}>
                <Text style={targetDate ? s.dateFieldText : s.dateFieldPlaceholder}>
                  {targetDate || 'Select a date…'}
                </Text>
                <Text style={s.dateFieldIcon}>📅</Text>
              </TouchableOpacity>
              <DatePickerModal
                visible={showDatePicker}
                value={targetDate}
                onSelect={d => { setTargetDate(d); setShowDatePicker(false); }}
                onClose={() => setShowDatePicker(false)}
                title="Target Date"
              />

              {/* TID (optional) */}
              <Text style={s.sectionLabel}>TID (optional)</Text>
              <TextInput
                style={s.input}
                placeholder="Terminal ID"
                placeholderTextColor={COLORS.light}
                value={tid}
                onChangeText={setTid}
                autoCapitalize="characters"
              />

              {/* Tracking ID (optional) */}
              <Text style={s.sectionLabel}>Tracking ID (optional)</Text>
              <TextInput
                style={s.input}
                placeholder="Shipment tracking number"
                placeholderTextColor={COLORS.light}
                value={trackingId}
                onChangeText={setTrackingId}
                autoCapitalize="characters"
              />

              {/* Notes (optional) */}
              <Text style={s.sectionLabel}>Notes (optional)</Text>
              <TextInput
                style={[s.input, s.inputMultiline]}
                placeholder="Any notes for this deployment"
                placeholderTextColor={COLORS.light}
                value={notes}
                onChangeText={setNotes}
                multiline
              />

              <TouchableOpacity
                style={[s.primaryBtn, saving && { opacity: 0.6 }]}
                onPress={submit}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.primaryBtnText}>Create Deployment</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function DeploymentsScreen() {
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState([]);
  const [metrics, setMetrics]     = useState({ active: '—', total: '—' });
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage]           = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selected, setSelected]   = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  async function load(q = query, pg = 1, append = false) {
    setLoading(true);
    try {
      const data = await Deployments.list(q, pg, 20);
      const rows = data.data || [];
      setResults(prev => (append ? [...prev, ...rows] : rows));
      setTotalCount(data.pagination?.totalRecords ?? 0);
      setMetrics(data.metrics || { active: '—', total: '—' });
      setPage(pg);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  function onSearch()  { load(query, 1, false); }
  function onRefresh() { setRefreshing(true); load(query, 1, false); }
  function loadMore()  { if (results.length < totalCount && !loading) load(query, page + 1, true); }

  function handleChanged() {
    setSelected(null);
    load(query, 1, false);
  }

  return (
    <View style={s.container}>
      {/* Metrics */}
      <View style={s.metricsRow}>
        <View style={[s.metric, { borderLeftColor: COLORS.primary }]}>
          <Text style={[s.metricNum, { color: COLORS.primary }]}>{metrics.active}</Text>
          <Text style={s.metricLabel}>Active</Text>
        </View>
        <View style={[s.metric, { borderLeftColor: COLORS.muted }]}>
          <Text style={[s.metricNum, { color: COLORS.muted }]}>{totalCount}</Text>
          <Text style={s.metricLabel}>Total</Text>
        </View>
      </View>

      {/* Search */}
      <View style={s.searchBar}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Search by merchant, serial, TID…"
          placeholderTextColor={COLORS.light}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={onSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={results}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <DeploymentCard item={item} onOpen={setSelected} />}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loading && !refreshing ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> : null}
        ListEmptyComponent={!loading ? <Text style={s.empty}>No deployments found</Text> : null}
      />

      <DeploymentDetailModal item={selected} onClose={() => setSelected(null)} onChanged={handleChanged} />

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
        <Text style={s.fabText}>＋</Text>
      </TouchableOpacity>

      <CreateDeploymentModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); load(query, 1, false); }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.bg },
  metricsRow:  { flexDirection: 'row', gap: 10, padding: 14, paddingBottom: 4 },
  metric:      { flex: 1, backgroundColor: COLORS.card, borderRadius: 10, padding: 12, borderLeftWidth: 3 },
  metricNum:   { fontSize: 22, fontWeight: '900' },
  metricLabel: { fontSize: 10, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase' },
  searchBar:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, margin: 14, marginTop: 10, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border },
  searchIcon:  { fontSize: 16, marginRight: 6 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: COLORS.text },
  list:        { paddingHorizontal: 14, paddingBottom: 90 },
  card:        { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  depId:       { fontSize: 13, fontWeight: '800', color: COLORS.primaryDk, fontFamily: 'monospace' },
  badge:       { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:   { fontSize: 10, fontWeight: '800' },
  merchant:    { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  cardBottom:  { flexDirection: 'row', justifyContent: 'space-between' },
  serial:      { fontSize: 11, color: COLORS.primary, fontFamily: 'monospace' },
  date:        { fontSize: 11, color: COLORS.muted },
  audit:       { fontSize: 10, color: COLORS.light, marginTop: 3 },
  empty:       { textAlign: 'center', color: COLORS.muted, padding: 40, fontSize: 14 },

  // Modal
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard:   { backgroundColor: COLORS.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle:  { fontSize: 17, fontWeight: '800', color: COLORS.primaryDk, fontFamily: 'monospace' },
  modalClose:  { fontSize: 18, color: COLORS.muted, fontWeight: '700' },
  detailRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  detailLabel: { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  detailValue: { fontSize: 12, color: COLORS.text, fontWeight: '700', maxWidth: '60%', textAlign: 'right' },
  sectionLabel:{ fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 8 },
  rmaBox:      { backgroundColor: '#fef3c7', borderRadius: 10, padding: 10, marginTop: 10 },
  rmaText:     { fontSize: 12, color: '#92400e', fontWeight: '600' },
  itemRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.bg, borderRadius: 8, padding: 10, marginBottom: 6 },
  itemSerial:  { fontSize: 12, color: COLORS.primary, fontFamily: 'monospace', fontWeight: '700' },
  itemType:    { fontSize: 12, color: COLORS.text, flex: 1 },
  itemTid:     { fontSize: 10, color: COLORS.muted, fontFamily: 'monospace' },
  chipRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:        { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#fff' },
  chipText:    { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  input:       { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, marginBottom: 4, backgroundColor: '#fff' },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  primaryBtn:  { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // FAB
  fab:         { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  fabText:     { color: '#fff', fontSize: 28, fontWeight: '700', lineHeight: 32 },

  // Create modal extra styles
  searchRow:   { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchBtn:   { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  resultRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  resultName:  { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.text },
  resultMid:   { fontSize: 11, color: COLORS.muted, fontFamily: 'monospace', marginLeft: 8 },
  selectedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#eff6ff', borderRadius: 10, padding: 12 },
  selectedText:{ flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.primary },
  selectedClear: { fontSize: 12, fontWeight: '700', color: COLORS.danger, marginLeft: 10 },
  dateField:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, marginBottom: 14, backgroundColor: '#fff' },
  dateFieldText:      { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  dateFieldPlaceholder: { fontSize: 14, color: COLORS.light },
  dateFieldIcon:      { fontSize: 16 },
});
