import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Auth, Notifications as PartnerNotifications } from './src/api';
import { StaffAuth, StaffNotifications } from './src/staff-api';
import { registerForPush, notifyNewItems, notifyCountIncrease } from './src/notifications';
import { COLORS } from './src/config';
import LoginScreen      from './src/screens/LoginScreen';
import StaffLoginScreen from './src/screens/staff/StaffLoginScreen';
import AppNavigator     from './src/navigation/AppNavigator';
import StaffNavigator   from './src/navigation/StaffNavigator';

export default function App() {
  const [portal, setPortal]       = useState(null);   // null | 'partner' | 'staff'
  const [person, setPerson]       = useState(null);   // partner session
  const [staffUser, setStaffUser] = useState(null);   // staff session
  const [checking, setChecking]   = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Restore whichever session exists (staff takes precedence if both)
        const staff = await StaffAuth.getSession();
        if (staff?.token && staff?.user) {
          const v = await StaffAuth.validate();
          if (v?.success && v?.user) {
            setStaffUser(v.user);
            setPortal('staff');
            setChecking(false);
            return;
          }
        }
        const res = await Auth.validate();
        if (res?.success && res?.partner) {
          setPerson(res.partner);
          setPortal('partner');
        }
      } catch (e) { /* fall through to chooser */ }
      setChecking(false);
    })();
  }, []);

  // Notifications: ask permission once signed in, then poll for new items and
  // raise local notifications. (Remote/background push needs a backend device-
  // token endpoint — pending on the web side; local polling works today.)
  useEffect(() => {
    if (portal === 'staff' && !staffUser) return;
    if (portal === 'partner' && !person) return;
    if (portal !== 'staff' && portal !== 'partner') return;

    registerForPush();

    async function poll() {
      try {
        if (portal === 'staff') {
          const res = await StaffNotifications.getCounts();
          if (res?.success) {
            const total = Object.values(res.counts || {})
              .reduce((sum, v) => sum + (parseInt(v) || 0), 0);
            await notifyCountIncrease('staff_total', total, 'notification');
          }
        } else {
          const res = await PartnerNotifications.get();
          if (res?.success) await notifyNewItems(res.notifications || []);
        }
      } catch (e) { /* ignore */ }
    }

    poll();
    const id = setInterval(poll, 60000);
    return () => clearInterval(id);
  }, [portal, staffUser, person]);

  if (checking) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Signed in
  if (portal === 'staff' && staffUser) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <StaffNavigator user={staffUser} onLogout={async () => { await StaffAuth.logout(); setStaffUser(null); setPortal(null); }} />
      </GestureHandlerRootView>
    );
  }
  if (portal === 'partner' && person) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <AppNavigator person={person} onLogout={() => { setPerson(null); setPortal(null); }} />
      </GestureHandlerRootView>
    );
  }

  // Login flows
  if (portal === 'partner') {
    return (
      <>
        <StatusBar style="dark" />
        <LoginScreen onLogin={p => setPerson(p)} onBack={() => setPortal(null)} />
      </>
    );
  }
  if (portal === 'staff') {
    return (
      <>
        <StatusBar style="dark" />
        <StaffLoginScreen onLogin={u => setStaffUser(u)} onBack={() => setPortal(null)} />
      </>
    );
  }

  // Portal chooser
  return (
    <View style={styles.chooser}>
      <StatusBar style="dark" />
      <View style={styles.logoBox}>
        <Text style={styles.logoText}>PP</Text>
      </View>
      <Text style={styles.appName}>PayProTec</Text>
      <Text style={styles.tagline}>Choose your portal</Text>

      <TouchableOpacity style={styles.portalBtn} onPress={() => setPortal('partner')} activeOpacity={0.85}>
        <Text style={styles.portalIcon}>🤝</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.portalLabel}>Partner Portal</Text>
          <Text style={styles.portalSub}>Merchant portfolio, volumes, tickets & community</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.portalBtn, styles.staffBtn]} onPress={() => setPortal('staff')} activeOpacity={0.85}>
        <Text style={styles.portalIcon}>🛠️</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.portalLabel}>Staff Console</Text>
          <Text style={styles.portalSub}>Merchants, hardware, tickets, tasks & admin</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  loading:   { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  chooser:   { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg, padding: 24 },
  logoBox:   { width: 84, height: 84, borderRadius: 24, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: COLORS.primary, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
  logoText:  { color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: 1 },
  appName:   { fontSize: 30, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },
  tagline:   { fontSize: 14, color: COLORS.muted, marginTop: 4, marginBottom: 36, fontWeight: '600' },
  portalBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.card, borderRadius: 18, padding: 20, width: '100%', marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10, elevation: 4 },
  staffBtn:  { borderWidth: 1.5, borderColor: COLORS.border },
  portalIcon:{ fontSize: 32 },
  portalLabel:{ fontSize: 17, fontWeight: '900', color: COLORS.text },
  portalSub: { fontSize: 12, color: COLORS.muted, marginTop: 3, lineHeight: 17 },
});
