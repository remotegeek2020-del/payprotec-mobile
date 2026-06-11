import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { COLORS } from '../config';
import { Dashboard } from '../api';
import { Storage } from '../storage';

function fmt(n) {
  if (n == null || n === '') return '—';
  const num = parseFloat(n);
  if (isNaN(num)) return '—';
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000)     return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(2)}`;
}

function KpiCard({ label, value, sub }) {
  return (
    <View style={s.kpiCard}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={s.kpiValue}>{value}</Text>
      {sub ? <Text style={s.kpiSub}>{sub}</Text> : null}
    </View>
  );
}

export default function DashboardScreen({ navigation, person }) {
  const [scorecard, setScorecard] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName]           = useState(person?.name || person?.full_name || '');

  async function load() {
    setLoading(true);
    try {
      const res = await Dashboard.getScorecard();
      if (res.success) setScorecard(res.scorecard || res);
    } catch (e) { /* ignore */ }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    load();
    Storage.get('partner_name').then(n => { if (n) setName(n); });
  }, []);

  const sc = scorecard || {};
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
    >
      {/* Greeting */}
      <View style={s.greetRow}>
        <View>
          <Text style={s.greetSub}>{greeting()},</Text>
          <Text style={s.greetName} numberOfLines={1}>{name || 'Partner'}</Text>
        </View>
        {sc.tier ? (
          <View style={[s.tierBadge, { backgroundColor: tierColor(sc.tier) }]}>
            <Text style={s.tierText}>{sc.tier}</Text>
          </View>
        ) : null}
      </View>

      {loading && !refreshing
        ? <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />
        : (
          <>
            {/* KPI row */}
            <Text style={s.sectionTitle}>Performance</Text>
            <View style={s.kpiRow}>
              <KpiCard label="Merchants" value={sc.merchant_count ?? '—'} />
              <KpiCard label="30-Day Vol" value={fmt(sc.volume_30d || sc.volume_30_day)} />
              <KpiCard label="MTD Vol"    value={fmt(sc.volume_mtd)} />
            </View>
            <View style={s.kpiRow}>
              <KpiCard label="90-Day Vol" value={fmt(sc.volume_90d || sc.volume_90_day)} />
              <KpiCard label="Rank"       value={sc.rank ? `#${sc.rank}` : '—'} />
              <KpiCard label="Growth"     value={sc.growth_pct != null ? `${parseFloat(sc.growth_pct).toFixed(1)}%` : '—'} />
            </View>

            {/* Quick actions */}
            <Text style={s.sectionTitle}>Quick Actions</Text>
            <View style={s.actionsGrid}>
              <ActionBtn icon="🏪" label="My Merchants" onPress={() => navigation.navigate('Merchants')} />
              <ActionBtn icon="🎫" label="Tickets"      onPress={() => navigation.navigate('Tickets')} />
              <ActionBtn icon="💬" label="Messages"     onPress={() => navigation.navigate('Messages')} />
              <ActionBtn icon="👤" label="Profile"      onPress={() => navigation.navigate('Profile')} />
            </View>

            {/* Companies */}
            {sc.companies?.length > 0 && (
              <>
                <Text style={s.sectionTitle}>Companies</Text>
                {sc.companies.map((c, i) => (
                  <View key={c.id || i} style={s.companyRow}>
                    <Text style={s.companyName}>{c.company_name || c.name || '—'}</Text>
                    {c.merchant_count != null
                      ? <Text style={s.companyMeta}>{c.merchant_count} merchants</Text>
                      : null}
                  </View>
                ))}
              </>
            )}
          </>
        )
      }
    </ScrollView>
  );
}

function ActionBtn({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={s.actionBtn} onPress={onPress} activeOpacity={0.8}>
      <Text style={s.actionIcon}>{icon}</Text>
      <Text style={s.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function tierColor(tier) {
  const t = (tier || '').toLowerCase();
  if (t.includes('gold') || t.includes('plat')) return '#f59e0b';
  if (t.includes('silver'))                      return '#64748b';
  if (t.includes('bronze'))                      return '#92400e';
  return COLORS.primary;
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: COLORS.bg },
  scroll:       { padding: 16, paddingBottom: 40 },
  greetRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greetSub:     { fontSize: 13, color: COLORS.muted, fontWeight: '600' },
  greetName:    { fontSize: 24, fontWeight: '900', color: COLORS.text, maxWidth: 220 },
  tierBadge:    { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  tierText:     { color: '#fff', fontSize: 12, fontWeight: '800' },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 20 },
  kpiRow:       { flexDirection: 'row', gap: 10, marginBottom: 10 },
  kpiCard:      { flex: 1, backgroundColor: COLORS.card, borderRadius: 14, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  kpiLabel:     { fontSize: 10, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 },
  kpiValue:     { fontSize: 20, fontWeight: '900', color: COLORS.text },
  kpiSub:       { fontSize: 10, color: COLORS.light, marginTop: 2 },
  actionsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn:    { width: '47%', backgroundColor: COLORS.card, borderRadius: 14, padding: 18, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  actionIcon:   { fontSize: 28, marginBottom: 6 },
  actionLabel:  { fontSize: 13, fontWeight: '700', color: COLORS.text },
  companyRow:   { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  companyName:  { fontSize: 14, fontWeight: '700', color: COLORS.text },
  companyMeta:  { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
});
