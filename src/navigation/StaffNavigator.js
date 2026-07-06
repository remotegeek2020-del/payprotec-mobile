import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { COLORS } from '../config';

import StaffDashboardScreen   from '../screens/staff/StaffDashboardScreen';
import StaffMerchantsScreen   from '../screens/staff/StaffMerchantsScreen';
import StaffPartnersScreen    from '../screens/staff/StaffPartnersScreen';
import StaffDeploymentsScreen from '../screens/staff/StaffDeploymentsScreen';
import StaffReturnsScreen     from '../screens/staff/StaffReturnsScreen';
import StaffEquipmentsScreen  from '../screens/staff/StaffEquipmentsScreen';
import StaffRepairQueueScreen from '../screens/staff/StaffRepairQueueScreen';
import StaffTicketsScreen     from '../screens/staff/StaffTicketsScreen';
import StaffTasksScreen       from '../screens/staff/StaffTasksScreen';
import StaffChatScreen        from '../screens/staff/StaffChatScreen';
import StaffLogsScreen        from '../screens/staff/StaffLogsScreen';
import StaffUsersScreen       from '../screens/staff/StaffUsersScreen';
import StaffSearchScreen      from '../screens/staff/StaffSearchScreen';
import StaffCommunityScreen   from '../screens/staff/StaffCommunityScreen';
import StaffAnalyticsScreen   from '../screens/staff/StaffAnalyticsScreen';
import StaffScannerScreen     from '../screens/staff/StaffScannerScreen';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

function TabIcon({ icon, focused }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{icon}</Text>;
}

function MenuItem({ icon, label, sub, onPress }) {
  return (
    <TouchableOpacity style={hub.item} onPress={onPress} activeOpacity={0.75}>
      <Text style={hub.itemIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={hub.itemLabel}>{label}</Text>
        {sub ? <Text style={hub.itemSub}>{sub}</Text> : null}
      </View>
      <Text style={hub.chevron}>›</Text>
    </TouchableOpacity>
  );
}

// ── Hardware hub ──────────────────────────────────────────────────────────────
function HardwareHubScreen({ navigation, user }) {
  const u = user || {};
  return (
    <ScrollView style={hub.root} contentContainerStyle={hub.scroll}>
      <Text style={hub.title}>Hardware</Text>
      <MenuItem icon="📷" label="Scan Serial" sub="Scan a barcode to look up a unit or file an RMA" onPress={() => navigation.navigate('StaffScanner')} />
      {u.access_deployments !== false && (
        <MenuItem icon="🚚" label="Deployments" sub="Deployed terminals, RMAs, returns to office" onPress={() => navigation.navigate('StaffDeployments')} />
      )}
      {u.access_returns !== false && (
        <MenuItem icon="↩️" label="Returns" sub="Open RMAs and return processing" onPress={() => navigation.navigate('StaffReturns')} />
      )}
      {u.access_inventory !== false && (
        <MenuItem icon="📦" label="Inventory" sub="Equipment stock and serials" onPress={() => navigation.navigate('StaffEquipments')} />
      )}
      {u.access_inventory !== false && (
        <MenuItem icon="🔧" label="Repair Queue" sub="Units under repair" onPress={() => navigation.navigate('StaffRepairQueue')} />
      )}
    </ScrollView>
  );
}

// ── More hub ──────────────────────────────────────────────────────────────────
function MoreHubScreen({ navigation, user, onLogout }) {
  const u = user || {};
  const isAdmin = ['super_admin', 'admin'].includes(u.role);

  function confirmLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: onLogout },
    ]);
  }

  return (
    <ScrollView style={hub.root} contentContainerStyle={hub.scroll}>
      <View style={hub.profileRow}>
        <View style={hub.avatar}>
          <Text style={hub.avatarText}>{(u.first_name || u.email || '?')[0]?.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={hub.profileName}>{[u.first_name, u.last_name].filter(Boolean).join(' ') || u.email}</Text>
          <Text style={hub.profileRole}>{(u.role || 'staff').replace('_', ' ')}</Text>
        </View>
      </View>

      <Text style={hub.section}>Tools</Text>
      <MenuItem icon="📊" label="Analytics" sub="KPIs, trends and status breakdowns" onPress={() => navigation.navigate('StaffAnalytics')} />
      <MenuItem icon="🔍" label="Global Search" sub="Merchants, partners, serials, tickets" onPress={() => navigation.navigate('StaffSearch')} />
      {u.access_partners !== false && (
        <MenuItem icon="🤝" label="Partners" sub="Partner list, scorecards, leaderboard" onPress={() => navigation.navigate('StaffPartners')} />
      )}
      <MenuItem icon="✅" label="Tasks" sub="Team task board" onPress={() => navigation.navigate('StaffTasks')} />
      <MenuItem icon="💬" label="Team Chat" sub="Direct messages with staff" onPress={() => navigation.navigate('StaffChat')} />
      <MenuItem icon="🌐" label="Community" sub="Posts, channels and discussion" onPress={() => navigation.navigate('StaffCommunity')} />

      {isAdmin && (
        <>
          <Text style={hub.section}>Admin</Text>
          <MenuItem icon="👥" label="User Management" sub="Staff accounts and access" onPress={() => navigation.navigate('StaffUsers')} />
          <MenuItem icon="📜" label="Activity Logs" sub="Audit trail" onPress={() => navigation.navigate('StaffLogs')} />
        </>
      )}

      <TouchableOpacity style={hub.logoutBtn} onPress={confirmLogout}>
        <Text style={hub.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function StaffTabs({ user, onLogout }) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   COLORS.primary,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: COLORS.border, paddingBottom: 6, paddingTop: 6, height: 60 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tab.Screen name="Home" options={{ tabBarIcon: ({ focused }) => <TabIcon icon="📊" focused={focused} /> }}>
        {(props) => <StaffDashboardScreen {...props} user={user} />}
      </Tab.Screen>
      {user?.access_merchants !== false && (
        <Tab.Screen name="Merchants" component={StaffMerchantsScreen}
          options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🏪" focused={focused} /> }} />
      )}
      <Tab.Screen name="Hardware" options={{ tabBarIcon: ({ focused }) => <TabIcon icon="📦" focused={focused} /> }}>
        {(props) => <HardwareHubScreen {...props} user={user} />}
      </Tab.Screen>
      <Tab.Screen name="Tickets" component={StaffTicketsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🎫" focused={focused} /> }} />
      <Tab.Screen name="More" options={{ tabBarIcon: ({ focused }) => <TabIcon icon="☰" focused={focused} /> }}>
        {(props) => <MoreHubScreen {...props} user={user} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function StaffNavigator({ user, onLogout }) {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
          headerTintColor: COLORS.text,
          headerTitleStyle: { fontWeight: '800' },
          headerStyle: { backgroundColor: '#fff' },
        }}
      >
        <Stack.Screen name="StaffMain" options={{ headerShown: false }}>
          {(props) => <StaffTabs {...props} user={user} onLogout={onLogout} />}
        </Stack.Screen>
        <Stack.Screen name="StaffDeployments" component={StaffDeploymentsScreen} options={{ title: 'Deployments' }} />
        <Stack.Screen name="StaffReturns"     component={StaffReturnsScreen}     options={{ title: 'Returns' }} />
        <Stack.Screen name="StaffEquipments"  component={StaffEquipmentsScreen}  options={{ title: 'Inventory' }} />
        <Stack.Screen name="StaffRepairQueue" component={StaffRepairQueueScreen} options={{ title: 'Repair Queue' }} />
        <Stack.Screen name="StaffPartners"    component={StaffPartnersScreen}    options={{ title: 'Partners' }} />
        <Stack.Screen name="StaffTasks"       component={StaffTasksScreen}       options={{ title: 'Tasks' }} />
        <Stack.Screen name="StaffChat"        component={StaffChatScreen}        options={{ title: 'Team Chat' }} />
        <Stack.Screen name="StaffLogs"        component={StaffLogsScreen}        options={{ title: 'Activity Logs' }} />
        <Stack.Screen name="StaffUsers"       component={StaffUsersScreen}       options={{ title: 'User Management' }} />
        <Stack.Screen name="StaffSearch"      component={StaffSearchScreen}      options={{ title: 'Global Search' }} />
        <Stack.Screen name="StaffCommunity"   component={StaffCommunityScreen}   options={{ title: 'Community' }} />
        <Stack.Screen name="StaffAnalytics"   component={StaffAnalyticsScreen}   options={{ title: 'Analytics' }} />
        <Stack.Screen name="StaffScanner"     component={StaffScannerScreen}     options={{ title: 'Scan Serial' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const hub = StyleSheet.create({
  root:        { flex: 1, backgroundColor: COLORS.bg },
  scroll:      { padding: 16, paddingBottom: 40 },
  title:       { fontSize: 22, fontWeight: '900', color: COLORS.text, marginBottom: 16 },
  section:     { fontSize: 12, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 20 },
  item:        { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 10, gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  itemIcon:    { fontSize: 24 },
  itemLabel:   { fontSize: 15, fontWeight: '800', color: COLORS.text },
  itemSub:     { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  chevron:     { fontSize: 24, color: COLORS.light, fontWeight: '300' },
  profileRow:  { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 4 },
  avatar:      { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.primaryDk, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { color: '#fff', fontSize: 22, fontWeight: '900' },
  profileName: { fontSize: 17, fontWeight: '900', color: COLORS.text },
  profileRole: { fontSize: 12, color: COLORS.muted, fontWeight: '700', textTransform: 'capitalize', marginTop: 2 },
  logoutBtn:   { backgroundColor: '#fee2e2', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  logoutText:  { color: COLORS.danger, fontSize: 15, fontWeight: '800' },
});
