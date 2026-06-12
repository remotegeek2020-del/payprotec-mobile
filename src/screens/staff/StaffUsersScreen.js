import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, TextInput, Alert,
} from 'react-native';
import { COLORS } from '../../config';
import { staffRequest } from '../../staff-api';
import { Storage } from '../../storage';

const ROLES = ['staff', 'operations admin', 'admin', 'super_admin'];

const UsersApi = {
  list:   () => staffRequest('/api/users', null, { method: 'GET' }),
  insert: (payload, callerUserid) => staffRequest('/api/users', { action: 'insert', payload, userid: callerUserid }),
  resendInvite: (userid) => staffRequest('/api/users', { action: 'resend_invite', userid }),
  remove: (userid) => staffRequest('/api/users', { action: 'delete', userid }),
  setTempPassword: (target_userid, temp_password) => staffRequest('/api/users', { action: 'set_temp_password', target_userid, temp_password }),
};

function roleColor(role) {
  const r = (role || '').toLowerCase();
  if (r === 'super_admin') return { bg: '#fee2e2', text: '#dc2626' };
  if (r.includes('admin')) return { bg: '#fef3c7', text: '#d97706' };
  return { bg: '#dbeafe', text: '#1d4ed8' };
}

function genTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function InviteModal({ visible, onClose, onCreated }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [email, setEmail]         = useState('');
  const [role, setRole]           = useState('staff');
  const [saving, setSaving]       = useState(false);

  function reset() { setFirstName(''); setLastName(''); setEmail(''); setRole('staff'); }

  async function submit() {
    if (!firstName.trim() || !email.trim()) {
      Alert.alert('Required', 'First name and email are required.');
      return;
    }
    setSaving(true);
    try {
      const raw = await Storage.get('staff_user');
      const me = raw ? JSON.parse(raw) : {};
      const res = await UsersApi.insert({
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
        email:      email.trim().toLowerCase(),
        role,
      }, me.userid);
      if (res.success) {
        Alert.alert('Invited', res.email_sent
          ? 'Invitation email sent — they can set their password from the link.'
          : 'User created, but the invite email could not be sent. Use "Resend Invite" later.');
        reset();
        onCreated();
      } else {
        Alert.alert('Error', res.message || res.error || 'Could not create user.');
      }
    } catch (e) { Alert.alert('Error', 'Could not create user.'); }
    setSaving(false);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { reset(); onClose(); }}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Invite Staff Member</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
            <Text style={s.fieldLabel}>First Name *</Text>
            <TextInput style={s.input} value={firstName} onChangeText={setFirstName} placeholder="Jane" placeholderTextColor={COLORS.light} />
            <Text style={s.fieldLabel}>Last Name</Text>
            <TextInput style={s.input} value={lastName} onChangeText={setLastName} placeholder="Doe" placeholderTextColor={COLORS.light} />
            <Text style={s.fieldLabel}>Email *</Text>
            <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="jane@payprotec.com" placeholderTextColor={COLORS.light} keyboardType="email-address" autoCapitalize="none" />
            <Text style={s.fieldLabel}>Role</Text>
            <View style={s.chipRow}>
              {ROLES.map(r => (
                <TouchableOpacity key={r} style={[s.chip, role === r && s.chipActive]} onPress={() => setRole(r)}>
                  <Text style={[s.chipText, role === r && s.chipTextActive]}>{r.replace('_', ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[s.primaryBtn, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Send Invite</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function StaffUsersScreen() {
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await UsersApi.list();
      if (res.success) setUsers(res.data || []);
      else if (res.message) Alert.alert('Access', res.message);
    } catch (e) { /* ignore */ }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  function openActions(user) {
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;
    const buttons = [];

    if (!user.is_active) {
      buttons.push({ text: '✉️ Resend Invite', onPress: async () => {
        try {
          const res = await UsersApi.resendInvite(user.userid);
          Alert.alert(res.success ? 'Sent' : 'Error', res.success
            ? `Setup link ${res.email_sent ? 'emailed' : 'generated (email failed)'}.`
            : (res.message || 'Could not resend invite.'));
        } catch (e) { Alert.alert('Error', 'Could not resend invite.'); }
      }});
    }

    buttons.push({ text: '🔑 Set Temp Password', onPress: () => {
      const temp = genTempPassword();
      Alert.alert('Set Temp Password', `Set a temporary password for ${name}? They'll be forced to change it on next login and all their sessions will be ended.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Set', onPress: async () => {
          try {
            const res = await UsersApi.setTempPassword(user.userid, temp);
            if (res.success) Alert.alert('Temp Password Set', `Share this with ${name} securely:\n\n${temp}`);
            else Alert.alert('Error', res.message || 'Could not set temp password.');
          } catch (e) { Alert.alert('Error', 'Could not set temp password.'); }
        }},
      ]);
    }});

    buttons.push({ text: '🗑 Delete User', style: 'destructive', onPress: () => {
      Alert.alert('Delete User', `Permanently delete ${name} (${user.email})? This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const res = await UsersApi.remove(user.userid);
            if (res.success) load();
            else Alert.alert('Error', res.message || 'Could not delete user.');
          } catch (e) { Alert.alert('Error', 'Could not delete user.'); }
        }},
      ]);
    }});

    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(name, user.email, buttons);
  }

  return (
    <View style={s.root}>
      <FlatList
        data={users}
        keyExtractor={item => String(item.userid)}
        renderItem={({ item }) => {
          const rc = roleColor(item.role);
          return (
            <TouchableOpacity style={s.card} onPress={() => openActions(item)} activeOpacity={0.8}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{(item.first_name || item.email || '?')[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{[item.first_name, item.last_name].filter(Boolean).join(' ') || item.email}</Text>
                <Text style={s.email} numberOfLines={1}>{item.email}</Text>
                {item.last_seen ? <Text style={s.lastSeen}>Last seen {new Date(item.last_seen).toLocaleDateString()}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 5 }}>
                <View style={[s.badge, { backgroundColor: rc.bg }]}>
                  <Text style={[s.badgeText, { color: rc.text }]}>{(item.role || 'staff').replace('_', ' ').toUpperCase()}</Text>
                </View>
                <Text style={[s.activeDot, { color: item.is_active ? COLORS.success : COLORS.warning }]}>
                  {item.is_active ? '● Active' : '○ Pending'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
        ListFooterComponent={loading && !refreshing ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> : null}
        ListEmptyComponent={!loading ? <Text style={s.empty}>No staff users visible</Text> : null}
      />

      <TouchableOpacity style={s.fab} onPress={() => setShowInvite(true)} activeOpacity={0.85}>
        <Text style={s.fabText}>＋ Invite</Text>
      </TouchableOpacity>

      <InviteModal visible={showInvite} onClose={() => setShowInvite(false)} onCreated={() => { setShowInvite(false); load(); }} />
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: COLORS.bg },
  list:        { padding: 12, paddingBottom: 90 },
  card:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  avatar:      { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { color: '#fff', fontSize: 18, fontWeight: '800' },
  name:        { fontSize: 15, fontWeight: '800', color: COLORS.text },
  email:       { fontSize: 12, color: COLORS.muted, marginTop: 1 },
  lastSeen:    { fontSize: 11, color: COLORS.light, marginTop: 2 },
  badge:       { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:   { fontSize: 9, fontWeight: '800' },
  activeDot:   { fontSize: 11, fontWeight: '700' },
  empty:       { textAlign: 'center', color: COLORS.muted, padding: 40, fontSize: 14 },
  fab:         { position: 'absolute', bottom: 24, right: 20, backgroundColor: COLORS.primary, borderRadius: 28, paddingHorizontal: 22, paddingVertical: 14, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 },
  fabText:     { color: '#fff', fontSize: 15, fontWeight: '800' },
  // Modal
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard:   { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 12 },
  modalTitle:  { flex: 1, fontSize: 17, fontWeight: '900', color: COLORS.text },
  modalClose:  { fontSize: 18, color: COLORS.muted, fontWeight: '700' },
  fieldLabel:  { fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
  input:       { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, backgroundColor: '#fff' },
  chipRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:        { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#fff' },
  chipActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:    { fontSize: 12, fontWeight: '700', color: COLORS.muted, textTransform: 'capitalize' },
  chipTextActive: { color: '#fff' },
  primaryBtn:  { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
