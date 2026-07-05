import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { COLORS } from '../../config';
import { StaffAnalytics } from '../../staff-api';

const SEG_COLORS = ['#004990', '#0d9488', '#d97706', '#7c3aed', '#dc2626', '#64748b'];

function shortDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

// Grouped mini bar chart: two series over the same week labels.
function DualBars({ labels, a, b, aColor, bColor, aName, bName }) {
  const max = Math.max(1, ...(a || []), ...(b || []));
  return (
    <View style={s.chartCard}>
      <View style={s.legendRow}>
        <View style={s.legendItem}><View style={[s.dot, { backgroundColor: aColor }]} /><Text style={s.legendText}>{aName}</Text></View>
        <View style={s.legendItem}><View style={[s.dot, { backgroundColor: bColor }]} /><Text style={s.legendText}>{bName}</Text></View>
      </View>
      <View style={s.barsRow}>
        {(labels || []).map((wk, i) => (
          <View key={i} style={s.barCol}>
            <View style={s.barPair}>
              <View style={[s.bar, { height: `${((a?.[i] || 0) / max) * 100}%`, backgroundColor: aColor }]} />
              <View style={[s.bar, { height: `${((b?.[i] || 0) / max) * 100}%`, backgroundColor: bColor }]} />
            </View>
            {i % 2 === 0 ? <Text style={s.barLabel}>{shortDate(wk)}</Text> : <Text style={s.barLabel}> </Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

// Single-series mini bar chart (e.g. new merchants monthly).
function SingleBars({ labels, values, color }) {
  const max = Math.max(1, ...(values || []));
  return (
    <View style={s.chartCard}>
      <View style={s.barsRow}>
        {(values || []).map((v, i) => (
          <View key={i} style={s.barCol}>
            <Text style={s.barValueTop}>{v || 0}</Text>
            <View style={s.barPairSingle}>
              <View style={[s.bar, { height: `${((v || 0) / max) * 100}%`, backgroundColor: color, minHeight: v ? 3 : 0 }]} />
            </View>
            <Text style={s.barLabel}>{labels?.[i] || ''}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Segmented breakdown bar with legend + counts.
function Breakdown({ title, data }) {
  const entries = Object.entries(data || {});
  const total = entries.reduce((sum, [, v]) => sum + (parseInt(v) || 0), 0);
  return (
    <View style={s.chartCard}>
      <Text style={s.chartTitle}>{title}</Text>
      <View style={s.segBar}>
        {total === 0
          ? <View style={[s.segEmpty]} />
          : entries.map(([k, v], i) => {
              const pct = ((parseInt(v) || 0) / total) * 100;
              if (pct === 0) return null;
              return <View key={k} style={{ width: `${pct}%`, backgroundColor: SEG_COLORS[i % SEG_COLORS.length] }} />;
            })
        }
      </View>
      <View style={s.segLegend}>
        {entries.map(([k, v], i) => (
          <View key={k} style={s.segLegendItem}>
            <View style={[s.dot, { backgroundColor: SEG_COLORS[i % SEG_COLORS.length] }]} />
            <Text style={s.segLegendText}>{k} <Text style={s.segLegendCount}>{v}</Text></Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Kpi({ label, value }) {
  return (
    <View style={s.kpi}>
      <Text style={s.kpiVal}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
    </View>
  );
}

export default function StaffAnalyticsScreen() {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await StaffAnalytics.overview();
      if (res.success) setData(res);
    } catch (e) { /* ignore */ }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  const k = data?.kpis || {};
  const series = data?.series || {};
  const bd = data?.breakdowns || {};
  const nm = data?.new_merchants_monthly || {};

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
    >
      {loading && !data
        ? <ActivityIndicator color={COLORS.primary} style={{ margin: 40 }} />
        : (
          <>
            <View style={s.kpiGrid}>
              <Kpi label="Open Tickets"    value={k.open_tickets ?? '—'} />
              <Kpi label="Open Deploys"    value={k.open_deployments ?? '—'} />
              <Kpi label="Open RMAs"       value={k.open_returns ?? '—'} />
              <Kpi label="Units Deployed"  value={k.equip_deployed ?? '—'} />
              <Kpi label="Units Stocked"   value={k.equip_stocked ?? '—'} />
              <Kpi label="Utilization"     value={k.utilization_pct != null ? `${k.utilization_pct}%` : '—'} />
              <Kpi label="Avg Resolve"     value={k.avg_ticket_resolution_h != null ? `${k.avg_ticket_resolution_h}h` : '—'} />
            </View>

            <Text style={s.sectionTitle}>Deployments vs Returns · 13 wk</Text>
            <DualBars labels={series.weeks} a={series.deployments} b={series.returns}
              aColor="#004990" bColor="#d97706" aName="Deployments" bName="Returns" />

            <Text style={s.sectionTitle}>Tickets Created vs Resolved · 13 wk</Text>
            <DualBars labels={series.weeks} a={series.tickets_created} b={series.tickets_resolved}
              aColor="#7c3aed" bColor="#0d9488" aName="Created" bName="Resolved" />

            <Text style={s.sectionTitle}>New Merchants · 6 mo</Text>
            <SingleBars labels={nm.labels} values={nm.counts} color="#004990" />

            <Text style={s.sectionTitle}>Breakdowns</Text>
            <Breakdown title="Equipment Status"    data={bd.equipment_status} />
            <Breakdown title="Deployments by Status" data={bd.deployments_status} />
            <Breakdown title="Tickets by Status"   data={bd.tickets_status} />
            <Breakdown title="Returns by Status"   data={bd.returns_status} />
          </>
        )
      }
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: COLORS.bg },
  scroll:      { padding: 16, paddingBottom: 40 },
  kpiGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi:         { width: '31.5%', backgroundColor: COLORS.card, borderRadius: 12, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  kpiVal:      { fontSize: 19, fontWeight: '900', color: COLORS.text },
  kpiLabel:    { fontSize: 9.5, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.2, marginTop: 3, textAlign: 'center' },
  sectionTitle:{ fontSize: 12, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 22 },
  chartCard:   { backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  chartTitle:  { fontSize: 13, fontWeight: '800', color: COLORS.text, marginBottom: 10 },
  legendRow:   { flexDirection: 'row', gap: 16, marginBottom: 10 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText:  { fontSize: 11, color: COLORS.muted, fontWeight: '700' },
  dot:         { width: 9, height: 9, borderRadius: 5 },
  barsRow:     { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 2 },
  barCol:      { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barPair:     { flexDirection: 'row', alignItems: 'flex-end', gap: 1, height: '82%', width: '100%', justifyContent: 'center' },
  barPairSingle: { alignItems: 'flex-end', height: '72%', width: '100%', justifyContent: 'flex-end', flexDirection: 'row' },
  bar:         { width: 5, borderTopLeftRadius: 2, borderTopRightRadius: 2, alignSelf: 'flex-end' },
  barLabel:    { fontSize: 8, color: COLORS.light, marginTop: 3 },
  barValueTop: { fontSize: 9, color: COLORS.muted, fontWeight: '700', marginBottom: 2 },
  segBar:      { flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden', backgroundColor: COLORS.bg },
  segEmpty:    { flex: 1, backgroundColor: COLORS.border },
  segLegend:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  segLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  segLegendText: { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
  segLegendCount:{ fontSize: 11, color: COLORS.text, fontWeight: '800' },
});
