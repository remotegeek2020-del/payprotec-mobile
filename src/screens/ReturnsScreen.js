import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS } from '../config';
import { Returns } from '../api';

const STATUS_COLORS = {
  open:   { bg: '#fef3c7', text: '#d97706' },
  closed: { bg: '#d1fae5', text: '#059669' },
};

// Condition values accepted by the backend's complete_return action
const CONDITIONS = [
  'Working (Back to Stock)',
  'Defective (Received in Repairs)',
  'Scrapped',
];

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function ReturnCard({ item, onOpen }) {
  const isLegacy = !!item.legacy_deployment_id;
  const isBulk = item.is_bulk;
  const statusC = STATUS_COLORS[item.status?.toLowerCase()] || STATUS_COLORS.closed;
  const serial = isBulk
    ? `${item.items?.length || 0} units`
    : (item.equipments?.serial_number || item.legacy_deployments?.serial_number || '—');

  return (
    <TouchableOpacity style={s.card} onPress={() => onOpen(item)} activeOpacity={0.75}>
      <View style={s.cardTop}>
        <Text style={s.returnId}>{item.return_id || 'PENDING'}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {isLegacy && <View style={s.tagLegacy}><Text style={s.tagText}>LEGACY</Text></View>}
          {isBulk   && <View style={s.tagBulk}>  <Text style={s.tagText}>BULK</Text></View>}
          <View style={[s.statusBadge, { backgroundColor: statusC.bg }]}>
            <Text style={[s.statusText, { color: statusC.text }]}>{item.status?.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      <Text style={s.merchant} numberOfLines={1}>{item.merchants?.dba_name || '—'}</Text>
      <View style={s.cardBottom}>
        <Text style={s.serial}>{serial}</Text>
        <Text style={s.reason} numberOfLines={1}>{item.return_reason || '—'}</Text>
      </View>
      {item.destination ? <Text style={s.dest}>→ {item.destination}</Text> : null}
      {item.created_by_name ? <Text style={s.audit}>Filed by {item.created_by_name}</Text> : null}
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

function ReturnDetailModal({ item, onClose, onChanged }) {
  const [completing, setCompleting]   = useState(false);
  const [condition, setCondition]     = useState(null);
  const [destination, setDestination] = useState('');
  const [receivedDate, setReceivedDate] = useState(todayStr());
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    setCompleting(false);
    setCondition(null);
    setDestination('');
    setReceivedDate(todayStr());
  }, [item?.id]);

  if (!item) return null;

  const isOpen = item.status?.toLowerCase() === 'open';
  const items = item.items || [];

  async function submitComplete() {
    if (!condition) { Alert.alert('Required', 'Select the equipment condition.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(receivedDate.trim())) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD format for the received date.');
      return;
    }
    setSaving(true);
    try {
      const res = await Returns.complete({
        id: item.id,
        equipment_id: item.equipment_id || undefined,
        merchant_id: item.merchant_id || undefined,
        condition,
        destination: destination.trim() || condition,
        equipment_received_date: receivedDate.trim(),
      });
      if (res.success) {
        onChanged();
      } else {
        Alert.alert('Error', res.error || res.message || 'Could not complete return.');
      }
    } catch {
      Alert.alert('Error', 'Could not complete return. Check your connection.');
    }
    setSaving(false);
  }

  function confirmDelete() {
    Alert.alert('Delete return?', `${item.return_id || 'This return'} will be permanently deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            const res = await Returns.remove(item.id);
            if (res.success) onChanged();
            else Alert.alert('Error', res.error || 'Could not delete return.');
          } catch {
            Alert.alert('Error', 'Could not delete return.');
          }
        },
      },
    ]);
  }

  return (
    <Modal visible={!!item} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{item.return_id || 'Return'}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
              <DetailRow label="Status"      value={item.status} />
              <DetailRow label="Merchant"    value={item.merchants?.dba_name} />
              <DetailRow label="MID"         value={item.merchants?.merchant_id} />
              <DetailRow label="Reason"      value={item.return_reason} />
              <DetailRow label="Condition"   value={item.condition} />
              <DetailRow label="Destination" value={item.destination} />
              <DetailRow label="Initiated"   value={formatDate(item.return_date_initiated)} />
              <DetailRow label="Received"    value={formatDate(item.equipment_received_date)} />
              <DetailRow label="Created"     value={formatDate(item.created_at)} />
              <DetailRow label="Filed by"    value={item.created_by_name} />
              <DetailRow label="Updated by"  value={item.updated_by_name} />
              {!item.is_bulk ? (
                <DetailRow label="Serial" value={item.equipments?.serial_number || item.legacy_deployments?.serial_number} />
              ) : null}

              {items.length > 0 ? (
                <View>
                  <Text style={s.sectionLabel}>Items ({items.length})</Text>
                  {items.map((it, i) => (
                    <View key={it.item_id || it.equipment_id || i} style={s.itemRow}>
                      <Text style={s.itemSerial}>{it.serial_number || '—'}</Text>
                      <Text style={s.itemType}>{it.terminal_type || ''}</Text>
                      {it.condition ? <Text style={s.itemCond}>{it.condition}</Text> : null}
                    </View>
                  ))}
                </View>
              ) : null}

              {isOpen && !completing ? (
                <TouchableOpacity style={s.primaryBtn} onPress={() => setCompleting(true)}>
                  <Text style={s.primaryBtnText}>Complete Return</Text>
                </TouchableOpacity>
              ) : null}

              {isOpen && completing ? (
                <View style={s.completeBox}>
                  <Text style={s.sectionLabel}>Equipment Condition</Text>
                  {CONDITIONS.map(c => {
                    const active = condition === c;
                    return (
                      <TouchableOpacity
                        key={c}
                        style={[s.condChip, active && s.condChipActive]}
                        onPress={() => setCondition(c)}
                      >
                        <Text style={[s.condChipText, active && s.condChipTextActive]}>{c}</Text>
                      </TouchableOpacity>
                    );
                  })}

                  <Text style={s.sectionLabel}>Destination (optional)</Text>
                  <TextInput
                    style={s.input}
                    placeholder="e.g. Main Office"
                    placeholderTextColor={COLORS.light}
                    value={destination}
                    onChangeText={setDestination}
                  />

                  <Text style={s.sectionLabel}>Received Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={s.input}
                    placeholder={todayStr()}
                    placeholderTextColor={COLORS.light}
                    value={receivedDate}
                    onChangeText={setReceivedDate}
                    autoCapitalize="none"
                  />

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity style={s.cancelBtn} onPress={() => setCompleting(false)}>
                      <Text style={s.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.primaryBtn, { flex: 1, marginTop: 0 }, saving && { opacity: 0.6 }]}
                      onPress={submitComplete}
                      disabled={saving}
                    >
                      {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Confirm Complete</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              <TouchableOpacity style={s.deleteBtn} onPress={confirmDelete}>
                <Text style={s.deleteBtnText}>Delete Return</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function ReturnsScreen() {
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState([]);
  const [metrics, setMetrics]     = useState({ open: '—', defective: '—' });
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [offset, setOffset]       = useState(0);
  const [total, setTotal]         = useState(0);
  const [selected, setSelected]   = useState(null);
  const PAGE = 20;

  async function load(q = query, off = 0, append = false) {
    setLoading(true);
    try {
      const data = await Returns.list(q, off, PAGE);
      const rows = data.data || [];
      setResults(prev => (append ? [...prev, ...rows] : rows));
      setTotal(data.totalCount ?? data.count ?? 0);
      setMetrics(data.metrics || { open: '—', defective: '—' });
      setOffset(off);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  function onSearch()  { load(query, 0, false); }
  function onRefresh() { setRefreshing(true); load(query, 0, false); }
  function loadMore()  { if (results.length < total && !loading) load(query, offset + PAGE, true); }

  function handleChanged() {
    setSelected(null);
    load(query, 0, false);
  }

  return (
    <View style={s.container}>
      {/* Metrics */}
      <View style={s.metricsRow}>
        <View style={[s.metric, { borderLeftColor: COLORS.warning }]}>
          <Text style={[s.metricNum, { color: COLORS.warning }]}>{metrics.open}</Text>
          <Text style={s.metricLabel}>Open</Text>
        </View>
        <View style={[s.metric, { borderLeftColor: COLORS.danger }]}>
          <Text style={[s.metricNum, { color: COLORS.danger }]}>{metrics.defective}</Text>
          <Text style={s.metricLabel}>Defective</Text>
        </View>
        <View style={[s.metric, { borderLeftColor: COLORS.primary }]}>
          <Text style={[s.metricNum, { color: COLORS.primary }]}>{total}</Text>
          <Text style={s.metricLabel}>Total</Text>
        </View>
      </View>

      {/* Search */}
      <View style={s.searchBar}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Search RMA ID, merchant, serial…"
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
        renderItem={({ item }) => <ReturnCard item={item} onOpen={setSelected} />}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loading && !refreshing ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> : null}
        ListEmptyComponent={!loading ? <Text style={s.empty}>No returns found</Text> : null}
      />

      <ReturnDetailModal item={selected} onClose={() => setSelected(null)} onChanged={handleChanged} />
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
  list:        { paddingHorizontal: 14, paddingBottom: 30 },
  card:        { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  returnId:    { fontSize: 14, fontWeight: '800', color: COLORS.primary, fontFamily: 'monospace' },
  statusBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:  { fontSize: 10, fontWeight: '800' },
  tagLegacy:   { backgroundColor: '#fef3c7', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  tagBulk:     { backgroundColor: '#dbeafe', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  tagText:     { fontSize: 9, fontWeight: '800', color: '#64748b' },
  merchant:    { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  cardBottom:  { flexDirection: 'row', justifyContent: 'space-between' },
  serial:      { fontSize: 11, color: COLORS.primary, fontFamily: 'monospace' },
  reason:      { fontSize: 11, color: COLORS.muted, maxWidth: '60%', textAlign: 'right' },
  dest:        { fontSize: 11, color: COLORS.muted, marginTop: 4 },
  audit:       { fontSize: 10, color: COLORS.light, marginTop: 3 },
  empty:       { textAlign: 'center', color: COLORS.muted, padding: 40, fontSize: 14 },

  // Modal
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard:   { backgroundColor: COLORS.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle:  { fontSize: 17, fontWeight: '800', color: COLORS.primary, fontFamily: 'monospace' },
  modalClose:  { fontSize: 18, color: COLORS.muted, fontWeight: '700' },
  detailRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  detailLabel: { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  detailValue: { fontSize: 12, color: COLORS.text, fontWeight: '700', maxWidth: '60%', textAlign: 'right' },
  sectionLabel:{ fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 8 },
  itemRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.bg, borderRadius: 8, padding: 10, marginBottom: 6 },
  itemSerial:  { fontSize: 12, color: COLORS.primary, fontFamily: 'monospace', fontWeight: '700' },
  itemType:    { fontSize: 12, color: COLORS.text, flex: 1 },
  itemCond:    { fontSize: 10, color: COLORS.muted },
  completeBox: { marginTop: 4 },
  condChip:    { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 12, marginBottom: 8, backgroundColor: '#fff' },
  condChipActive: { borderColor: COLORS.primary, backgroundColor: '#eff6ff' },
  condChipText: { fontSize: 13, fontWeight: '600', color: COLORS.muted },
  condChipTextActive: { color: COLORS.primary, fontWeight: '700' },
  input:       { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, marginBottom: 4, backgroundColor: '#fff' },
  primaryBtn:  { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  cancelBtn:   { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center' },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.muted },
  deleteBtn:   { alignItems: 'center', paddingVertical: 12, marginTop: 8 },
  deleteBtnText: { color: COLORS.danger, fontSize: 13, fontWeight: '700' },
});
