import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { COLORS } from '../config';
import { Returns } from '../api';

const STATUS_COLORS = {
  open:   { bg: '#fef3c7', text: '#d97706' },
  closed: { bg: '#d1fae5', text: '#059669' },
};

function ReturnCard({ item }) {
  const isOpen = item.status?.toLowerCase() === 'open';
  const isLegacy = !!item.legacy_deployment_id;
  const isBulk = item.is_bulk;
  const statusC = STATUS_COLORS[item.status?.toLowerCase()] || STATUS_COLORS.closed;
  const serial = isBulk
    ? `${item.items?.length || 0} units`
    : (item.equipments?.serial_number || item.legacy_deployments?.serial_number || '—');

  return (
    <View style={s.card}>
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
    </View>
  );
}

export default function ReturnsScreen() {
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState([]);
  const [metrics, setMetrics]     = useState({ open: '—', defective: '—' });
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [offset, setOffset]       = useState(0);
  const [total, setTotal]         = useState(0);
  const PAGE = 20;

  async function load(q = query, off = 0, append = false) {
    setLoading(true);
    try {
      const data = await Returns.list(q, off, PAGE);
      const rows = data.data || [];
      setResults(append ? prev => [...prev, ...rows] : rows);
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
        renderItem={({ item }) => <ReturnCard item={item} />}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loading && !refreshing ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> : null}
        ListEmptyComponent={!loading ? <Text style={s.empty}>No returns found</Text> : null}
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
});
