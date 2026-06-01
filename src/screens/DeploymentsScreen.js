import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { COLORS } from '../config';
import { Deployments } from '../api';

const STATUS_COLORS = {
  'open':       { bg: '#dbeafe', text: '#1d4ed8' },
  'in transit': { bg: '#fef3c7', text: '#d97706' },
  'closed':     { bg: '#d1fae5', text: '#059669' },
};

function DeploymentCard({ item }) {
  const statusKey = item.status?.toLowerCase();
  const statusC   = STATUS_COLORS[statusKey] || { bg: '#f1f5f9', text: '#64748b' };
  const isBulk    = item.is_bulk;
  const serial    = isBulk
    ? `${item.items?.length || 0} units`
    : (item.equipments?.serial_number || '—');

  return (
    <View style={s.card}>
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
    </View>
  );
}

export default function DeploymentsScreen() {
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState([]);
  const [metrics, setMetrics]     = useState({ active: '—', total: '—' });
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage]           = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  async function load(q = query, pg = 1, append = false) {
    setLoading(true);
    try {
      const data = await Deployments.list(q, pg, 20);
      const rows = data.data || [];
      setResults(append ? prev => [...prev, ...rows] : rows);
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
        renderItem={({ item }) => <DeploymentCard item={item} />}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loading && !refreshing ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> : null}
        ListEmptyComponent={!loading ? <Text style={s.empty}>No deployments found</Text> : null}
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
  depId:       { fontSize: 13, fontWeight: '800', color: COLORS.primaryDk, fontFamily: 'monospace' },
  badge:       { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:   { fontSize: 10, fontWeight: '800' },
  merchant:    { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  cardBottom:  { flexDirection: 'row', justifyContent: 'space-between' },
  serial:      { fontSize: 11, color: COLORS.primary, fontFamily: 'monospace' },
  date:        { fontSize: 11, color: COLORS.muted },
  audit:       { fontSize: 10, color: COLORS.light, marginTop: 3 },
  empty:       { textAlign: 'center', color: COLORS.muted, padding: 40, fontSize: 14 },
});
