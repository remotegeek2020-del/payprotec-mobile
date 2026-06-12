import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { COLORS } from '../../config';
import { StaffAuth } from '../../staff-api';

export default function StaffLoginScreen({ onLogin, onBack }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);

  // 2FA step
  const [tfaUserId, setTfaUserId] = useState(null);
  const [code, setCode]           = useState('');

  // Forced password change step
  const [pwChange, setPwChange]   = useState(null); // { userid, change_token }
  const [newPass, setNewPass]     = useState('');
  const [newPass2, setNewPass2]   = useState('');

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Required', 'Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await StaffAuth.login(email, password);
      if (res.success && res.needs2FA) {
        setTfaUserId(res.userid);
      } else if (res.success && res.needs_password_change) {
        setPwChange({ userid: res.userid, change_token: res.change_token });
      } else if (res.success && res.user) {
        onLogin(res.user);
      } else {
        Alert.alert('Login Failed', res.message || res.error || 'Auth failed');
      }
    } catch (e) {
      Alert.alert('Error', e?.message || 'Network error');
    }
    setLoading(false);
  }

  async function handleVerify() {
    if (code.trim().length !== 6) {
      Alert.alert('Required', 'Enter the 6-digit code from your email.');
      return;
    }
    setLoading(true);
    try {
      const res = await StaffAuth.verify2FA(tfaUserId, code.trim(), true);
      if (res.success && res.user) onLogin(res.user);
      else Alert.alert('Verification Failed', res.message || 'Invalid code');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Network error');
    }
    setLoading(false);
  }

  async function handlePasswordChange() {
    if (newPass.length < 8)   { Alert.alert('Too Short', 'Password must be at least 8 characters.'); return; }
    if (newPass !== newPass2) { Alert.alert('Mismatch', 'Passwords do not match.'); return; }
    setLoading(true);
    try {
      const res = await StaffAuth.forcePasswordChange(pwChange.userid, pwChange.change_token, newPass);
      if (res.success && res.user) onLogin(res.user);
      else Alert.alert('Error', res.message || 'Could not change password.');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Network error');
    }
    setLoading(false);
  }

  function handleForgot() {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Enter your email address first, then tap "Forgot password".');
      return;
    }
    Alert.alert('Reset Password', `Send a password reset link to ${email.trim()}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send Link', onPress: async () => {
        try { await StaffAuth.forgotPassword(email); } catch (e) { /* ignore */ }
        Alert.alert('Check Your Email', 'If that account exists, a reset link has been sent.');
      }},
    ]);
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <View style={s.logoBox}>
            <Text style={s.logoText}>PP</Text>
          </View>
          <Text style={s.appName}>PayProTec Staff</Text>
          <Text style={s.tagline}>Management Console</Text>
        </View>

        <View style={s.card}>
          {pwChange ? (
            <>
              <Text style={s.stepTitle}>Set New Password</Text>
              <Text style={s.stepSub}>Your password was reset by an admin. Choose a new one to continue.</Text>
              <Text style={s.label}>New Password</Text>
              <TextInput style={s.input} value={newPass} onChangeText={setNewPass} secureTextEntry placeholder="At least 8 characters" placeholderTextColor={COLORS.light} />
              <Text style={s.label}>Confirm Password</Text>
              <TextInput style={s.input} value={newPass2} onChangeText={setNewPass2} secureTextEntry placeholder="Repeat password" placeholderTextColor={COLORS.light} onSubmitEditing={handlePasswordChange} />
              <TouchableOpacity style={[s.loginBtn, loading && { opacity: 0.65 }]} onPress={handlePasswordChange} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.loginBtnText}>Save & Sign In</Text>}
              </TouchableOpacity>
            </>
          ) : tfaUserId ? (
            <>
              <Text style={s.stepTitle}>Security Verification</Text>
              <Text style={s.stepSub}>We emailed a 6-digit code to {email.trim()}. Enter it below — this device will be trusted for 30 days.</Text>
              <TextInput
                style={[s.input, s.codeInput]}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="••••••"
                placeholderTextColor={COLORS.light}
                onSubmitEditing={handleVerify}
                autoFocus
              />
              <TouchableOpacity style={[s.loginBtn, loading && { opacity: 0.65 }]} onPress={handleVerify} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.loginBtnText}>Verify</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setTfaUserId(null); setCode(''); }}>
                <Text style={s.linkText}>← Back to login</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
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

              <TouchableOpacity style={[s.loginBtn, loading && { opacity: 0.65 }]} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.loginBtnText}>Sign In</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={handleForgot}>
                <Text style={s.linkText}>Forgot password?</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {onBack ? (
          <TouchableOpacity onPress={onBack} style={s.switchBtn}>
            <Text style={s.switchText}>← I'm a Partner</Text>
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
  logoBox:     { width: 72, height: 72, borderRadius: 20, backgroundColor: COLORS.primaryDk, alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: COLORS.primaryDk, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
  logoText:    { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: 1 },
  appName:     { fontSize: 26, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },
  tagline:     { fontSize: 14, color: COLORS.muted, marginTop: 4, fontWeight: '600' },
  card:        { backgroundColor: COLORS.card, borderRadius: 18, padding: 22, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12, elevation: 4 },
  stepTitle:   { fontSize: 18, fontWeight: '900', color: COLORS.text, marginBottom: 6 },
  stepSub:     { fontSize: 13, color: COLORS.muted, lineHeight: 19, marginBottom: 14 },
  label:       { fontSize: 12, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7, marginTop: 14 },
  input:       { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.text, backgroundColor: '#fff', marginBottom: 4 },
  codeInput:   { fontSize: 24, letterSpacing: 12, textAlign: 'center', fontFamily: 'monospace' },
  passRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  eyeBtn:      { padding: 12 },
  eyeText:     { fontSize: 18 },
  loginBtn:    { backgroundColor: COLORS.primaryDk, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 22 },
  loginBtnText:{ color: '#fff', fontSize: 16, fontWeight: '800' },
  linkText:    { fontSize: 13, color: COLORS.primary, fontWeight: '700', textAlign: 'center', marginTop: 16 },
  switchBtn:   { alignItems: 'center', marginTop: 20 },
  switchText:  { fontSize: 14, color: COLORS.muted, fontWeight: '700' },
});
