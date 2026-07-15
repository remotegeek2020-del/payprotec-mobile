import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, Alert,
} from 'react-native';
import { COLORS } from '../../config';
import { makeChat } from '../../chat-api';

export default function NewGroupScreen({ navigation, route }) {
  const mode = route?.params?.mode || 'partner';
  const api = useRef(makeChat(mode)).current;
  const [name, setName]       = useState('');
  const [users, setUsers]     = useState([]);
  const [picked, setPicked]   = useState({}); // id -> {id, type}
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [query, setQuery]     = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getUserList();
        if (res?.success) setUsers(res.data || []);
      } catch (e) { /* ignore */ }
      setLoading(false);
    })();
  }, [api]);

  function toggle(u) {
    setPicked(prev => {
      const next = { ...prev };
      if (next[u.id]) delete next[u.id];
      else next[u.id] = { id: u.id, type: u.user_type === 'partner' ? 'partner' : 'staff' };
      return next;
    });
  }

  async function create() {
    const members = Object.values(picked);
    if (!name.trim()) { Alert.alert('Required', 'Give the group a name.'); return; }
    if (!members.length) { Alert.alert('Required', 'Pick at least one member.'); return; }
    setSaving(true);
    try {
      const res = await api.createGroup(name.trim(), members);
      if (res?.success && res.group) {
        navigation.replace('ChatThread', {
          mode,
          conversation: { id: res.group.id, name: res.group.name, is_group: true, is_owner: true, member_count: res.group.member_count },
        });
      } else {
        Alert.alert('Error', res?.message || 'Could not create group.');
      }
    } catch (e) { Alert.alert('Error', 'Could not create group.'); }
    setSaving(false);
  }

  const filtered = query.trim()
    ? users.filter(u => (u.name || '').toLowerCase().includes(query.toLowerCase()))
    : users;
  const count = Object.keys(picked).length;

  return (
    <View style={s.root}>
      <TextInput style={s.nameInput} placeholder="Group name" placeholderTextColor={COLORS.light} value={name} onChangeText={setName} />
      <View style={s.searchBar}>
        <Text style={{ fontSize: 15, marginRight: 6 }}>🔍</Text>
        <TextInput style={s.search} placeholder="Search people…" placeholderTextColor={COLORS.light} value={query} onChangeText={setQuery} />
      </View>

      {loading
        ? <ActivityIndicator color={COLORS.primary} style={{ margin: 24 }} />
        : (
          <FlatList
            data={filtered}
            keyExtractor={u => String(u.id)}
            renderItem={({ item }) => {
              const on = !!picked[item.id];
              return (
                <TouchableOpacity style={s.row} onPress={() => toggle(item)} activeOpacity={0.7}>
                  <View style={[s.check, on && s.checkOn]}>{on ? <Text style={s.checkMark}>✓</Text> : null}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{item.name || 'Unknown'}</Text>
                    <Text style={s.sub}>{item.user_type === 'partner' ? 'Partner' : (item.role || 'Staff')}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={{ paddingBottom: 90 }}
            ListEmptyComponent={<Text style={s.empty}>No people found</Text>}
          />
        )
      }

      <TouchableOpacity style={[s.createBtn, (saving || !count || !name.trim()) && { opacity: 0.5 }]} onPress={create} disabled={saving || !count || !name.trim()}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.createText}>Create Group{count ? ` · ${count}` : ''}</Text>}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: COLORS.bg },
  nameInput: { backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, fontWeight: '700', color: COLORS.text },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, margin: 12, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border },
  search:    { flex: 1, paddingVertical: 11, fontSize: 15, color: COLORS.text },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginHorizontal: 12, marginBottom: 8 },
  check:     { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  checkOn:   { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '900' },
  name:      { fontSize: 15, fontWeight: '700', color: COLORS.text },
  sub:       { fontSize: 12, color: COLORS.muted, marginTop: 1 },
  empty:     { textAlign: 'center', color: COLORS.muted, padding: 30 },
  createBtn: { position: 'absolute', bottom: 20, left: 16, right: 16, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  createText:{ color: '#fff', fontSize: 15, fontWeight: '800' },
});
