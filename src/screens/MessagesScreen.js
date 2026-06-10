import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { COLORS } from '../config';
import { Chat } from '../api';
import { Storage as St } from '../storage';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function Avatar({ name, size = 36 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[s.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

function ConversationRow({ item, onPress }) {
  return (
    <TouchableOpacity style={s.convRow} onPress={() => onPress(item)} activeOpacity={0.75}>
      <Avatar name={item.full_name} />
      <View style={s.convInfo}>
        <View style={s.convTop}>
          <Text style={s.convName} numberOfLines={1}>{item.full_name || '—'}</Text>
          {item.last_message?.created_at ? (
            <Text style={s.convTime}>{timeAgo(item.last_message.created_at)}</Text>
          ) : null}
        </View>
        <Text style={s.convPreview} numberOfLines={1}>
          {item.last_message?.body || 'No messages yet'}
        </Text>
      </View>
      {item.unread_count > 0 && (
        <View style={s.unreadBadge}>
          <Text style={s.unreadText}>{item.unread_count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function ThreadModal({ user, visible, onClose, myId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [text, setText]         = useState('');
  const [sending, setSending]   = useState(false);
  const intervalRef = useRef(null);
  const listRef     = useRef(null);

  async function fetchThread() {
    if (!user?.id) return;
    try {
      const d = await Chat.getHistory(user.id);
      setMessages(d.messages || []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    if (visible && user?.id) {
      setLoading(true);
      fetchThread();
      intervalRef.current = setInterval(fetchThread, 15000);
    }
    return () => {
      clearInterval(intervalRef.current);
      setMessages([]);
      setText('');
    };
  }, [visible, user?.id]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const optimistic = { id: `tmp-${Date.now()}`, body, sender_id: myId, created_at: new Date().toISOString(), _pending: true };
    setMessages(prev => [...prev, optimistic]);
    setText('');
    try {
      await Chat.sendMessage(user.id, body);
      await fetchThread();
    } catch {}
    setSending(false);
  }

  if (!user) return null;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView style={s.threadCard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHeader}>
            <Avatar name={user.full_name} size={32} />
            <Text style={s.threadTitle} numberOfLines={1}>{user.full_name}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading
            ? <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />
            : <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(item, i) => String(item.id || i)}
                renderItem={({ item }) => {
                  const isMine = String(item.sender_id) === String(myId);
                  return (
                    <View style={[s.bubble, isMine ? s.bubbleMine : s.bubbleTheirs]}>
                      <Text style={[s.bubbleText, isMine && s.bubbleTextMine]}>{item.body}</Text>
                      <Text style={[s.bubbleTime, isMine && s.bubbleTimeMine]}>{timeAgo(item.created_at)}</Text>
                    </View>
                  );
                }}
                contentContainerStyle={{ padding: 12 }}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                ListEmptyComponent={<Text style={s.empty}>No messages yet. Say hello!</Text>}
              />
          }

          <View style={s.inputRow}>
            <TextInput
              style={s.inputBox}
              placeholder="Message…"
              placeholderTextColor={COLORS.light}
              value={text}
              onChangeText={setText}
              onSubmitEditing={send}
              returnKeyType="send"
              multiline
            />
            <TouchableOpacity
              style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnDisabled]}
              onPress={send}
              disabled={!text.trim() || sending}
            >
              {sending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.sendBtnText}>▶</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export default function MessagesScreen() {
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected]   = useState(null);
  const [myId, setMyId]           = useState(null);

  async function loadMyId() {
    const id = await St.get('user_id');
    setMyId(id);
  }

  async function loadUsers(refresh = false) {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const d = await Chat.getUserList();
      setUsers(Array.isArray(d) ? d : (d.data || d.users || []));
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { loadMyId(); loadUsers(); }, []);

  return (
    <View style={s.container}>
      {loading
        ? <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />
        : <FlatList
            data={users}
            keyExtractor={item => String(item.id)}
            renderItem={({ item }) => <ConversationRow item={item} onPress={setSelected} />}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadUsers(true)} tintColor={COLORS.primary} />}
            ListEmptyComponent={<Text style={s.empty}>No conversations yet</Text>}
          />
      }
      <ThreadModal
        user={selected}
        visible={!!selected}
        onClose={() => setSelected(null)}
        myId={myId}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.bg },
  convRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  avatar:         { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText:     { color: '#fff', fontWeight: '800' },
  convInfo:       { flex: 1, marginLeft: 12 },
  convTop:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convName:       { fontSize: 14, fontWeight: '700', color: COLORS.text, flex: 1 },
  convTime:       { fontSize: 11, color: COLORS.muted, marginLeft: 8 },
  convPreview:    { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  unreadBadge:    { backgroundColor: COLORS.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginLeft: 8 },
  unreadText:     { color: '#fff', fontSize: 11, fontWeight: '800' },
  empty:          { textAlign: 'center', color: COLORS.muted, padding: 40, fontSize: 14 },
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  threadCard:     { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '85%' },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  threadTitle:    { flex: 1, fontSize: 16, fontWeight: '800', color: COLORS.text },
  modalClose:     { fontSize: 18, color: COLORS.muted, fontWeight: '700' },
  bubble:         { maxWidth: '75%', marginBottom: 8, padding: 10, borderRadius: 16 },
  bubbleMine:     { alignSelf: 'flex-end', backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleTheirs:   { alignSelf: 'flex-start', backgroundColor: COLORS.bg, borderBottomLeftRadius: 4 },
  bubbleText:     { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  bubbleTextMine: { color: '#fff' },
  bubbleTime:     { fontSize: 10, color: COLORS.muted, marginTop: 3, textAlign: 'right' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.7)' },
  inputRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  inputBox:       { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, color: COLORS.text, maxHeight: 80, textAlignVertical: 'top' },
  sendBtn:        { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled:{ backgroundColor: COLORS.light },
  sendBtnText:    { color: '#fff', fontSize: 18, lineHeight: 22 },
});
