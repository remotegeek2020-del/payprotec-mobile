import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../../config';
import { makeChat } from '../../chat-api';

const STATUS = { available: { c: '#059669', label: 'Available' }, away: { c: '#d97706', label: 'Away' }, busy: { c: '#dc2626', label: 'Busy' } };

function timeShort(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const today = new Date();
  if (dt.toDateString() === today.toDateString()) return dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Avatar({ name, group, online, photo }) {
  const initials = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={s.avatarWrap}>
      <View style={[s.avatar, group && s.avatarGroup]}>
        <Text style={s.avatarText}>{group ? '👥' : initials}</Text>
      </View>
      {online ? <View style={s.onlineDot} /> : null}
    </View>
  );
}

export default function ChatListScreen({ navigation, route, mode: modeProp }) {
  const mode = modeProp || route?.params?.mode || 'partner';
  const api = useRef(makeChat(mode)).current;
  const [items, setItems]     = useState([]);
  const [me, setMe]           = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ul, gr] = await Promise.all([api.getUserList(), api.getGroups()]);
      const users = ul?.success ? (ul.data || []) : [];
      const groups = gr?.success ? (gr.data || []) : [];
      if (ul?.me) setMe(ul.me);
      const merged = [
        ...groups.map(g => ({ ...g, _kind: 'group', _time: g.last_message?.time })),
        ...users.map(u => ({ ...u, _kind: 'dm', _time: u.last_message?.time })),
      ].sort((a, b) => {
        if ((b.unread || 0) !== (a.unread || 0)) return (b.unread || 0) - (a.unread || 0);
        return (b._time ? new Date(b._time).getTime() : 0) - (a._time ? new Date(a._time).getTime() : 0);
      });
      setItems(merged);
    } catch (e) { /* ignore */ }
    setLoading(false);
    setRefreshing(false);
  }, [api]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Refresh on focus + poll while focused.
  useFocusEffect(useCallback(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]));

  function changeStatus() {
    const opts = Object.keys(STATUS);
    Alert.alert('Set Status', 'How should you appear to others?',
      [...opts.map(k => ({
        text: STATUS[k].label,
        onPress: async () => { try { await api.setStatus(k); setMe(m => ({ ...(m || {}), status: k })); } catch (e) {} },
      })), { text: 'Cancel', style: 'cancel' }]);
  }

  function openConversation(item) {
    navigation.navigate('ChatThread', {
      mode,
      conversation: {
        id: item.id,
        name: item.name,
        is_group: item._kind === 'group',
        is_owner: item.is_owner,
        member_count: item.member_count,
        user_type: item.user_type,
      },
    });
  }

  const myStatus = STATUS[me?.status] || STATUS.available;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.statusChip} onPress={changeStatus} activeOpacity={0.75}>
          <View style={[s.statusDot, { backgroundColor: myStatus.c }]} />
          <Text style={s.statusText}>{myStatus.label}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.newBtn} onPress={() => navigation.navigate('NewGroup', { mode })}>
          <Text style={s.newBtnText}>＋ Group</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => `${item._kind}:${item.id}`}
        renderItem={({ item }) => {
          const group = item._kind === 'group';
          return (
            <TouchableOpacity style={s.row} onPress={() => openConversation(item)} activeOpacity={0.75}>
              <Avatar name={item.name} group={group} online={!group && item.is_online} />
              <View style={{ flex: 1 }}>
                <View style={s.rowTop}>
                  <Text style={s.name} numberOfLines={1}>{item.name || 'Unknown'}</Text>
                  {item._time ? <Text style={s.time}>{timeShort(item._time)}</Text> : null}
                </View>
                <View style={s.rowBottom}>
                  <Text style={s.preview} numberOfLines={1}>
                    {group ? `${item.member_count || 0} members` : (item.user_type === 'partner' ? 'Partner' : (item.role || 'Staff'))}
                    {item.last_message?.preview ? ` · ${item.last_message.preview}` : ''}
                  </Text>
                  {item.unread > 0 ? <View style={s.badge}><Text style={s.badgeText}>{item.unread}</Text></View> : null}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
        ListEmptyComponent={loading
          ? <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />
          : <Text style={s.empty}>No conversations yet. Tap “＋ Group” or start a chat.</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: COLORS.bg },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot:  { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  newBtn:     { backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  newBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  list:       { paddingHorizontal: 12, paddingVertical: 8, paddingBottom: 30 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.card, borderRadius: 14, padding: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  avatarWrap: { position: 'relative' },
  avatar:     { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarGroup:{ backgroundColor: '#6d28d9' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  onlineDot:  { position: 'absolute', bottom: 0, right: 0, width: 13, height: 13, borderRadius: 7, backgroundColor: '#059669', borderWidth: 2, borderColor: COLORS.card },
  rowTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name:       { flex: 1, fontSize: 15, fontWeight: '800', color: COLORS.text },
  time:       { fontSize: 11, color: COLORS.light },
  rowBottom:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 2 },
  preview:    { flex: 1, fontSize: 12.5, color: COLORS.muted },
  badge:      { backgroundColor: COLORS.primary, borderRadius: 11, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText:  { color: '#fff', fontSize: 11, fontWeight: '800' },
  empty:      { textAlign: 'center', color: COLORS.muted, padding: 40, fontSize: 14, lineHeight: 20 },
});
