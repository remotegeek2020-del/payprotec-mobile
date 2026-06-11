import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Auth } from './src/api';
import { COLORS } from './src/config';
import LoginScreen  from './src/screens/LoginScreen';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  const [person, setPerson]   = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    Auth.getSession().then(session => {
      if (session?.token && session?.person_id) {
        setPerson({ id: session.person_id, full_name: session.name, email: session.email });
      }
      setChecking(false);
    });
  }, []);

  if (checking) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!person) {
    return (
      <>
        <StatusBar style="dark" />
        <LoginScreen onLogin={p => setPerson(p)} />
      </>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <AppNavigator person={person} onLogout={() => setPerson(null)} />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
});
