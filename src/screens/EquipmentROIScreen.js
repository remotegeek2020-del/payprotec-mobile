import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { COLORS } from '../config';
import { Equipments } from '../api';

const AGE_BUCKETS = [
  { key: 'd0_30',     label: '0–30d' },
  { key: 'd31_60',    label: '31–60d' },
  { key: 'd61_90',    label: '61–90d' },
  { key: 'd91_180',   label: '91–180d' },
  { key: 'd180_plus', label: '180d+' },
];

function pct(n) {
  if (n == null || isNaN(n)) return '—';
  return `${Math.round(n)}%`;
}

function utilizationColor(rate) {
  if (rate == null) return COLORS.muted;
  if (rate >= 70) return COLORS.success;
  if (rate >= 40) return COLORS.warning;
  return COLORS.danger;
}

function StatCard({ label, value, color }) {
  return (
    <View style={[s.statCard, { borderTopColor: color }]}>
      <Text style={[s.statNum, { color }]}>{value ?? '—'}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

// Simple bar rendered with plain Views (no chart libs)
function UtilizationBar({ rate }) {
  const clamped = Math.max(0, Math.min(100, rate ?? 0));
  return (
    <View style={s.barTrack}>
      <View style={[s.barFill, { width: `${clamped}%`, backgroundColor: utilizationColor(rate) }]} />
    </View>
  );
}

function ModelCard({ model }) {
  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <Text style={s.modelName} numberOfLines={1}>{model.model || '—'}</Text>
        <Text style={[s.utilPct, { color: utilizationColor(model.utilization_rate) }]}>
          {pct(model.utilization_rate)}
        </Text>
      </View>
      <UtilizationBar rate={model.utilization_rate} />
      <View style={s.modelStatsRow}>
        <Text style={s.modelStat}>Total {model.total_units ?? 0}</Text>
        <Text style={[s.modelStat, { color: COLORS.accent }]}>Deployed {model.deployed_units ?? 0}</Text>
        <Text style={[s.modelStat, { color: COLORS.success }]}>Stocked {model.stocked_units ?? 0}</Text>
        <Text style={[s.modelStat, { color: COLORS.warning }]}>Repair {model.repair_units ?? 0}</Text>
      </View>
      <View style={s.modelStatsRow}>
        <Text style={s.modelSub}>Avg {model.avg_days_stocked ?? 0}d stocked</Text>
        <Text style={[s.modelSub, (model.idle_units ?? 0) > 0 && { color: COLORS.danger, fontWeight: '700' }]}>
          {model.idle_units ?? 0} idle
        </Text>
      </View>
    </View>
  );
}

export default function EquipmentROIScreen() {
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState(false);

  async function load(refresh = false) {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(false);
    try {
      const data = await Equipments.getRoiStats();
      if (data.success) setStats(data);
      else setError(true);
    } catch {
      setError(true);
    }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: 'center' }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  const summary = stats?.summary || {};
  const buckets = summary.stocked_age_buckets || {};
  const maxBucket = Math.max(1, ...AGE_BUCKETS.map(b => buckets[b.key] ?? 0));
  const models = stats?.model_stats || [];
  const idleSerials = stats?.idle_serials || [];
  const locations = stats?.location_breakdown || [];

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />}
    >
      {error ? <Text style={s.empty}>Could not load ROI stats. Pull to retry.</Text> : null}

      {/* Summary */}
      <Text style={s.sectionTitle}>Fleet Summary</Text>
      <View style={s.statsGrid}>
        <StatCard label="Total Fleet"  value={summary.total_fleet}                color={COLORS.primary} />
        <StatCard label="Utilization"  value={pct(summary.overall_utilization)}   color={utilizationColor(summary.overall_utilization)} />
        <StatCard label="Deployed"     value={summary.total_deployed}             color={COLORS.accent} />
        <StatCard label="Stocked"      value={summary.total_stocked}              color={COLORS.success} />
        <StatCard label="In Repair"    value={summary.total_repair}               color={COLORS.warning} />
        <StatCard label={`Idle (${stats?.idle_threshold_days ?? 90}d+)`} value={summary.total_idle} color={COLORS.danger} />
      </View>

      {/* Stocked age buckets */}
      <Text style={s.sectionTitle}>Stocked Inventory Age</Text>
      <View style={s.bucketCard}>
        {AGE_BUCKETS.map(b => {
          const val = buckets[b.key] ?? 0;
          return (
            <View key={b.key} style={s.bucketRow}>
              <Text style={s.bucketLabel}>{b.label}</Text>
              <View style={s.bucketTrack}>
                <View style={[s.bucketFill, { width: `${(val / maxBucket) * 100}%` }]} />
              </View>
              <Text style={s.bucketVal}>{val}</Text>
            </View>
          );
        })}
      </View>

      {/* Per-model breakdown */}
      <Text style={s.sectionTitle}>By Terminal Model</Text>
      {models.length > 0
        ? models.map((m, i) => <ModelCard key={m.model || i} model={m} />)
        : <Text style={s.empty}>No model data</Text>}

      {/* Idle units */}
      <Text style={s.sectionTitle}>Idle Units ({idleSerials.length})</Text>
      {idleSerials.length > 0 ? (
        <View style={s.tableCard}>
          {idleSerials.map((u, i) => (
            <View key={u.serial_number || i} style={[s.tableRow, i === idleSerials.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.idleSerial}>{u.serial_number || '—'}</Text>
                <Text style={s.idleSub}>{u.model || '—'} • {u.location || '—'}</Text>
              </View>
              <Text style={s.idleDays}>{u.days_idle ?? '—'}d</Text>
            </View>
          ))}
        </View>
      ) : <Text style={s.empty}>No idle units 🎉</Text>}

      {/* Location breakdown */}
      <Text style={s.sectionTitle}>By Location</Text>
      {locations.length > 0 ? (
        <View style={s.tableCard}>
          {locations.map((loc, i) => (
            <View key={loc.location || i} style={[s.tableRow, i === locations.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={s.locName} numberOfLines={1}>{loc.location || '—'}</Text>
              <View style={s.locStats}>
                <Text style={s.locStat}>{loc.total ?? 0} total</Text>
                <Text style={[s.locStat, { color: COLORS.accent }]}>{loc.deployed ?? 0} dep</Text>
                <Text style={[s.locStat, { color: COLORS.success }]}>{loc.stocked ?? 0} stk</Text>
                <Text style={[s.locStat, { color: COLORS.warning }]}>{loc.repair ?? 0} rep</Text>
              </View>
            </View>
          ))}
        </View>
      ) : <Text style={s.empty}>No location data</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.bg },
  content:     { padding: 14, paddingBottom: 40 },
  sectionTitle:{ fontSize: 12, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 14 },
  statsGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard:    { flexBasis: '30%', flexGrow: 1, backgroundColor: COLORS.card, borderRadius: 12, padding: 12, borderTopWidth: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statNum:     { fontSize: 20, fontWeight: '900', marginBottom: 2 },
  statLabel:   { fontSize: 10, color: COLORS.muted, fontWeight: '600' },

  bucketCard:  { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  bucketRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  bucketLabel: { width: 62, fontSize: 11, fontWeight: '700', color: COLORS.muted },
  bucketTrack: { flex: 1, height: 10, backgroundColor: COLORS.bg, borderRadius: 5, overflow: 'hidden', marginHorizontal: 8 },
  bucketFill:  { height: '100%', backgroundColor: COLORS.primary, borderRadius: 5 },
  bucketVal:   { width: 34, fontSize: 12, fontWeight: '800', color: COLORS.text, textAlign: 'right' },

  card:        { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modelName:   { fontSize: 14, fontWeight: '800', color: COLORS.text, flex: 1 },
  utilPct:     { fontSize: 16, fontWeight: '900', marginLeft: 8 },
  barTrack:    { height: 8, backgroundColor: COLORS.bg, borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  barFill:     { height: '100%', borderRadius: 4 },
  modelStatsRow:{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  modelStat:   { fontSize: 11, fontWeight: '700', color: COLORS.muted },
  modelSub:    { fontSize: 11, color: COLORS.light },

  tableCard:   { backgroundColor: COLORS.card, borderRadius: 12, paddingHorizontal: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  tableRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  idleSerial:  { fontSize: 12, fontWeight: '800', color: COLORS.primary, fontFamily: 'monospace' },
  idleSub:     { fontSize: 10, color: COLORS.muted, marginTop: 2 },
  idleDays:    { fontSize: 13, fontWeight: '900', color: COLORS.danger, marginLeft: 10 },
  locName:     { fontSize: 12, fontWeight: '700', color: COLORS.text, flex: 1 },
  locStats:    { flexDirection: 'row', gap: 8 },
  locStat:     { fontSize: 10, fontWeight: '700', color: COLORS.muted },

  empty:       { textAlign: 'center', color: COLORS.muted, padding: 20, fontSize: 13 },
});
