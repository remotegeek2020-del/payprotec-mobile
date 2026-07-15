import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal,
} from 'react-native';
import { COLORS } from '../config';
import { Dashboard, Notifications, Marketing } from '../api';
import { Storage } from '../storage';
import { withCache, OfflineBanner } from '../offline';
import AnnouncementCards from '../components/AnnouncementCards';

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
  const [trends, setTrends]       = useState(null);
  const [newEnrollments, setNewEnrollments] = useState([]);
  const [openRmas, setOpenRmas]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName]           = useState(person?.name || person?.full_name || '');

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [showNotifs, setShowNotifs]       = useState(false);

  // Offline
  const [offline, setOffline]   = useState(false);
  const [cachedAt, setCachedAt] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [res, overview, notifs] = await Promise.all([
        withCache('partner_dashboard', () => Dashboard.getScorecard()),
        // get_dashboard always reports open_rmas: 0 — get_overview has the real count
        Dashboard.getOverview().catch(() => null),
        Notifications.get().catch(() => null),
      ]);
      if (res.success) {
        setScorecard(res.scorecard || res);
        setTrends(res.trends || null);
        setNewEnrollments(res.newEnrollments || []);
        setOffline(!!res.fromCache);
        setCachedAt(res.cachedAt || null);
      }
      if (overview?.success) setOpenRmas(overview.data?.open_rmas ?? 0);
      if (notifs?.success) {
        setNotifications(notifs.notifications || []);
        setUnreadCount(notifs.unread || 0);
      }
    } catch (e) { /* ignore */ }
    setLoading(false);
    setRefreshing(false);
  }

  async function openNotifications() {
    setShowNotifs(true);
    if (unreadCount > 0) {
      try {
        await Notifications.markRead();
        setUnreadCount(0);
        setNotifications(list => list.map(n => ({ ...n, is_read: true })));
      } catch (e) { /* ignore */ }
    }
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {sc.tier ? (
            <View style={[s.tierBadge, { backgroundColor: tierColor(sc.tier) }]}>
              <Text style={s.tierText}>{sc.tier}</Text>
            </View>
          ) : null}
          <TouchableOpacity style={s.bellBtn} onPress={openNotifications} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.bellIcon}>🔔</Text>
            {unreadCount > 0 && (
              <View style={s.bellBadge}>
                <Text style={s.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {offline && <OfflineBanner cachedAt={cachedAt} />}

      <AnnouncementCards api={Marketing} />

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
              <KpiCard label="Open RMAs"  value={openRmas != null ? openRmas : (sc.open_rmas ?? '—')} />
            </View>

            {/* Merchant trends */}
            {trends ? (
              <>
                <Text style={s.sectionTitle}>Merchant Trends</Text>
                <View style={s.trendRow}>
                  <TrendChip label="Growth"  value={trends.growth}  color="#059669" bg="#d1fae5" />
                  <TrendChip label="Stable"  value={trends.stable}  color="#1d4ed8" bg="#dbeafe" />
                  <TrendChip label="At Risk" value={trends.at_risk} color="#dc2626" bg="#fee2e2" />
                  <TrendChip label="No Data" value={trends.no_data} color="#64748b" bg="#f1f5f9" />
                </View>
              </>
            ) : null}

            {/* New this week */}
            <Text style={s.sectionTitle}>New This Week</Text>
            {newEnrollments.length === 0 ? (
              <View style={s.emptyCard}>
                <Text style={s.emptyText}>No new enrollments this week</Text>
              </View>
            ) : (
              newEnrollments.map((m, i) => (
                <View key={m.id || i} style={s.enrollRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.enrollName} numberOfLines={1}>{m.dba_name || '—'}</Text>
                    <Text style={s.enrollMeta}>
                      {m.enrollment_date ? new Date(m.enrollment_date).toLocaleDateString() : '—'}
                      {m.merchant_id ? ` · MID ${m.merchant_id}` : ''}
                    </Text>
                  </View>
                  <View style={s.enrollBadge}>
                    <Text style={s.enrollBadgeText}>{(m.account_status || 'Pending').toUpperCase()}</Text>
                  </View>
                </View>
              ))
            )}

            {/* Quick actions */}
            <Text style={s.sectionTitle}>Quick Actions</Text>
            <View style={s.actionsGrid}>
              <ActionBtn icon="🏪" label="My Merchants" onPress={() => navigation.navigate('Merchants')} />
              <ActionBtn icon="💎" label="My Prime49"   onPress={() => navigation.navigate('Prime49')} />
              <ActionBtn icon="🎫" label="Tickets"      onPress={() => navigation.navigate('Tickets')} />
              <ActionBtn icon="💬" label="Messages"     onPress={() => navigation.navigate('Messages')} />
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

      {/* Notifications modal */}
      <Modal visible={showNotifs} animationType="slide" transparent onRequestClose={() => setShowNotifs(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotifs(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              {notifications.length === 0 ? (
                <Text style={s.emptyText}>No notifications yet</Text>
              ) : (
                notifications.map((n, i) => (
                  <View key={n.id || i} style={[s.notifRow, !n.is_read && s.notifUnread]}>
                    <Text style={s.notifTitle}>{n.title || n.type || 'Notification'}</Text>
                    {n.body ? <Text style={s.notifBody}>{n.body}</Text> : null}
                    <Text style={s.notifMeta}>
                      {n.actor_name ? `${n.actor_name} · ` : ''}
                      {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function TrendChip({ label, value, color, bg }) {
  return (
    <View style={[s.trendChip, { backgroundColor: bg }]}>
      <Text style={[s.trendValue, { color }]}>{value ?? 0}</Text>
      <Text style={[s.trendLabel, { color }]}>{label}</Text>
    </View>
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
  // Notifications bell
  bellBtn:      { position: 'relative', padding: 4 },
  bellIcon:     { fontSize: 22 },
  bellBadge:    { position: 'absolute', top: -2, right: -4, backgroundColor: COLORS.danger, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  bellBadgeText:{ color: '#fff', fontSize: 10, fontWeight: '800' },
  // Trends
  trendRow:     { flexDirection: 'row', gap: 8 },
  trendChip:    { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  trendValue:   { fontSize: 18, fontWeight: '900' },
  trendLabel:   { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginTop: 2 },
  // New enrollments
  emptyCard:    { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, alignItems: 'center' },
  emptyText:    { fontSize: 13, color: COLORS.muted, textAlign: 'center', padding: 8 },
  enrollRow:    { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  enrollName:   { fontSize: 14, fontWeight: '700', color: COLORS.text },
  enrollMeta:   { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  enrollBadge:  { backgroundColor: '#dbeafe', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  enrollBadgeText: { fontSize: 10, fontWeight: '800', color: '#1d4ed8' },
  // Notifications modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard:    { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '75%' },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle:   { fontSize: 18, fontWeight: '900', color: COLORS.text },
  modalClose:   { fontSize: 18, color: COLORS.muted, fontWeight: '700' },
  notifRow:     { backgroundColor: COLORS.bg, borderRadius: 12, padding: 12, marginBottom: 8 },
  notifUnread:  { borderLeftWidth: 3, borderLeftColor: COLORS.primary },
  notifTitle:   { fontSize: 14, fontWeight: '800', color: COLORS.text },
  notifBody:    { fontSize: 13, color: COLORS.muted, marginTop: 3, lineHeight: 18 },
  notifMeta:    { fontSize: 11, color: COLORS.light, marginTop: 5 },
});
