import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { COLORS } from '../config';
import { Profile, Auth, SubPartners } from '../api';
import { Storage } from '../storage';

function fmtVol(n) {
  const num = parseFloat(n);
  if (isNaN(num)) return '—';
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000)     return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(0)}`;
}

export default function ProfileScreen({ navigation, onLogout }) {
  const [person, setPerson]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({});
  const [identifiers, setIdentifiers] = useState([]);

  // Sub-partners
  const [subPartners, setSubPartners]   = useState([]);
  const [subsLoading, setSubsLoading]   = useState(false);
  const [expandedSub, setExpandedSub]   = useState(null);   // person_id of expanded sub-partner
  const [subMerchants, setSubMerchants] = useState({});     // person_id -> merchants[]
  const [subMerchLoading, setSubMerchLoading] = useState(null);

  // Invite form
  const [showInvite, setShowInvite]     = useState(false);
  const [invForm, setInvForm]           = useState({ full_name: '', email: '', agent_id_string: '', rev_share: '', parent_id_string: '' });
  const [inviting, setInviting]         = useState(false);

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

  async function loadSubPartners() {
    setSubsLoading(true);
    try {
      const res = await SubPartners.list();
      if (res.success) setSubPartners(res.data || []);
    } catch (e) { /* ignore */ }
    setSubsLoading(false);
  }

  useEffect(() => { load(); loadSubPartners(); }, []);

  async function toggleSubExpand(sub) {
    if (expandedSub === sub.person_id) { setExpandedSub(null); return; }
    setExpandedSub(sub.person_id);
    if (!subMerchants[sub.person_id]) {
      setSubMerchLoading(sub.person_id);
      try {
        const res = await SubPartners.getMerchants(sub.person_id);
        if (res.success) setSubMerchants(m => ({ ...m, [sub.person_id]: res.data || [] }));
      } catch (e) { /* ignore */ }
      setSubMerchLoading(null);
    }
  }

  async function sendInvite() {
    const { full_name, email, agent_id_string, rev_share, parent_id_string } = invForm;
    const parentId = parent_id_string || identifiers[0]?.id_string || '';
    if (!full_name.trim() || !email.trim() || !agent_id_string.trim() || !parentId) {
      Alert.alert('Required', 'Full name, email, Agent ID and a parent Agent ID are required.');
      return;
    }
    setInviting(true);
    try {
      const res = await SubPartners.invite({
        full_name:        full_name.trim(),
        email:            email.trim().toLowerCase(),
        agent_id_string:  agent_id_string.trim(),
        rev_share:        rev_share ? parseFloat(rev_share) : 0,
        parent_id_string: parentId,
      });
      if (res.success) {
        Alert.alert('Invite Sent', `${full_name.trim()} has been invited. They'll receive an email to set up their portal account.`);
        setShowInvite(false);
        setInvForm({ full_name: '', email: '', agent_id_string: '', rev_share: '', parent_id_string: '' });
        loadSubPartners();
      } else {
        Alert.alert('Failed', res.message || res.error || 'Could not send invite.');
      }
    } catch (e) {
      Alert.alert('Error', e?.message || 'Could not send invite.');
    }
    setInviting(false);
  }

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

      {/* Sub-partners */}
      <View style={s.card}>
        <View style={s.cardTitleRow}>
          <Text style={s.sectionTitle}>Sub-Partners</Text>
          <TouchableOpacity onPress={() => setShowInvite(v => !v)}>
            <Text style={s.editLink}>{showInvite ? 'Cancel' : '+ Invite'}</Text>
          </TouchableOpacity>
        </View>

        {showInvite && (
          <View style={s.inviteForm}>
            <Text style={s.label}>Full Name *</Text>
            <TextInput style={s.input} value={invForm.full_name} onChangeText={v => setInvForm(f => ({ ...f, full_name: v }))} placeholder="Jane Smith" placeholderTextColor={COLORS.light} />
            <Text style={s.label}>Email *</Text>
            <TextInput style={s.input} value={invForm.email} onChangeText={v => setInvForm(f => ({ ...f, email: v }))} placeholder="jane@email.com" placeholderTextColor={COLORS.light} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            <Text style={s.label}>New Agent ID *</Text>
            <TextInput style={s.input} value={invForm.agent_id_string} onChangeText={v => setInvForm(f => ({ ...f, agent_id_string: v }))} placeholder="e.g. SUB123" placeholderTextColor={COLORS.light} autoCapitalize="characters" autoCorrect={false} />
            <Text style={s.label}>Rev Share %</Text>
            <TextInput style={s.input} value={invForm.rev_share} onChangeText={v => setInvForm(f => ({ ...f, rev_share: v }))} placeholder="0" placeholderTextColor={COLORS.light} keyboardType="decimal-pad" />
            {identifiers.length > 1 ? (
              <>
                <Text style={s.label}>Under Your Agent ID *</Text>
                <View style={s.parentChips}>
                  {identifiers.map((id, i) => {
                    const active = (invForm.parent_id_string || identifiers[0]?.id_string) === id.id_string;
                    return (
                      <TouchableOpacity key={id.id || i} style={[s.parentChip, active && s.parentChipActive]} onPress={() => setInvForm(f => ({ ...f, parent_id_string: id.id_string }))}>
                        <Text style={[s.parentChipText, active && { color: '#fff' }]}>{id.id_string}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : null}
            <TouchableOpacity style={[s.saveBtn, { marginTop: 14 }, inviting && { opacity: 0.6 }]} onPress={sendInvite} disabled={inviting}>
              {inviting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>Send Invite</Text>}
            </TouchableOpacity>
            <Text style={s.inviteHint}>They'll receive an email invite to set up their portal account.</Text>
          </View>
        )}

        {subsLoading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 12 }} />
        ) : subPartners.length === 0 ? (
          <Text style={s.emptySub}>No sub-partners yet. Invite your first sub-partner to start building your network.</Text>
        ) : (
          subPartners.map(sub => (
            <View key={sub.person_id}>
              <TouchableOpacity style={s.subRow} onPress={() => toggleSubExpand(sub)} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={s.subName} numberOfLines={1}>{sub.full_name || '—'}</Text>
                  <Text style={s.subEmail} numberOfLines={1}>{sub.email || '—'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.subCount}>{sub.merchant_count} merchant{sub.merchant_count === 1 ? '' : 's'}</Text>
                  <Text style={s.subVol}>{fmtVol(sub.volume_30_day)} 30d</Text>
                </View>
                <Text style={s.subChevron}>{expandedSub === sub.person_id ? '▾' : '▸'}</Text>
              </TouchableOpacity>
              {expandedSub === sub.person_id && (
                <View style={s.subMerchBox}>
                  {subMerchLoading === sub.person_id ? (
                    <ActivityIndicator color={COLORS.primary} size="small" style={{ marginVertical: 8 }} />
                  ) : (subMerchants[sub.person_id] || []).length === 0 ? (
                    <Text style={s.emptySub}>No merchants yet.</Text>
                  ) : (
                    (subMerchants[sub.person_id] || []).map((m, i) => (
                      <View key={m.merchant_id || i} style={s.subMerchRow}>
                        <Text style={s.subMerchName} numberOfLines={1}>{m.dba_name || '—'}</Text>
                        <Text style={s.subMerchMeta}>{m.account_status || '—'} · {fmtVol(m.volume_30_day)}</Text>
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          ))
        )}
      </View>

      {/* Settings */}
      <TouchableOpacity style={s.settingsRow} onPress={() => navigation.navigate('Settings')} activeOpacity={0.8}>
        <Text style={s.settingsIcon}>⚙️</Text>
        <Text style={s.settingsLabel}>Settings</Text>
        <Text style={s.settingsChevron}>›</Text>
      </TouchableOpacity>

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
  inviteForm:   { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, marginBottom: 12, backgroundColor: COLORS.bg },
  inviteHint:   { fontSize: 11, color: COLORS.light, textAlign: 'center', marginTop: 10 },
  parentChips:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  parentChip:   { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  parentChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  parentChipText:   { fontSize: 12, fontWeight: '700', color: COLORS.muted, fontFamily: 'monospace' },
  emptySub:     { fontSize: 13, color: COLORS.muted, paddingVertical: 8, lineHeight: 18 },
  subRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  subName:      { fontSize: 14, fontWeight: '700', color: COLORS.text },
  subEmail:     { fontSize: 12, color: COLORS.muted, marginTop: 1 },
  subCount:     { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  subVol:       { fontSize: 11, color: COLORS.muted, marginTop: 1 },
  subChevron:   { fontSize: 14, color: COLORS.light, fontWeight: '700' },
  subMerchBox:  { backgroundColor: COLORS.bg, borderRadius: 10, padding: 10, marginVertical: 6 },
  subMerchRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, gap: 8 },
  subMerchName: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.text },
  subMerchMeta: { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
  settingsRow:  { backgroundColor: COLORS.card, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  settingsIcon: { fontSize: 18 },
  settingsLabel:{ flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.text },
  settingsChevron: { fontSize: 22, color: COLORS.light, fontWeight: '600' },
  logoutBtn:    { backgroundColor: '#fee2e2', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  logoutText:   { color: COLORS.danger, fontSize: 15, fontWeight: '800' },
});
