import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../../config';
import { staffRequest } from '../../staff-api';

// ── API (api/admin-dashboard.js) ──────────────────────────────────────────────
const Api = {
  getKpis:              () => staffRequest('/api/admin-dashboard', { action: 'get_kpis' }),
  getAtRisk:            () => staffRequest('/api/admin-dashboard', { action: 'get_at_risk' }),
  getRecentDeployments: () => staffRequest('/api/admin-dashboard', { action: 'get_recent_deployments' }),
  getRecentReturns:     () => staffRequest('/api/admin-dashboard', { action: 'get_recent_returns' }),
  getRecentMerchants:   () => staffRequest('/api/admin-dashboard', { action: 'get_recent_merchants' }),
  getPriorityTickets:   () => staffRequest('/api/admin-dashboard', { action: 'get_priority_tickets', priority: 'all' }),
  getOpenTasks:         () => staffRequest('/api/admin-dashboard', { action: 'get_open_tasks' }),
};

function fmt(n) {
  if (n == null) return '—';
  const num = parseFloat(n);
  if (isNaN(num)) return '—';
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000)     return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(2)}`;
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_COLORS = {
  approved:    { bg: '#d1fae5', text: '#059669' },
  open:        { bg: '#dbeafe', text: '#1d4ed8' },
  'in transit':{ bg: '#fef3c7', text: '#d97706' },
  pending:     { bg: '#fef3c7', text: '#d97706' },
  enrollment:  { bg: '#dbeafe', text: '#1d4ed8' },
  closed:      { bg: '#f1f5f9', text: '#64748b' },
  declined:    { bg: '#fee2e2', text: '#dc2626' },
};
function statusColor(st) {
  return STATUS_COLORS[(st || '').toLowerCase()] || STATUS_COLORS.pending;
}

const PRIORITY_COLORS = {
  urgent: { bg: '#fee2e2', text: '#dc2626' },
  high:   { bg: '#fee2e2', text: '#dc2626' },
  normal: { bg: '#fef3c7', text: '#d97706' },
  low:    { bg: '#d1fae5', text: '#059669' },
};
function priorityColor(p) {
  return PRIORITY_COLORS[(p || '').toLowerCase()] || PRIORITY_COLORS.normal;
}

function KpiCard({ label, value, icon, color }) {
  return (
    <View style={s.kpiCard}>
      <Text style={s.kpiIcon}>{icon}</Text>
      <Text style={[s.kpiValue, color ? { color } : null]}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, icon, children }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{icon}  {title}</Text>
      {children}
    </View>
  );
}

function Badge({ label, bg, color }) {
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.badgeText, { color }]}>{(label || '—').toUpperCase()}</Text>
    </View>
  );
}

function EmptyRow({ text }) {
  return <Text style={s.emptySmall}>{text}</Text>;
}

export default function StaffDashboardScreen({ navigation, user }) {
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [kpis, setKpis]               = useState(null);
  const [atRisk, setAtRisk]           = useState([]);
  const [deployments, setDeployments] = useState([]);
  const [returns, setReturns]         = useState([]);
  const [merchants, setMerchants]     = useState([]);
  const [tickets, setTickets]         = useState([]);
  const [tasks, setTasks]             = useState([]);

  const loadAll = useCallback(async () => {
    try {
      const [k, ar, dep, ret, mer, tic, tas] = await Promise.all([
        Api.getKpis().catch(() => null),
        Api.getAtRisk().catch(() => null),
        Api.getRecentDeployments().catch(() => null),
        Api.getRecentReturns().catch(() => null),
        Api.getRecentMerchants().catch(() => null),
        Api.getPriorityTickets().catch(() => null),
        Api.getOpenTasks().catch(() => null),
      ]);
      if (k?.success)   setKpis(k.kpis);
      if (ar?.success)  setAtRisk(ar.data || []);
      if (dep?.success) setDeployments(dep.data || []);
      if (ret?.success) setReturns(ret.data || []);
      if (mer?.success) setMerchants(mer.data || []);
      if (tic?.success) setTickets(tic.data || []);
      if (tas?.success) setTasks(tas.data || []);
    } catch (e) { /* fail quietly (incl. sessionExpired) */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const firstName = user?.first_name || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); loadAll(); }}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* Greeting */}
      <Text style={s.greeting}>{greeting}, {firstName} 👋</Text>
      <Text style={s.subGreeting}>Here's what's happening today</Text>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* KPI cards */}
          {kpis ? (
            <View style={s.kpiGrid}>
              <KpiCard icon="✅" label="Approved"      value={kpis.approved} color={COLORS.success} />
              <KpiCard icon="⏳" label="Pending"       value={kpis.pending} color={COLORS.warning} />
              <KpiCard icon="💰" label="MTD Volume"    value={fmt(kpis.total_mtd)} />
              <KpiCard icon="📈" label="90D Volume"    value={fmt(kpis.total_90d)} />
              <KpiCard icon="🚚" label="Deployments"   value={kpis.active_deployments} />
              <KpiCard icon="↩️" label="Open RMAs"     value={kpis.open_rmas} />
              <KpiCard icon="🎫" label="Open Tickets"  value={kpis.open_tickets} />
              <KpiCard icon="🗂️" label="Open Tasks"    value={kpis.open_tasks} />
              <KpiCard icon="🆕" label="New This Week" value={kpis.new_this_week} color={COLORS.accent} />
              <KpiCard icon="📦" label="In Stock"      value={kpis.equipment?.stocked ?? '—'} />
            </View>
          ) : (
            <EmptyRow text="KPIs unavailable" />
          )}

          {/* At-risk merchants */}
          <Section title="At-Risk Merchants" icon="⚠️">
            {atRisk.length === 0 ? <EmptyRow text="No at-risk merchants — great!" /> :
              atRisk.slice(0, 5).map(m => (
                <View key={m.merchant_id} style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle} numberOfLines={1}>{m.dba_name || '—'}</Text>
                    <Text style={s.rowMeta}>{m.agent_name || m.agent_id || '—'} · Last batch {fmtDate(m.last_batch_date)}</Text>
                  </View>
                  <View style={s.dropPill}>
                    <Text style={s.dropPillText}>-{m.drop_pct}%</Text>
                  </View>
                </View>
              ))}
          </Section>

          {/* Priority tickets */}
          <Section title="Priority Tickets" icon="🎫">
            {tickets.length === 0 ? <EmptyRow text="No priority tickets" /> :
              tickets.slice(0, 5).map(t => {
                const pc = priorityColor(t.priority);
                return (
                  <View key={t.id} style={s.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowTitle} numberOfLines={1}>{t.subject || t.ticket_number || '—'}</Text>
                      <Text style={s.rowMeta}>
                        {t.ticket_number ? `${t.ticket_number} · ` : ''}
                        {t.merchants?.dba_name || t.persons?.full_name || '—'} · {fmtDate(t.created_at)}
                      </Text>
                    </View>
                    <Badge label={t.priority || 'Normal'} bg={pc.bg} color={pc.text} />
                  </View>
                );
              })}
          </Section>

          {/* Open tasks */}
          <Section title="Open Tasks" icon="🗂️">
            {tasks.length === 0 ? <EmptyRow text="No open tasks" /> :
              tasks.slice(0, 5).map(t => (
                <View key={t.id} style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle} numberOfLines={1}>{t.title || '—'}</Text>
                    <Text style={s.rowMeta}>
                      {t.merchants?.dba_name ? `${t.merchants.dba_name} · ` : ''}
                      {t.due_date ? `Due ${fmtDate(t.due_date)}` : 'No due date'}
                    </Text>
                  </View>
                  <Badge label={t.status || 'open'} bg="#dbeafe" color="#1d4ed8" />
                </View>
              ))}
          </Section>

          {/* Recent deployments */}
          <Section title="Recent Deployments" icon="🚚">
            {deployments.length === 0 ? <EmptyRow text="No recent deployments" /> :
              deployments.slice(0, 5).map(d => {
                const sc = statusColor(d.status);
                return (
                  <View key={d.id} style={s.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowTitle} numberOfLines={1}>
                        {d.deployment_id || '—'} · {d.merchants?.dba_name || '—'}
                      </Text>
                      <Text style={s.rowMeta}>
                        {d.equipments?.terminal_type ? `${d.equipments.terminal_type} · ` : ''}
                        {fmtDate(d.created_at)}
                      </Text>
                    </View>
                    <Badge label={d.status || '—'} bg={sc.bg} color={sc.text} />
                  </View>
                );
              })}
          </Section>

          {/* Recent returns */}
          <Section title="Recent Returns" icon="↩️">
            {returns.length === 0 ? <EmptyRow text="No recent returns" /> :
              returns.slice(0, 5).map(r => {
                const sc = statusColor(r.status);
                return (
                  <View key={r.id} style={s.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowTitle} numberOfLines={1}>
                        {r.return_id || '—'} · {r.merchants?.dba_name || '—'}
                      </Text>
                      <Text style={s.rowMeta}>
                        {r.equipments?.terminal_type ? `${r.equipments.terminal_type} · ` : ''}
                        {r.return_reason ? `${r.return_reason} · ` : ''}
                        {fmtDate(r.return_date_initiated)}
                      </Text>
                    </View>
                    <Badge label={r.status || '—'} bg={sc.bg} color={sc.text} />
                  </View>
                );
              })}
          </Section>

          {/* Recent merchants */}
          <Section title="Recent Merchants" icon="🆕">
            {merchants.length === 0 ? <EmptyRow text="No recent merchants" /> :
              merchants.slice(0, 5).map(m => {
                const sc = statusColor(m.account_status);
                return (
                  <View key={m.merchant_id} style={s.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowTitle} numberOfLines={1}>{m.dba_name || '—'}</Text>
                      <Text style={s.rowMeta}>
                        {m.agent_name ? `${m.agent_name} · ` : ''}
                        {m.merchant_city ? `${m.merchant_city}${m.merchant_state ? `, ${m.merchant_state}` : ''} · ` : ''}
                        {fmtDate(m.enrollment_date)}
                      </Text>
                    </View>
                    <Badge label={m.account_status || 'Pending'} bg={sc.bg} color={sc.text} />
                  </View>
                );
              })}
          </Section>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: COLORS.bg },
  content:      { padding: 16, paddingBottom: 40 },
  greeting:     { fontSize: 22, fontWeight: '900', color: COLORS.text, marginTop: 8 },
  subGreeting:  { fontSize: 13, color: COLORS.muted, marginTop: 2, marginBottom: 14 },
  kpiGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6 },
  kpiCard:      { backgroundColor: COLORS.card, borderRadius: 14, padding: 12, width: '47.5%', flexGrow: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  kpiIcon:      { fontSize: 18, marginBottom: 4 },
  kpiValue:     { fontSize: 19, fontWeight: '900', color: COLORS.text },
  kpiLabel:     { fontSize: 10, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 },
  section:      { marginTop: 18 },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: COLORS.text, marginBottom: 8 },
  row:          { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, padding: 12, marginBottom: 8, gap: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  rowTitle:     { fontSize: 13, fontWeight: '700', color: COLORS.text },
  rowMeta:      { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  badge:        { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:    { fontSize: 9, fontWeight: '800' },
  dropPill:     { backgroundColor: '#fee2e2', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  dropPillText: { color: COLORS.danger, fontWeight: '900', fontSize: 12 },
  emptySmall:   { color: COLORS.muted, fontSize: 12, paddingVertical: 8, paddingHorizontal: 2 },
});
