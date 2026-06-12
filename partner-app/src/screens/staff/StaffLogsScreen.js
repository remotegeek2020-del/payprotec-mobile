import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, ScrollView,
} from 'react-native';
import { COLORS } from '../../config';
import { staffRequest } from '../../staff-api';

const CATEGORIES = ['auth', 'merchants', 'deployments', 'returns', 'inventory', 'tasks', 'tickets', 'users', 'partners', 'general'];
const SEVERITIES = ['info', 'warning', 'critical'];

const SEV_COLORS = {
  info:     { bg: '#dbeafe', text: '#1d4ed8' },
  warning:  { bg: '#fef3c7', text: '#d97706' },
  critical: { bg: '#fee2e2', text: '#dc2626' },
};

const LIMIT = 50;

// GET /api/logs?page&limit&search&category&severity
function fetchLogs({ page, search, category, severity }) {
  return staffRequest('/api/logs', null, {
    method: 'GET',
    query: { page, limit: LIMIT, search, category, severity },
  });
}

function formatTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return `${dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

export default function StaffLogsScreen() {
  const [logs, setLogs]           = useState([]);
  const [page, setPage]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]       = useState('');
  const [category, setCategory]   = useState('');
  const [severity, setSeverity]   = useState('');
  const debounceRef = useRef(null);

  async function load(pageNum, { append = false, q = search, cat = category, sev = severity } = {}) {
    setLoading(true);
    try {
      const res = await fetchLogs({ page: pageNum, search: q.trim(), category: cat, severity: sev });
      if (res.success) {
        setLogs(prev => append ? [...prev, ...(res.data || [])] : (res.data || []));
        setPage(pageNum);
        setTotalPages(res.total_pages || 1);
      }
    } catch (e) { /* ignore */ }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(0); }, []);

  function onSearchChange(text) {
    setSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(0, { q: text }), 450);
  }

  function setCat(c) {
    const next = category === c ? '' : c;
    setCategory(next);
    load(0, { cat: next });
  }

  function setSev(sv) {
    const next = severity === sv ? '' : sv;
    setSeverity(next);
    load(0, { sev: next });
  }

  function loadMore() {
    if (!loading && page + 1 < totalPages) load(page + 1, { append: true });
  }

  return (
    <View style={s.root}>
      <View style={s.searchBar}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Search email, action, status…"
          placeholderTextColor={COLORS.light}
          value={search}
          onChangeText={onSearchChange}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>

      <View style={{ maxHeight: 44 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipBar}>
          {SEVERITIES.map(sv => {
            const c = SEV_COLORS[sv];
            const active = severity === sv;
            return (
              <TouchableOpacity key={sv} style={[s.chip, active && { backgroundColor: c.bg, borderColor: c.text }]} onPress={() => setSev(sv)}>
                <Text style={[s.chipText, active && { color: c.text }]}>{sv}</Text>
              </TouchableOpacity>
            );
          })}
          <View style={s.chipDivider} />
          {CATEGORIES.map(c => (
            <TouchableOpacity key={c} style={[s.chip, category === c && s.chipActive]} onPress={() => setCat(c)}>
              <Text style={[s.chipText, category === c && s.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={logs}
        keyExtractor={(item, i) => String(item.id || i)}
        renderItem={({ item }) => {
          const sev = SEV_COLORS[(item.severity || 'info').toLowerCase()] || SEV_COLORS.info;
          const ok = (item.status || '').toLowerCase() === 'success';
          return (
            <View style={s.card}>
              <View style={s.cardTop}>
                <Text style={s.user} numberOfLines={1}>{item.user_name || item.email || 'System'}</Text>
                <View style={[s.badge, { backgroundColor: sev.bg }]}>
                  <Text style={[s.badgeText, { color: sev.text }]}>{(item.severity || 'info').toUpperCase()}</Text>
                </View>
              </View>
              <Text style={s.action}>{item.action || '—'}</Text>
              <View style={s.cardBottom}>
                <Text style={[s.status, { color: ok ? COLORS.success : COLORS.danger }]}>
                  {ok ? '✓' : '✗'} {(item.status || '—').toUpperCase()}
                </Text>
                {item.category ? <Text style={s.meta}>{item.category}</Text> : null}
                <Text style={s.time}>{formatTime(item.created_at)}</Text>
              </View>
            </View>
          );
        }}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(0); }} tintColor={COLORS.primary} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={loading ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> : null}
        ListEmptyComponent={!loading ? <Text style={s.empty}>No log entries found</Text> : null}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: COLORS.bg },
  searchBar:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, margin: 12, marginBottom: 6, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border },
  searchIcon:  { fontSize: 16, marginRight: 6 },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 15, color: COLORS.text },
  chipBar:     { gap: 8, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center' },
  chip:        { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  chipActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:    { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  chipTextActive: { color: '#fff' },
  chipDivider: { width: 1, height: 20, backgroundColor: COLORS.border },
  list:        { paddingHorizontal: 12, paddingBottom: 30, paddingTop: 4 },
  card:        { backgroundColor: COLORS.card, borderRadius: 12, padding: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 },
  user:        { flex: 1, fontSize: 13, fontWeight: '800', color: COLORS.primary },
  badge:       { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:   { fontSize: 9, fontWeight: '800' },
  action:      { fontSize: 13, color: COLORS.text, lineHeight: 18, marginBottom: 6 },
  cardBottom:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  status:      { fontSize: 11, fontWeight: '800' },
  meta:        { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
  time:        { fontSize: 11, color: COLORS.light, marginLeft: 'auto' },
  empty:       { textAlign: 'center', color: COLORS.muted, padding: 40, fontSize: 14 },
});
