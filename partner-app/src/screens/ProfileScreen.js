import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { COLORS } from '../config';
import { Profile, Auth } from '../api';
import { Storage } from '../storage';

export default function ProfileScreen({ onLogout }) {
  const [person, setPerson]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({});
  const [identifiers, setIdentifiers] = useState([]);

  async function load() {
    setLoading(true);
    try {
      const person_id = await Storage.get('partner_person_id');
      if (!person_id) { setLoading(false); return; }
      const res = await Profile.get(person_id);
      if (res.person || res.success) {
        const p = res.person || res;
        setPerson(p);
        setForm({ full_name: p.full_name || '', email: p.email || '', phone_number: p.phone_number || '' });
      }
      if (res.identifiers) setIdentifiers(res.identifiers);
    } catch (e) { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    try {
      const person_id = await Storage.get('partner_person_id');
      const updates = [];
      if (form.full_name !== person.full_name)     updates.push(Profile.updateField(person_id, 'full_name', form.full_name));
      if (form.phone_number !== person.phone_number) updates.push(Profile.updateField(person_id, 'phone_number', form.phone_number));
      await Promise.all(updates);
      await load();
      setEditing(false);
    } catch (e) {
      Alert.alert('Error', 'Could not save changes.');
    }
    setSaving(false);
  }

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await Auth.logout();
        onLogout();
      }},
    ]);
  }

  if (loading) return <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />;

  const p = person || {};

  return (
    <ScrollView style={s.root} contentContainerStyle={s.scroll}>
      {/* Avatar */}
      <View style={s.avatarSection}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{(p.full_name || '?')[0]?.toUpperCase()}</Text>
        </View>
        <Text style={s.name}>{p.full_name || '—'}</Text>
        <Text style={s.email}>{p.email || '—'}</Text>
        {p.is_branded && (
          <View style={s.brandedBadge}><Text style={s.brandedText}>BRANDED</Text></View>
        )}
      </View>

      {/* Info */}
      {editing ? (
        <View style={s.card}>
          <Text style={s.sectionTitle}>Edit Profile</Text>
          <Text style={s.label}>Full Name</Text>
          <TextInput style={s.input} value={form.full_name} onChangeText={v => setForm(f => ({ ...f, full_name: v }))} />
          <Text style={s.label}>Phone</Text>
          <TextInput style={s.input} value={form.phone_number} onChangeText={v => setForm(f => ({ ...f, phone_number: v }))} keyboardType="phone-pad" />
          <View style={s.editBtns}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setEditing(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={s.card}>
          <View style={s.cardTitleRow}>
            <Text style={s.sectionTitle}>Contact Info</Text>
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Text style={s.editLink}>Edit</Text>
            </TouchableOpacity>
          </View>
          {[
            ['Name',    p.full_name],
            ['Email',   p.email],
            ['Phone',   p.phone_number],
            ['Enrolled', p.enrolled_at ? new Date(p.enrolled_at).toLocaleDateString() : null],
          ].map(([label, value]) => (
            <View key={label} style={s.row}>
              <Text style={s.rowLabel}>{label}</Text>
              <Text style={s.rowValue}>{value || '—'}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Portal status */}
      <View style={s.card}>
        <Text style={s.sectionTitle}>Portal Access</Text>
        <View style={s.row}>
          <Text style={s.rowLabel}>Status</Text>
          <View style={[s.statusDot, { backgroundColor: p.is_portal_active ? COLORS.success : COLORS.danger }]}>
            <Text style={s.statusDotText}>{p.is_portal_active ? '● Active' : '○ Inactive'}</Text>
          </View>
        </View>
        {p.last_portal_login && (
          <View style={s.row}>
            <Text style={s.rowLabel}>Last Login</Text>
            <Text style={s.rowValue}>{new Date(p.last_portal_login).toLocaleDateString()}</Text>
          </View>
        )}
      </View>

      {/* Agent IDs */}
      {identifiers.length > 0 && (
        <View style={s.card}>
          <Text style={s.sectionTitle}>Agent IDs</Text>
          {identifiers.map((id, i) => (
            <View key={id.id || i} style={s.idRow}>
              <Text style={s.idString}>{id.id_string || id.identifier || '—'}</Text>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                {id.rev_share ? <Text style={s.revShare}>{id.rev_share}%</Text> : null}
                {id.prime49   ? <View style={s.primeBadge}><Text style={s.primeText}>★ P49</Text></View> : null}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Sign out */}
      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
        <Text style={s.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: COLORS.bg },
  scroll:       { padding: 16, paddingBottom: 40 },
  avatarSection:{ alignItems: 'center', marginBottom: 20, paddingVertical: 20 },
  avatar:       { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: COLORS.primary, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 },
  avatarText:   { color: '#fff', fontSize: 32, fontWeight: '900' },
  name:         { fontSize: 22, fontWeight: '900', color: COLORS.text },
  email:        { fontSize: 14, color: COLORS.muted, marginTop: 4 },
  brandedBadge: { backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginTop: 8 },
  brandedText:  { color: '#fff', fontSize: 11, fontWeight: '800' },
  card:         { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  editLink:     { fontSize: 13, color: COLORS.primary, fontWeight: '700' },
  row:          { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowLabel:     { fontSize: 13, color: COLORS.muted, fontWeight: '600' },
  rowValue:     { fontSize: 13, color: COLORS.text, fontWeight: '700', maxWidth: '60%', textAlign: 'right' },
  label:        { fontSize: 12, fontWeight: '700', color: COLORS.muted, marginBottom: 5, marginTop: 10 },
  input:        { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, backgroundColor: '#fff' },
  editBtns:     { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn:    { flex: 1, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText:{ fontSize: 14, fontWeight: '700', color: COLORS.muted },
  saveBtn:      { flex: 1, backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveBtnText:  { color: '#fff', fontSize: 14, fontWeight: '800' },
  statusDot:    { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusDotText:{ color: '#fff', fontSize: 12, fontWeight: '700' },
  idRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  idString:     { fontSize: 14, fontWeight: '700', color: COLORS.text, fontFamily: 'monospace' },
  revShare:     { fontSize: 12, fontWeight: '700', color: COLORS.success },
  primeBadge:   { backgroundColor: '#fef3c7', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  primeText:    { fontSize: 11, fontWeight: '800', color: '#d97706' },
  logoutBtn:    { backgroundColor: '#fee2e2', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  logoutText:   { color: COLORS.danger, fontSize: 15, fontWeight: '800' },
});
