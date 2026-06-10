import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { COLORS } from '../config';
import { Dashboard, Auth, getUserPerms } from '../api';
import { Storage } from '../storage';

function StatCard({ label, value, color }) {
  return (
    <View style={[s.statCard, { borderTopColor: color }]}>
      <Text style={[s.statNum, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function QuickLink({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={s.quickLink} onPress={onPress}>
      <Text style={s.quickIcon}>{icon}</Text>
      <Text style={s.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen({ navigation }) {
  const [stats, setStats]         = useState({ merchants: '—', openReturns: '—', activeDeployments: '—', openTasks: '—' });
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [perms, setPerms]         = useState(null);

  async function load(refresh = false) {
    if (refresh) setRefreshing(true);
    try {
      const [s, p] = await Promise.all([Dashboard.stats(), getUserPerms()]);
      setStats(s);
      setPerms(p);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  async function handleLogout() {
    try { await Auth.logout(); } catch {}
    await Storage.remove('session_token');
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />}
    >
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>{getGreeting()} 👋</Text>
          <Text style={s.headerSub}>Merchant Management Console</Text>
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <Text style={s.sectionTitle}>Overview</Text>
      {loading
        ? <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
        : <View style={s.statsGrid}>
            <StatCard label="Merchants"          value={stats.merchants}          color={COLORS.primary} />
            <StatCard label="Open RMAs"          value={stats.openReturns}        color={COLORS.warning} />
            <StatCard label="Active Deployments" value={stats.activeDeployments}  color={COLORS.success} />
            <StatCard label="Open Tasks"         value={stats.openTasks}          color={COLORS.accent} />
          </View>
      }

      {/* Quick Links */}
      <Text style={s.sectionTitle}>Quick Access</Text>
      <View style={s.quickGrid}>
        {(!perms || perms.merchants)    && <QuickLink icon="🏪" label="Merchants"     onPress={() => navigation.navigate('Merchants')} />}
        {(!perms || perms.returns)      && <QuickLink icon="📦" label="Returns"       onPress={() => navigation.navigate('Returns')} />}
        {(!perms || perms.deployments)  && <QuickLink icon="🚚" label="Deployments"   onPress={() => navigation.navigate('Deployments')} />}
        <QuickLink icon="✅" label="Tasks"         onPress={() => navigation.navigate('Tasks')} />
        <QuickLink icon="🎫" label="Tickets"       onPress={() => navigation.navigate('Tickets')} />
        {(!perms || perms.inventory)    && <QuickLink icon="🗄️" label="Inventory"     onPress={() => navigation.navigate('Equipment')} />}
        {(!perms || perms.inventory)    && <QuickLink icon="🔧" label="Repair Queue"  onPress={() => navigation.navigate('RepairQueue')} />}
        {(!perms || perms.inventory)    && <QuickLink icon="📈" label="Equipment ROI" onPress={() => navigation.navigate('EquipmentROI')} />}
        {(!perms || perms.partners)     && <QuickLink icon="🤝" label="Partners"      onPress={() => navigation.navigate('Partners')} />}
        <QuickLink icon="💬" label="Community"     onPress={() => navigation.navigate('Community')} />
        <QuickLink icon="✉️" label="Messages"      onPress={() => navigation.navigate('Messages')} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.bg },
  content:     { padding: 20, paddingBottom: 40 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  greeting:    { fontSize: 22, fontWeight: '800', color: COLORS.primaryDk },
  headerSub:   { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  logoutBtn:   { backgroundColor: '#fee2e2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  logoutText:  { color: COLORS.danger, fontSize: 12, fontWeight: '700' },
  sectionTitle:{ fontSize: 12, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  statsGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  statCard:    { flexBasis: '46%', flexGrow: 1, backgroundColor: COLORS.card, borderRadius: 12, padding: 16, borderTopWidth: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statNum:     { fontSize: 26, fontWeight: '900', marginBottom: 4 },
  statLabel:   { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
  quickGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickLink:   { backgroundColor: COLORS.card, borderRadius: 12, padding: 18, alignItems: 'center', flex: 1, minWidth: '28%', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  quickIcon:   { fontSize: 28, marginBottom: 8 },
  quickLabel:  { fontSize: 12, fontWeight: '700', color: COLORS.text },
});
