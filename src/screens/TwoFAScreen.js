import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Switch,
} from 'react-native';
import { COLORS } from '../config';
import { Auth } from '../api';

export default function TwoFAScreen({ route, navigation }) {
  const { userId, email } = route.params;
  const [code, setCode]       = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    if (code.length !== 6) { Alert.alert('Invalid', 'Enter the 6-digit code from your email.'); return; }
    setLoading(true);
    try {
      const data = await Auth.verify2FA(userId, code, remember);
      if (data.success) {
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      } else {
        Alert.alert('Failed', data.message || 'Invalid code.');
        setCode('');
      }
    } catch {
      Alert.alert('Error', 'Could not verify. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.container}>
      <View style={s.card}>
        <Text style={s.title}>Check Your Email</Text>
        <Text style={s.subtitle}>A 6-digit code was sent to{'\n'}<Text style={s.email}>{email}</Text></Text>

        <TextInput
          style={s.codeInput}
          placeholder="000000"
          placeholderTextColor={COLORS.light}
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={setCode}
          autoFocus
          textAlign="center"
        />

        <View style={s.rememberRow}>
          <Text style={s.rememberLabel}>Trust this device for 30 days</Text>
          <Switch value={remember} onValueChange={setRemember} trackColor={{ true: COLORS.primary }} />
        </View>

        <TouchableOpacity style={[s.btn, loading && { opacity: 0.6 }]} onPress={handleVerify} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Verify</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backText}>← Back to Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.primaryDk, justifyContent: 'center', paddingHorizontal: 28 },
  card:        { backgroundColor: '#fff', borderRadius: 16, padding: 28, alignItems: 'center' },
  title:       { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  subtitle:    { fontSize: 13, color: COLORS.muted, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  email:       { fontWeight: '700', color: COLORS.primary },
  codeInput:   { borderWidth: 2, borderColor: COLORS.primary, borderRadius: 12, paddingVertical: 16, width: '100%', fontSize: 32, fontWeight: '800', color: COLORS.text, letterSpacing: 12, marginBottom: 20 },
  rememberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 20 },
  rememberLabel:{ fontSize: 13, color: COLORS.muted },
  btn:         { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 15, alignItems: 'center', width: '100%' },
  btnText:     { color: '#fff', fontSize: 15, fontWeight: '800' },
  back:        { marginTop: 18 },
  backText:    { color: COLORS.muted, fontSize: 13 },
});
