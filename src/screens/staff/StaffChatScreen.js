import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, RefreshControl, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { COLORS } from '../../config';
import { staffRequest } from '../../staff-api';
import { Storage } from '../../storage';

function formatTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
async function getMyUserId() {
  try {
    const raw = await Storage.get('staff_user');
    const u = raw ? JSON.parse(raw) : null;
    return u?.userid || null;
  } catch (e) { return null; }
}

// ── Conversation (1:1 thread) ──────────────────────────────────────────────────
function ConversationView({ user, myId, onBack }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [text, setText]         = useState('');
  const [sending, setSending]   = useState(false);
  const flatRef = useRef(null);

  const load = useCallback(async () => {
    if (!user?.id || !myId) return;
    try {
      // getHistory marks incoming messages as read server-side
      const res = await staffRequest('/api/chat', {
        action: 'getHistory',
        sender_id: myId,
        recipient_id: user.id,
        page: 0,
        limit: 50,
      });
      setMessages(res.data || []);
    } catch (e) { /* sessionExpired — fail quietly */ }
  }, [user?.id, myId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    const interval = setInterval(load, 10000); // poll every 10s like MessagesScreen
    return () => { cancelled = true; clearInterval(interval); };
  }, [load]);

  async function send() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const res = await staffRequest('/api/chat', {
        action: 'sendMessage',
        sender_id: myId,
        recipient_id: user.id,
        content,
      });
      if (res.success) { setText(''); load(); }
      else Alert.alert('Error', res.message || 'Could not send message.');
    } catch (e) {
      if (!e?.sessionExpired) Alert.alert('Error', 'Could not send message.');
    }
    setSending(false);
  }

  return (
    <View style={s.root}>
      <View style={s.convHeader}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={s.convHeaderInfo}>
          <Text style={s.convName}>
            {user.is_online ? '🟢 ' : ''}{user.name || 'User'}
          </Text>
          {user.role ? <Text style={s.convRole}>{user.role}{user.user_type === 'partner' ? ' (partner)' : ''}</Text> : null}
        </View>
      </View>

      {loading && messages.length === 0
        ? <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />
        : (
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={(item, i) => String(item.id || i)}
            renderItem={({ item }) => {
              const isMine = String(item.sender_id) === String(myId);
              return (
                <View style={[s.bubble, isMine ? s.bubbleMine : s.bubbleTheirs]}>
                  <Text style={[s.bubbleText, isMine ? s.bubbleTextMine : s.bubbleTextTheirs]}>
                    {item.content || ''}
                  </Text>
                  <Text style={[s.bubbleTime, isMine ? { color: 'rgba(255,255,255,0.65)' } : {}]}>
                    {formatTime(item.created_at)}{item.edited_at ? ' (edited)' : ''}
                  </Text>
                </View>
              );
            }}
            contentContainerStyle={s.bubbleList}
            onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={<Text style={s.empty}>No messages yet — say hello!</Text>}
          />
        )
      }

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.inputRow}>
          <TextInput
            style={s.msgInput}
            placeholder="Type a message…"
            placeholderTextColor={COLORS.light}
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity
            style={[s.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}
            onPress={send}
            disabled={!text.trim() || sending}
          >
            {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.sendText}>↑</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Screen (stack — native header provides the title) ──────────────────────────
export default function StaffChatScreen() {
  const [users, setUsers]           = useState([]);
  const [myId, setMyId]             = useState(null);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeUser, setActiveUser] = useState(null);

  const load = useCallback(async (uid) => {
    const id = uid || myId;
    if (!id) return;
    try {
      const res = await staffRequest('/api/chat', { action: 'getUserList', sender_id: id });
      setUsers(res.data || []);
    } catch (e) { /* sessionExpired — fail quietly */ }
    setLoading(false);
    setRefreshing(false);
  }, [myId]);

  useEffect(() => {
    setLoading(true);
    getMyUserId().then(id => {
      setMyId(id);
      if (id) load(id);
      else setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (activeUser) {
    return (
      <ConversationView
        user={activeUser}
        myId={myId}
        onBack={() => { setActiveUser(null); load(); }}
      />
    );
  }

  return (
    <View style={s.root}>
      {loading && users.length === 0
        ? <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />
        : (
          <FlatList
            data={users}
            keyExtractor={item => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity style={s.userRow} onPress={() => setActiveUser(item)} activeOpacity={0.75}>
                <View style={s.avatarWrap}>
                  <View style={[s.avatar, item.user_type === 'partner' && { backgroundColor: COLORS.accent }]}>
                    <Text style={s.avatarText}>{(item.name || '?')[0].toUpperCase()}</Text>
                  </View>
                  {item.is_online ? <View style={s.onlineDot} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.userName}>{item.name || 'User'}</Text>
                  <Text style={s.userRole}>{item.role || (item.user_type === 'partner' ? 'Partner' : 'Staff')}</Text>
                  {item.last_message?.preview ? (
                    <Text style={s.lastMsg} numberOfLines={1}>{item.last_message.preview}</Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  {item.unread > 0 && (
                    <View style={s.unreadBadge}>
                      <Text style={s.unreadText}>{item.unread}</Text>
                    </View>
                  )}
                  {item.last_message?.time ? <Text style={s.msgTime}>{formatDate(item.last_message.time)}</Text> : null}
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={s.userList}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
            ListEmptyComponent={!loading ? <Text style={s.empty}>No users found</Text> : null}
          />
        )
      }
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: COLORS.bg },
  userList:     { padding: 12, paddingBottom: 30 },
  userRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 8, gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  avatarWrap:   { width: 44, height: 44 },
  avatar:       { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { color: '#fff', fontSize: 18, fontWeight: '800' },
  onlineDot:    { position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.success, borderWidth: 2, borderColor: COLORS.card },
  userName:     { fontSize: 15, fontWeight: '700', color: COLORS.text },
  userRole:     { fontSize: 11, color: COLORS.muted, fontWeight: '600', marginTop: 1 },
  lastMsg:      { fontSize: 12, color: COLORS.light, marginTop: 2 },
  unreadBadge:  { backgroundColor: COLORS.danger, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadText:   { color: '#fff', fontSize: 11, fontWeight: '800' },
  msgTime:      { fontSize: 11, color: COLORS.light },
  empty:        { textAlign: 'center', color: COLORS.muted, padding: 40 },
  // Conversation
  convHeader:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12 },
  backBtn:      { paddingRight: 8 },
  backText:     { fontSize: 15, color: COLORS.primary, fontWeight: '700' },
  convHeaderInfo: { flex: 1 },
  convName:     { fontSize: 16, fontWeight: '800', color: COLORS.text },
  convRole:     { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
  bubbleList:   { padding: 12, paddingBottom: 8, flexGrow: 1 },
  bubble:       { maxWidth: '80%', borderRadius: 16, padding: 12, marginBottom: 8 },
  bubbleMine:   { alignSelf: 'flex-end', backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: COLORS.card, borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  bubbleText:   { fontSize: 15, lineHeight: 21 },
  bubbleTextMine:   { color: '#fff' },
  bubbleTextTheirs: { color: COLORS.text },
  bubbleTime:   { fontSize: 10, color: COLORS.light, marginTop: 4, textAlign: 'right' },
  inputRow:     { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border, alignItems: 'flex-end' },
  msgInput:     { flex: 1, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: COLORS.text, maxHeight: 100, backgroundColor: '#fff' },
  sendBtn:      { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  sendText:     { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 24 },
});
