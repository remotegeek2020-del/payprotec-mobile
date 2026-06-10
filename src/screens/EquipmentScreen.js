import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView,
} from 'react-native';
import { COLORS } from '../config';
import { Equipments } from '../api';

// Backend status values: stocked | deployed | repairing | decommissioned
const STATUS_COLORS = {
  stocked:        { bg: '#d1fae5', text: '#059669' },
  deployed:       { bg: '#dbeafe', text: '#2563eb' },
  repairing:      { bg: '#fef3c7', text: '#d97706' },
  decommissioned: { bg: '#f1f5f9', text: '#64748b' },
};

const STATUS_FILTERS = ['stocked', 'deployed', 'repairing', 'decommissioned'];

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status?.toLowerCase()] || STATUS_COLORS.decommissioned;
  return (
    <View style={[s.statusBadge, { backgroundColor: c.bg }]}>
      <Text style={[s.statusText, { color: c.text }]}>{status?.toUpperCase() || '—'}</Text>
    </View>
  );
}

function EquipmentCard({ item, onOpen }) {
  return (
    <TouchableOpacity style={s.card} onPress={() => onOpen(item)} activeOpacity={0.75}>
      <View style={s.cardTop}>
        <Text style={s.serial}>{item.serial_number || '—'}</Text>
        <StatusBadge status={item.status} />
      </View>
      <Text style={s.terminalType} numberOfLines={1}>{item.terminal_type || '—'}</Text>
      <View style={s.cardBottom}>
        <Text style={s.location} numberOfLines={1}>📍 {item.current_location || '—'}</Text>
        {item.merchants?.dba_name ? (
          <Text style={s.merchant} numberOfLines={1}>{item.merchants.dba_name}</Text>
        ) : null}
      </View>
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

function EquipmentDetailModal({ item, onClose }) {
  const [history, setHistory]               = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    setHistory([]);
    if (!item?.id) return;
    let active = true;
    (async () => {
      setLoadingHistory(true);
      try {
        const data = await Equipments.getHistory(item.id);
        if (active && data.success) setHistory(data.data || []);
      } catch {}
      if (active) setLoadingHistory(false);
    })();
    return () => { active = false; };
  }, [item?.id]);

  if (!item) return null;

  return (
    <Modal visible={!!item} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{item.serial_number || 'Equipment'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
            <DetailRow label="Status"        value={item.status} />
            <DetailRow label="Terminal Type" value={item.terminal_type} />
            <DetailRow label="Location"      value={item.current_location} />
            <DetailRow label="Condition"     value={item.condition} />
            <DetailRow label="Merchant"      value={item.merchants?.dba_name} />
            <DetailRow label="Received"      value={formatDate(item.received_date)} />
            <DetailRow label="Notes"         value={item.notes} />

            <Text style={s.sectionLabel}>History</Text>
            {loadingHistory ? (
              <ActivityIndicator color={COLORS.primary} style={{ margin: 12 }} />
            ) : history.length > 0 ? (
              history.map((log, i) => (
                <View key={log.id || i} style={s.logRow}>
                  <View style={s.logTop}>
                    <Text style={s.logAction}>{log.action || '—'}</Text>
                    <Text style={s.logDate}>{formatDate(log.created_at)}</Text>
                  </View>
                  {log.from_location || log.to_location ? (
                    <Text style={s.logMove}>
                      {log.from_location || '—'} → {log.to_location || '—'}
                    </Text>
                  ) : null}
                  {log.notes ? <Text style={s.logNotes}>{log.notes}</Text> : null}
                </View>
              ))
            ) : (
              <Text style={s.emptySmall}>No history recorded</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function EquipmentScreen() {
  const [query, setQuery]           = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [results, setResults]       = useState([]);
  const [metrics, setMetrics]       = useState({});
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage]             = useState(0);
  const [total, setTotal]           = useState(0);
  const [selected, setSelected]     = useState(null);
  const PAGE = 30;

  async function load(q = query, status = statusFilter, pg = 0, append = false) {
    setLoading(true);
    try {
      const data = await Equipments.list({ query: q, filterStatus: status || undefined, limit: PAGE, page: pg });
      const rows = data.data || [];
      setResults(prev => (append ? [...prev, ...rows] : rows));
      setTotal(data.count ?? 0);
      if (data.metrics) setMetrics(data.metrics);
      setPage(pg);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  function onSearch()  { load(query, statusFilter, 0, false); }
  function onRefresh() { setRefreshing(true); load(query, statusFilter, 0, false); }
  function loadMore()  { if (results.length < total && !loading) load(query, statusFilter, page + 1, true); }

  function toggleStatus(st) {
    const next = statusFilter === st ? null : st;
    setStatusFilter(next);
    load(query, next, 0, false);
  }

  return (
    <View style={s.container}>
      {/* Metrics */}
      <View style={s.metricsRow}>
        <View style={[s.metric, { borderLeftColor: COLORS.primary }]}>
          <Text style={[s.metricNum, { color: COLORS.primary }]}>{metrics.total ?? '—'}</Text>
          <Text style={s.metricLabel}>Total</Text>
        </View>
        <View style={[s.metric, { borderLeftColor: COLORS.success }]}>
          <Text style={[s.metricNum, { color: COLORS.success }]}>{metrics.inOffice ?? '—'}</Text>
          <Text style={s.metricLabel}>In Office</Text>
        </View>
        <View style={[s.metric, { borderLeftColor: COLORS.accent }]}>
          <Text style={[s.metricNum, { color: COLORS.accent }]}>{metrics.deployed ?? '—'}</Text>
          <Text style={s.metricLabel}>Deployed</Text>
        </View>
        <View style={[s.metric, { borderLeftColor: COLORS.warning }]}>
          <Text style={[s.metricNum, { color: COLORS.warning }]}>{metrics.inRepair ?? '—'}</Text>
          <Text style={s.metricLabel}>In Repair</Text>
        </View>
      </View>

      {/* Search */}
      <View style={s.searchBar}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Search serial or terminal type…"
          placeholderTextColor={COLORS.light}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={onSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCapitalize="none"
        />
      </View>

      {/* Status filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}>
        {STATUS_FILTERS.map(st => {
          const active = statusFilter === st;
          return (
            <TouchableOpacity key={st} style={[s.filterChip, active && s.filterChipActive]} onPress={() => toggleStatus(st)}>
              <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{st}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={results}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => <EquipmentCard item={item} onOpen={setSelected} />}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loading && !refreshing ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> : null}
        ListEmptyComponent={!loading ? <Text style={s.empty}>No equipment found</Text> : null}
      />

      <EquipmentDetailModal item={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.bg },
  metricsRow:  { flexDirection: 'row', gap: 8, padding: 14, paddingBottom: 4 },
  metric:      { flex: 1, backgroundColor: COLORS.card, borderRadius: 10, padding: 10, borderLeftWidth: 3 },
  metricNum:   { fontSize: 18, fontWeight: '900' },
  metricLabel: { fontSize: 9, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase' },
  searchBar:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, margin: 14, marginTop: 10, marginBottom: 8, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border },
  searchIcon:  { fontSize: 16, marginRight: 6 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: COLORS.text },
  filterRow:   { flexGrow: 0, marginBottom: 8 },
  filterChip:  { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#fff' },
  filterChipActive: { borderColor: COLORS.primary, backgroundColor: '#eff6ff' },
  filterChipText: { fontSize: 12, fontWeight: '700', color: COLORS.muted, textTransform: 'capitalize' },
  filterChipTextActive: { color: COLORS.primary },
  list:        { paddingHorizontal: 14, paddingBottom: 30 },
  card:        { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  serial:      { fontSize: 14, fontWeight: '800', color: COLORS.primary, fontFamily: 'monospace' },
  statusBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:  { fontSize: 10, fontWeight: '800' },
  terminalType:{ fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  cardBottom:  { flexDirection: 'row', justifyContent: 'space-between' },
  location:    { fontSize: 11, color: COLORS.muted, flex: 1 },
  merchant:    { fontSize: 11, color: COLORS.muted, maxWidth: '50%', textAlign: 'right' },
  empty:       { textAlign: 'center', color: COLORS.muted, padding: 40, fontSize: 14 },
  emptySmall:  { color: COLORS.muted, fontSize: 12, paddingVertical: 8 },

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
  logRow:      { backgroundColor: COLORS.bg, borderRadius: 8, padding: 10, marginBottom: 6 },
  logTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logAction:   { fontSize: 12, fontWeight: '800', color: COLORS.text, textTransform: 'capitalize' },
  logDate:     { fontSize: 10, color: COLORS.light },
  logMove:     { fontSize: 11, color: COLORS.primary, marginTop: 3 },
  logNotes:    { fontSize: 11, color: COLORS.muted, marginTop: 3 },
});
