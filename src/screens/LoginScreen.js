import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image,
} from 'react-native';
import { COLORS } from '../config';
import { Auth } from '../api';
import { Storage } from '../storage';

export default function LoginScreen({ navigation }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Required', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const data = await Auth.login(email.trim(), password.trim());
      if (data.needs2FA) {
        navigation.navigate('TwoFA', { userId: data.userid, email: email.trim() });
      } else if (data.success && data.sessionToken) {
        await Storage.set('session_token', data.sessionToken);
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      } else {
        Alert.alert('Login Failed', data.message || 'Invalid email or password.');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not connect. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.container}>

        {/* Logo / Brand */}
        <View style={s.brand}>
          <View style={s.logoBox}>
            <Text style={s.logoText}>PP</Text>
          </View>
          <Text style={s.title}>PayProtec</Text>
          <Text style={s.subtitle}>Merchant Management Console</Text>
        </View>

        {/* Form */}
        <View style={s.card}>
          <Text style={s.label}>Email Address</Text>
          <TextInput
            style={s.input}
            placeholder="you@company.com"
            placeholderTextColor={COLORS.light}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />

          <Text style={s.label}>Password</Text>
          <TextInput
            style={s.input}
            placeholder="••••••••"
            placeholderTextColor={COLORS.light}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleLogin}
            returnKeyType="go"
          />

          <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleLogin} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Sign In</Text>}
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>Internal Staff Access Only</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:       { flex: 1, backgroundColor: COLORS.primaryDk },
  container:  { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  brand:      { alignItems: 'center', marginBottom: 36 },
  logoBox:    { width: 72, height: 72, borderRadius: 18, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  logoText:   { color: COLORS.primaryDk, fontSize: 28, fontWeight: '900' },
  title:      { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: 0.5 },
  subtitle:   { color: 'rgba(255,255,255,.55)', fontSize: 13, marginTop: 4 },
  card:       { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  label:      { fontSize: 12, fontWeight: '700', color: COLORS.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:      { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 13, fontSize: 15, color: COLORS.text, marginBottom: 16 },
  btn:        { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  btnDisabled:{ opacity: 0.6 },
  btnText:    { color: '#fff', fontSize: 15, fontWeight: '800' },
  footer:     { color: 'rgba(255,255,255,.3)', fontSize: 11, textAlign: 'center', marginTop: 28 },
});
