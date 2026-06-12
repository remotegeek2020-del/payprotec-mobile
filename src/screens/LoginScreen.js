import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { COLORS } from '../config';
import { Auth } from '../api';

export default function LoginScreen({ onLogin, onBack }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  async function handleForgotPassword() {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Enter your email address first, then tap "Forgot password?".');
      return;
    }
    if (sendingReset) return;
    setSendingReset(true);
    try {
      await Auth.forgotPassword(email);
    } catch (e) { /* response is intentionally identical either way */ }
    setSendingReset(false);
    Alert.alert('Password Reset', 'If that account exists, a reset email has been sent.');
  }

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Required', 'Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await Auth.login(email.trim().toLowerCase(), password);
      if (res.success) {
        onLogin(res.partner);
      } else {
        Alert.alert('Login Failed', res.error || res.message || res.reason || JSON.stringify(res));
      }
    } catch (e) {
      Alert.alert('Error', e?.message || JSON.stringify(e) || 'Network error');
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo / branding */}
        <View style={s.header}>
          <View style={s.logoBox}>
            <Text style={s.logoText}>PP</Text>
          </View>
          <Text style={s.appName}>PayProtec Partner</Text>
          <Text style={s.tagline}>Partner Portal</Text>
        </View>

        {/* Form */}
        <View style={s.card}>
          <Text style={s.label}>Email Address</Text>
          <TextInput
            style={s.input}
            placeholder="your@email.com"
            placeholderTextColor={COLORS.light}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          <Text style={s.label}>Password</Text>
          <View style={s.passRow}>
            <TextInput
              style={[s.input, { flex: 1, marginBottom: 0 }]}
              placeholder="••••••••"
              placeholderTextColor={COLORS.light}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              returnKeyType="go"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPass(v => !v)}>
              <Text style={s.eyeText}>{showPass ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[s.loginBtn, loading && { opacity: 0.65 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.loginBtnText}>Sign In</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={s.forgotBtn} onPress={handleForgotPassword} disabled={sendingReset}>
            <Text style={[s.forgotText, sendingReset && { opacity: 0.5 }]}>Forgot password?</Text>
          </TouchableOpacity>

          <Text style={s.hint}>
            Access is by invitation only. Contact your account manager if you need help logging in.
          </Text>
        </View>

        {onBack ? (
          <TouchableOpacity style={s.backBtn} onPress={onBack}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: COLORS.bg },
  scroll:      { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header:      { alignItems: 'center', marginBottom: 32 },
  logoBox:     { width: 72, height: 72, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: COLORS.primary, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
  logoText:    { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: 1 },
  appName:     { fontSize: 26, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },
  tagline:     { fontSize: 14, color: COLORS.muted, marginTop: 4, fontWeight: '600' },
  card:        { backgroundColor: COLORS.card, borderRadius: 18, padding: 22, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12, elevation: 4 },
  label:       { fontSize: 12, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7, marginTop: 14 },
  input:       { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.text, backgroundColor: '#fff', marginBottom: 4 },
  passRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  eyeBtn:      { padding: 12 },
  eyeText:     { fontSize: 18 },
  loginBtn:    { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 22 },
  loginBtnText:{ color: '#fff', fontSize: 16, fontWeight: '800' },
  forgotBtn:   { alignItems: 'center', marginTop: 14, padding: 4 },
  forgotText:  { fontSize: 13, color: COLORS.primary, fontWeight: '700' },
  hint:        { fontSize: 12, color: COLORS.light, textAlign: 'center', marginTop: 14, lineHeight: 17 },
  backBtn:     { alignItems: 'center', marginTop: 18, padding: 6 },
  backText:    { fontSize: 14, color: COLORS.muted, fontWeight: '700' },
});
