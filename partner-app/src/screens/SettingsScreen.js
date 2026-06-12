import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS } from '../config';
import { Profile } from '../api';

export default function SettingsScreen() {
  // Profile section
  const [loading, setLoading]   = useState(true);
  const [person, setPerson]     = useState(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone]       = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Change password section
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass]         = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass]       = useState(false);
  const [changing, setChanging]       = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await Profile.get();
      if (res.success && res.person) {
        setPerson(res.person);
        setFullName(res.person.full_name || '');
        setPhone(res.person.phone_number || '');
      }
    } catch (e) { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveProfile() {
    if (!fullName.trim()) {
      Alert.alert('Required', 'Full name cannot be empty.');
      return;
    }
    setSavingProfile(true);
    try {
      const updates = [];
      if (fullName.trim() !== (person?.full_name || ''))   updates.push(Profile.updateField(null, 'full_name', fullName.trim()));
      if (phone.trim() !== (person?.phone_number || ''))   updates.push(Profile.updateField(null, 'phone_number', phone.trim()));
      if (updates.length) {
        const results = await Promise.all(updates);
        const failed = results.find(r => !r.success);
        if (failed) {
          Alert.alert('Error', failed.message || failed.error || 'Could not save profile.');
        } else {
          Alert.alert('Saved', 'Your profile has been updated.');
          await load();
        }
      }
    } catch (e) {
      Alert.alert('Error', e?.message || 'Could not save profile.');
    }
    setSavingProfile(false);
  }

  async function changePassword() {
    if (!currentPass || !newPass || !confirmPass) {
      Alert.alert('Required', 'Fill in all password fields.');
      return;
    }
    if (newPass.length < 8) {
      Alert.alert('Too Short', 'New password must be at least 8 characters.');
      return;
    }
    if (newPass !== confirmPass) {
      Alert.alert('Mismatch', 'New passwords do not match.');
      return;
    }
    setChanging(true);
    try {
      const res = await Profile.changePassword(currentPass, newPass);
      if (res.success) {
        setCurrentPass(''); setNewPass(''); setConfirmPass('');
        Alert.alert('Success', 'Your password has been updated.');
      } else {
        Alert.alert('Failed', res.message || res.error || 'Could not change password.');
      }
    } catch (e) {
      Alert.alert('Error', e?.message || 'Could not change password.');
    }
    setChanging(false);
  }

  if (loading) {
    return (
      <View style={s.root}>
        <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Profile */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Profile</Text>
          <Text style={s.label}>Full Name</Text>
          <TextInput
            style={s.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your name"
            placeholderTextColor={COLORS.light}
          />
          <Text style={s.label}>Phone Number</Text>
          <TextInput
            style={s.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="(555) 555-5555"
            placeholderTextColor={COLORS.light}
            keyboardType="phone-pad"
          />
          {person?.email ? (
            <>
              <Text style={s.label}>Email</Text>
              <Text style={s.staticValue}>{person.email}</Text>
            </>
          ) : null}
          <TouchableOpacity
            style={[s.primaryBtn, savingProfile && { opacity: 0.6 }]}
            onPress={saveProfile}
            disabled={savingProfile}
            activeOpacity={0.85}
          >
            {savingProfile
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.primaryBtnText}>Save Profile</Text>}
          </TouchableOpacity>
        </View>

        {/* Change password */}
        <View style={s.card}>
          <View style={s.cardTitleRow}>
            <Text style={s.sectionTitle}>Change Password</Text>
            <TouchableOpacity onPress={() => setShowPass(v => !v)}>
              <Text style={s.eyeText}>{showPass ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.label}>Current Password</Text>
          <TextInput
            style={s.input}
            value={currentPass}
            onChangeText={setCurrentPass}
            placeholder="••••••••"
            placeholderTextColor={COLORS.light}
            secureTextEntry={!showPass}
            autoCapitalize="none"
          />
          <Text style={s.label}>New Password</Text>
          <TextInput
            style={s.input}
            value={newPass}
            onChangeText={setNewPass}
            placeholder="Minimum 8 characters"
            placeholderTextColor={COLORS.light}
            secureTextEntry={!showPass}
            autoCapitalize="none"
          />
          <Text style={s.label}>Confirm New Password</Text>
          <TextInput
            style={s.input}
            value={confirmPass}
            onChangeText={setConfirmPass}
            placeholder="Repeat new password"
            placeholderTextColor={COLORS.light}
            secureTextEntry={!showPass}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[s.primaryBtn, changing && { opacity: 0.6 }]}
            onPress={changePassword}
            disabled={changing}
            activeOpacity={0.85}
          >
            {changing
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.primaryBtnText}>Update Password</Text>}
          </TouchableOpacity>
          <Text style={s.hint}>Use at least 8 characters. You'll stay signed in on this device.</Text>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: COLORS.bg },
  scroll:        { padding: 16, paddingBottom: 40 },
  card:          { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTitleRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle:  { fontSize: 12, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  label:         { fontSize: 12, fontWeight: '700', color: COLORS.muted, marginBottom: 5, marginTop: 12 },
  input:         { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, backgroundColor: '#fff' },
  staticValue:   { fontSize: 14, color: COLORS.text, fontWeight: '600', paddingVertical: 8 },
  primaryBtn:    { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  primaryBtnText:{ color: '#fff', fontSize: 14, fontWeight: '800' },
  eyeText:       { fontSize: 16 },
  hint:          { fontSize: 11, color: COLORS.light, textAlign: 'center', marginTop: 12, lineHeight: 16 },
});
