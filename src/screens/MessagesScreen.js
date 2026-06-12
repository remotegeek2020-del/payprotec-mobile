import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { COLORS } from '../config';
import { Chat } from '../api';
import { Storage } from '../storage';

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

// ── Conversation (message thread) ─────────────────────────────────────────────
function ConversationScreen({ user, onBack }) {
  const [messages, setMessages]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [text, setText]           = useState('');
  const [sending, setSending]     = useState(false);
  const [myId, setMyId]           = useState(null);
  const flatRef = useRef(null);

  useEffect(() => {
    Storage.get('partner_person_id').then(id => setMyId(id));
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [user?.id]);

  async function load() {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await Chat.getHistory(user.id);
      setMessages(res.messages || res.data || []);
    } catch (e) { /* ignore */ }
    setLoading(false);
  }

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await Chat.sendMessage(user.id, body);
      if (res.success) { setText(''); load(); }
      else Alert.alert('Error', res.error || 'Could not send message.');
    } catch (e) { Alert.alert('Error', 'Could not send message.'); }
    setSending(false);
  }

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.convHeader}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={s.convHeaderInfo}>
          <Text style={s.convName}>{user.name || user.full_name || 'Staff'}</Text>
          {user.role ? <Text style={s.convRole}>{user.role}</Text> : null}
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
              const isMine = item.sender_id === myId || item.sender_type === 'partner';
              return (
                <View style={[s.bubble, isMine ? s.bubbleMine : s.bubbleTheirs]}>
                  <Text style={[s.bubbleText, isMine ? s.bubbleTextMine : s.bubbleTextTheirs]}>
                    {item.message || item.body || ''}
                  </Text>
                  <Text style={[s.bubbleTime, isMine ? { color: 'rgba(255,255,255,0.65)' } : {}]}>
                    {formatTime(item.created_at)}
                  </Text>
                </View>
              );
            }}
            contentContainerStyle={s.bubbleList}
            onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
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

// ── User list ─────────────────────────────────────────────────────────────────
export default function MessagesScreen() {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [activeUser, setActiveUser] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await Chat.getUserList();
      setUsers(res.users || res.data || []);
    } catch (e) { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (activeUser) {
    return <ConversationScreen user={activeUser} onBack={() => setActiveUser(null)} />;
  }

  return (
    <View style={s.root}>
      <Text style={s.screenTitle}>Messages</Text>
      {loading
        ? <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />
        : users.length === 0
          ? <Text style={s.empty}>No conversations yet</Text>
          : (
            <FlatList
              data={users}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.userRow} onPress={() => setActiveUser(item)} activeOpacity={0.75}>
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>{(item.name || item.full_name || '?')[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.userName}>{item.name || item.full_name || 'Staff'}</Text>
                    {item.role ? <Text style={s.userRole}>{item.role}</Text> : null}
                    {item.last_message ? <Text style={s.lastMsg} numberOfLines={1}>{item.last_message}</Text> : null}
                  </View>
                  {item.unread_count > 0 && (
                    <View style={s.unreadBadge}>
                      <Text style={s.unreadText}>{item.unread_count}</Text>
                    </View>
                  )}
                  {item.last_message_at ? <Text style={s.msgTime}>{formatDate(item.last_message_at)}</Text> : null}
                </TouchableOpacity>
              )}
              contentContainerStyle={s.userList}
            />
          )
      }
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: COLORS.bg },
  screenTitle:  { fontSize: 22, fontWeight: '900', color: COLORS.text, padding: 16, paddingBottom: 8 },
  userList:     { paddingHorizontal: 12, paddingBottom: 30 },
  userRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 8, gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  avatar:       { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { color: '#fff', fontSize: 18, fontWeight: '800' },
  userName:     { fontSize: 15, fontWeight: '700', color: COLORS.text },
  userRole:     { fontSize: 11, color: COLORS.muted, fontWeight: '600', marginTop: 1 },
  lastMsg:      { fontSize: 12, color: COLORS.light, marginTop: 2 },
  unreadBadge:  { backgroundColor: COLORS.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
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
  bubbleList:   { padding: 12, paddingBottom: 8 },
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
