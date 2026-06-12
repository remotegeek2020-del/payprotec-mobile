import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS } from '../../config';
import { staffRequest } from '../../staff-api';

// filterStatus values accepted by api/equipments.js 'list'
const STATUS_FILTERS = [
  { label: 'All',       value: '' },
  { label: 'Stocked',   value: 'stocked' },
  { label: 'Deployed',  value: 'deployed' },
  { label: 'Repairing', value: 'repairing' },
  { label: 'Pending Return', value: 'pending_return' },
  { label: 'Retired',   value: 'decommissioned' },
];

const STATUS_COLORS = {
  stocked:        { bg: '#d1fae5', text: '#059669' },
  deployed:       { bg: '#dbeafe', text: '#1d4ed8' },
  repairing:      { bg: '#fef3c7', text: '#d97706' },
  pending_return: { bg: '#fef3c7', text: '#d97706' },
  decommissioned: { bg: '#f1f5f9', text: '#64748b' },
};

const EDIT_STATUSES  = ['stocked', 'repairing'];                 // mirrors equipments-dashboard edit form
const EDIT_LOCATIONS = ['Warsaw Office', 'Warsaw Repairs'];      // mirrors equipments-dashboard edit form

function statusColor(st) {
  return STATUS_COLORS[(st || '').toLowerCase()] || STATUS_COLORS.stocked;
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

// ── Equipment card ─────────────────────────────────────────────────────────────
function EquipmentCard({ item, onOpen }) {
  const sc = statusColor(item.status);
  return (
    <TouchableOpacity style={s.card} onPress={() => onOpen(item)} activeOpacity={0.75}>
      <View style={s.cardTop}>
        <Text style={s.serial} numberOfLines={1}>🔢 {item.serial_number || '—'}</Text>
        <View style={[s.badge, { backgroundColor: sc.bg }]}>
          <Text style={[s.badgeText, { color: sc.text }]}>{(item.status || '—').toUpperCase()}</Text>
        </View>
      </View>
      <Text style={s.type}>{item.terminal_type || 'Unknown'}</Text>
      <View style={s.cardBottom}>
        <Text style={s.meta}>📍 {item.current_location || '—'}</Text>
        {item.status === 'deployed' && item.merchants?.dba_name ? (
          <Text style={s.meta} numberOfLines={1}>🏪 {item.merchants.dba_name}</Text>
        ) : null}
        {item.received_date ? <Text style={s.date}>{formatDate(item.received_date)}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

// ── Detail / edit modal ────────────────────────────────────────────────────────
function DetailModal({ unit, onClose, onChanged }) {
  const [status, setStatus]     = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    setStatus(unit?.status || '');
    setLocation(unit?.current_location || '');
  }, [unit?.id]);

  if (!unit) return null;

  const sc = statusColor(unit.status);
  const dirty = status !== unit.status || location !== unit.current_location;

  async function save() {
    setSaving(true);
    try {
      const res = await staffRequest('/api/equipments', {
        action: 'update',
        id: unit.id,
        payload: {
          status,
          current_location: location,
        },
      });
      if (res.success) {
        Alert.alert('Saved', 'Unit updated.');
        onChanged();
        onClose();
      } else {
        Alert.alert('Error', res.message || 'Could not update unit.');
      }
    } catch (e) {
      if (!e?.sessionExpired) Alert.alert('Error', 'Could not update unit.');
    }
    setSaving(false);
  }

  const detailRows = [
    ['Serial',     unit.serial_number],
    ['Type',       unit.terminal_type],
    ['Status',     unit.status],
    ['Location',   unit.current_location],
    ['Condition',  unit.condition],
    ['Merchant',   unit.merchants?.dba_name],
    ['Received',   formatDate(unit.received_date)],
    ['Added',      formatDate(unit.created_at)],
    ['Notes',      unit.notes],
  ].filter(([, v]) => v);

  return (
    <Modal visible={!!unit} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle} numberOfLines={1}>{unit.serial_number || 'Unit'}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <View style={[s.badge, { backgroundColor: sc.bg }]}>
                  <Text style={[s.badgeText, { color: sc.text }]}>{(unit.status || '—').toUpperCase()}</Text>
                </View>
              </View>

              {detailRows.map(([label, value]) => (
                <View key={label} style={s.detailRow}>
                  <Text style={s.detailLabel}>{label}</Text>
                  <Text style={s.detailValue}>{String(value)}</Text>
                </View>
              ))}

              <Text style={s.fieldLabel}>Status</Text>
              <View style={s.chipRow}>
                {EDIT_STATUSES.map(st => (
                  <TouchableOpacity key={st} style={[s.chip, status === st && s.chipActive]} onPress={() => setStatus(st)}>
                    <Text style={[s.chipText, status === st && s.chipTextActive]}>{st}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.fieldLabel}>Location</Text>
              <View style={s.chipRow}>
                {EDIT_LOCATIONS.map(loc => (
                  <TouchableOpacity key={loc} style={[s.chip, location === loc && s.chipActive]} onPress={() => setLocation(loc)}>
                    <Text style={[s.chipText, location === loc && s.chipTextActive]}>{loc}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={[s.primaryBtn, (!dirty || saving) && { opacity: 0.6 }]} onPress={save} disabled={!dirty || saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Add unit modal ─────────────────────────────────────────────────────────────
function AddModal({ visible, terminalTypes, onClose, onCreated }) {
  const [serial, setSerial]       = useState('');
  const [type, setType]           = useState('');
  const [received, setReceived]   = useState(todayISO());
  const [saving, setSaving]       = useState(false);

  function reset() { setSerial(''); setType(''); setReceived(todayISO()); }

  async function submit() {
    if (!serial.trim()) { Alert.alert('Required', 'Enter a serial number.'); return; }
    if (!type)          { Alert.alert('Required', 'Select a terminal type.'); return; }
    setSaving(true);
    try {
      const res = await staffRequest('/api/equipments', {
        action: 'create',
        payload: {
          serial_number: serial.trim(),
          terminal_type: type,
          status: 'stocked',
          current_location: 'Warsaw Office',
          received_date: received.trim() || null,
        },
      });
      if (res.success) {
        reset();
        onCreated();
      } else {
        Alert.alert('Error', res.message || 'Could not add unit.');
      }
    } catch (e) {
      if (!e?.sessionExpired) Alert.alert('Error', 'Could not add unit.');
    }
    setSaving(false);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { reset(); onClose(); }}>
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add Unit</Text>
              <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
              <Text style={s.fieldLabel}>Serial Number *</Text>
              <TextInput style={s.input} placeholder="Serial number" placeholderTextColor={COLORS.light} value={serial} onChangeText={setSerial} autoCapitalize="characters" />

              <Text style={s.fieldLabel}>Terminal Type *</Text>
              <View style={s.chipRow}>
                {terminalTypes.map(t => (
                  <TouchableOpacity key={t.id || t.name} style={[s.chip, type === t.name && s.chipActive]} onPress={() => setType(t.name)}>
                    <Text style={[s.chipText, type === t.name && s.chipTextActive]}>{t.name}</Text>
                  </TouchableOpacity>
                ))}
                {terminalTypes.length === 0 ? <Text style={s.emptySmall}>Loading types…</Text> : null}
              </View>

              <Text style={s.fieldLabel}>Date Received (YYYY-MM-DD)</Text>
              <TextInput style={s.input} value={received} onChangeText={setReceived} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.light} />

              <TouchableOpacity style={[s.primaryBtn, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Add to Inventory</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export default function StaffEquipmentsScreen({ navigation }) {
  const [units, setUnits]             = useState([]);
  const [metrics, setMetrics]         = useState(null);
  const [loading, setLoading]         = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [selected, setSelected]       = useState(null);
  const [showAdd, setShowAdd]         = useState(false);
  const [query, setQuery]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter]   = useState('');
  const [terminalTypes, setTerminalTypes] = useState([]);
  const [typeCounts, setTypeCounts]   = useState({});
  const [page, setPage]               = useState(0);
  const [totalCount, setTotalCount]   = useState(0);
  const LIMIT = 50;

  const load = useCallback(async (pageNum = 0, q = query, sf = statusFilter, append = false) => {
    setLoading(true);
    try {
      const res = await staffRequest('/api/equipments', {
        action: 'list',
        query: q.trim() || undefined,
        limit: LIMIT,
        page: pageNum,
        filterStatus: sf || undefined,
      });
      if (res.success) {
        setUnits(prev => append ? [...prev, ...(res.data || [])] : (res.data || []));
        setMetrics(res.metrics || null);
        setPage(pageNum);
        setTotalCount(res.count || 0);
      }
    } catch (e) { /* session expired — fail quietly */ }
    setLoading(false);
    setRefreshing(false);
  }, [query, statusFilter]);

  async function loadTypesAndCounts() {
    try {
      const res = await staffRequest('/api/equipments', { action: 'list_terminal_types' });
      const types = (res.terminal_types || []).filter(t => t.is_active !== false);
      setTerminalTypes(types);
      // Stock summary via count_by_terminal_type (per-type count)
      const results = await Promise.all(types.map(t =>
        staffRequest('/api/equipments', { action: 'count_by_terminal_type', name: t.name })
          .then(r => [t.name, r.count || 0])
          .catch(() => [t.name, null])
      ));
      setTypeCounts(Object.fromEntries(results.filter(([, c]) => c !== null)));
    } catch (e) { /* fail quietly */ }
  }

  useEffect(() => { load(0); loadTypesAndCounts(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => load(0, query, statusFilter, false), 400);
    return () => clearTimeout(t);
  }, [query, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  function loadMore() {
    if (!loading && units.length < totalCount) load(page + 1, query, statusFilter, true);
  }

  function refreshAll() {
    setRefreshing(true);
    load(0);
    loadTypesAndCounts();
  }

  // Terminal-type filter is applied client-side on loaded records
  const visible = typeFilter ? units.filter(u => (u.terminal_type || '') === typeFilter) : units;

  return (
    <View style={s.root}>
      <View style={s.topBar}>
        <View style={s.searchBar}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Search by serial…"
            placeholderTextColor={COLORS.light}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCapitalize="characters"
          />
        </View>
        <TouchableOpacity style={s.newBtn} onPress={() => setShowAdd(true)}>
          <Text style={s.newBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Stock summary */}
      {metrics ? (
        <View style={s.metricsRow}>
          <View style={s.metricBox}><Text style={s.metricValue}>{metrics.total}</Text><Text style={s.metricLabel}>Total</Text></View>
          <View style={s.metricBox}><Text style={s.metricValue}>{metrics.inOffice}</Text><Text style={s.metricLabel}>In Office</Text></View>
          <View style={s.metricBox}><Text style={s.metricValue}>{metrics.deployed}</Text><Text style={s.metricLabel}>Deployed</Text></View>
          <View style={s.metricBox}><Text style={s.metricValue}>{metrics.inRepair}</Text><Text style={s.metricLabel}>Repair</Text></View>
          <View style={s.metricBox}><Text style={s.metricValue}>{metrics.retired}</Text><Text style={s.metricLabel}>Retired</Text></View>
        </View>
      ) : null}

      {/* Status filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipBar} contentContainerStyle={s.chipBarContent}>
        {STATUS_FILTERS.map(f => {
          const active = statusFilter === f.value;
          return (
            <TouchableOpacity key={f.label} style={[s.chip, active && s.chipActive]} onPress={() => setStatusFilter(f.value)}>
              <Text style={[s.chipText, active && s.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Terminal type chips with stock counts */}
      {terminalTypes.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipBar} contentContainerStyle={s.chipBarContent}>
          <TouchableOpacity style={[s.chip, !typeFilter && s.chipActive]} onPress={() => setTypeFilter('')}>
            <Text style={[s.chipText, !typeFilter && s.chipTextActive]}>All Types</Text>
          </TouchableOpacity>
          {terminalTypes.map(t => {
            const active = typeFilter === t.name;
            const count = typeCounts[t.name];
            return (
              <TouchableOpacity key={t.id || t.name} style={[s.chip, active && s.chipActive]} onPress={() => setTypeFilter(active ? '' : t.name)}>
                <Text style={[s.chipText, active && s.chipTextActive]}>
                  {t.name}{count !== undefined ? ` · ${count}` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      <FlatList
        data={visible}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => <EquipmentCard item={item} onOpen={setSelected} />}
        contentContainerStyle={s.list}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={COLORS.primary} />}
        ListFooterComponent={loading && !refreshing ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> : null}
        ListEmptyComponent={!loading ? <Text style={s.empty}>No equipment found</Text> : null}
      />

      <DetailModal unit={selected} onClose={() => setSelected(null)} onChanged={() => { load(0); loadTypesAndCounts(); }} />
      <AddModal
        visible={showAdd}
        terminalTypes={terminalTypes}
        onClose={() => setShowAdd(false)}
        onCreated={() => { setShowAdd(false); load(0); loadTypesAndCounts(); }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: COLORS.bg },
  topBar:        { flexDirection: 'row', alignItems: 'center', padding: 12, paddingBottom: 8, gap: 8 },
  searchBar:     { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border },
  searchIcon:    { fontSize: 16, marginRight: 6 },
  searchInput:   { flex: 1, paddingVertical: 11, fontSize: 15, color: COLORS.text },
  newBtn:        { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  newBtnText:    { color: '#fff', fontSize: 13, fontWeight: '800' },
  metricsRow:    { flexDirection: 'row', gap: 6, paddingHorizontal: 12, marginBottom: 8 },
  metricBox:     { flex: 1, backgroundColor: COLORS.card, borderRadius: 12, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  metricValue:   { fontSize: 15, fontWeight: '900', color: COLORS.primary },
  metricLabel:   { fontSize: 9, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase' },
  chipBar:       { maxHeight: 44, marginBottom: 4 },
  chipBarContent:{ paddingHorizontal: 12, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip:          { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#fff' },
  chipActive:    { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:      { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  chipTextActive:{ color: '#fff' },
  list:          { paddingHorizontal: 12, paddingBottom: 30, paddingTop: 4 },
  card:          { backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, gap: 8 },
  serial:        { flex: 1, fontSize: 14, fontWeight: '800', color: COLORS.primary, fontFamily: 'monospace' },
  badge:         { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:     { fontSize: 10, fontWeight: '800' },
  type:          { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
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
  chipRow:       { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  input:         { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, marginBottom: 4, backgroundColor: '#fff' },
  primaryBtn:    { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  primaryBtnText:{ color: '#fff', fontSize: 14, fontWeight: '800' },
});
