import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Modal, Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../../config';
import { makeChat, REACTIONS, REACTION_EMOJI } from '../../chat-api';

function timeShort(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function ChatThreadScreen({ navigation, route }) {
  const { conversation, mode } = route.params;
  const api = useRef(makeChat(mode)).current;
  const isGroup = !!conversation.is_group;

  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [text, setText]         = useState('');
  const [sending, setSending]   = useState(false);
  const [typing, setTyping]     = useState('');
  const [myId, setMyId]         = useState(null);
  const [actionMsg, setActionMsg] = useState(null); // long-pressed message
  const [editMsg, setEditMsg]   = useState(null);
  const [editText, setEditText] = useState('');
  const listRef = useRef(null);
  const lastTyping = useRef(0);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: conversation.name || (isGroup ? 'Group' : 'Chat'),
      headerRight: isGroup ? () => (
        <TouchableOpacity onPress={() => navigation.navigate('GroupInfo', { mode, conversation })} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ color: COLORS.primary, fontWeight: '800', fontSize: 14, paddingHorizontal: 4 }}>Info</Text>
        </TouchableOpacity>
      ) : undefined,
    });
  }, [navigation, conversation, isGroup, mode]);

  useEffect(() => { api.myId().then(setMyId); }, [api]);

  const load = useCallback(async () => {
    try {
      const res = isGroup ? await api.getGroupHistory(conversation.id) : await api.getHistory(conversation.id);
      if (res?.success) {
        setMessages(res.data || []);
        if (isGroup) setTyping(Array.isArray(res.typing) && res.typing.length ? `${res.typing.join(', ')} typing…` : '');
        else setTyping(res.typing ? 'typing…' : '');
      }
    } catch (e) { /* ignore */ }
    setLoading(false);
  }, [api, conversation.id, isGroup]);

  useFocusEffect(useCallback(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]));

  function onChangeText(t) {
    setText(t);
    const now = Date.now();
    if (now - lastTyping.current > 3000) {
      lastTyping.current = now;
      api.setTyping(conversation.id, isGroup).catch(() => {});
    }
  }

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = isGroup ? await api.sendGroupMessage(conversation.id, body) : await api.sendMessage(conversation.id, body);
      if (res?.success) { setText(''); load(); }
      else Alert.alert('Error', res?.message || 'Could not send.');
    } catch (e) { Alert.alert('Error', 'Could not send message.'); }
    setSending(false);
  }

  async function react(m, r) {
    setActionMsg(null);
    try { await api.reactMessage(m.id, r); load(); } catch (e) { /* ignore */ }
  }

  function beginEdit(m) {
    setActionMsg(null);
    setEditMsg(m);
    setEditText(m.content || '');
  }

  async function saveEdit() {
    const body = editText.trim();
    if (!body) return;
    try { await api.editMessage(editMsg.id, body); load(); } catch (e) { /* ignore */ }
    setEditMsg(null);
  }

  function del(m) {
    setActionMsg(null);
    Alert.alert('Delete message', 'Delete this message for everyone?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.deleteMessage(m.id); load(); } catch (e) {} } },
    ]);
  }

  function renderMessage({ item }) {
    const mine = String(item.sender_id) === String(myId);
    const reactions = item.reactions || {};
    const reactionKeys = Object.keys(reactions).filter(k => reactions[k] > 0);
    return (
      <Pressable onLongPress={() => setActionMsg(item)} delayLongPress={250}>
        <View style={[s.bubbleRow, mine ? s.rowMine : s.rowTheirs]}>
          <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs]}>
            {isGroup && !mine ? <Text style={s.sender}>{item.sender_name || 'Unknown'}</Text> : null}
            <Text style={[s.msgText, mine ? s.msgTextMine : s.msgTextTheirs]}>{item.content || 'Message unavailable'}</Text>
            <View style={s.metaRow}>
              {item.edited_at ? <Text style={[s.edited, mine && { color: 'rgba(255,255,255,0.7)' }]}>edited</Text> : null}
              <Text style={[s.time, mine && { color: 'rgba(255,255,255,0.7)' }]}>{timeShort(item.created_at)}</Text>
              {mine && item.read_at && !isGroup ? <Text style={[s.seen]}>✓ Seen</Text> : null}
            </View>
          </View>
          {reactionKeys.length ? (
            <View style={[s.reactBar, mine ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
              {reactionKeys.map(k => (
                <Text key={k} style={s.reactChip}>{REACTION_EMOJI[k] || '•'} {reactions[k]}</Text>
              ))}
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {loading && messages.length === 0
        ? <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />
        : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m, i) => String(m.id || i)}
            renderItem={renderMessage}
            contentContainerStyle={s.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={<Text style={s.empty}>No messages yet. Say hello 👋</Text>}
          />
        )
      }

      {typing ? <Text style={s.typing}>{typing}</Text> : null}

      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          placeholder="Message…"
          placeholderTextColor={COLORS.light}
          value={text}
          onChangeText={onChangeText}
          multiline
        />
        <TouchableOpacity style={[s.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]} onPress={send} disabled={!text.trim() || sending}>
          {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.sendText}>↑</Text>}
        </TouchableOpacity>
      </View>

      {/* Long-press action sheet: react + (own) edit/delete */}
      <Modal visible={!!actionMsg} transparent animationType="fade" onRequestClose={() => setActionMsg(null)}>
        <Pressable style={s.overlay} onPress={() => setActionMsg(null)}>
          <View style={s.sheet}>
            <View style={s.reactPicker}>
              {REACTIONS.map(r => (
                <TouchableOpacity key={r} onPress={() => react(actionMsg, r)}>
                  <Text style={s.reactEmoji}>{REACTION_EMOJI[r]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {actionMsg && String(actionMsg.sender_id) === String(myId) ? (
              <View style={s.ownActions}>
                <TouchableOpacity style={s.ownBtn} onPress={() => beginEdit(actionMsg)}>
                  <Text style={s.ownBtnText}>✏️  Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.ownBtn} onPress={() => del(actionMsg)}>
                  <Text style={[s.ownBtnText, { color: COLORS.danger }]}>🗑  Delete</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </Pressable>
      </Modal>

      {/* Edit modal */}
      <Modal visible={!!editMsg} transparent animationType="slide" onRequestClose={() => setEditMsg(null)}>
        <View style={s.overlay}>
          <View style={s.editCard}>
            <Text style={s.editTitle}>Edit message</Text>
            <TextInput style={s.editInput} value={editText} onChangeText={setEditText} multiline autoFocus />
            <View style={s.editBtns}>
              <TouchableOpacity style={s.editCancel} onPress={() => setEditMsg(null)}><Text style={s.editCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={s.editSave} onPress={saveEdit}><Text style={s.editSaveText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: COLORS.bg },
  list:        { padding: 12, paddingBottom: 8 },
  bubbleRow:   { marginBottom: 10, maxWidth: '84%' },
  rowMine:     { alignSelf: 'flex-end' },
  rowTheirs:   { alignSelf: 'flex-start' },
  bubble:      { borderRadius: 16, paddingHorizontal: 13, paddingVertical: 9 },
  bubbleMine:  { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleTheirs:{ backgroundColor: COLORS.card, borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  sender:      { fontSize: 11, fontWeight: '800', color: '#6d28d9', marginBottom: 3 },
  msgText:     { fontSize: 15, lineHeight: 20 },
  msgTextMine: { color: '#fff' },
  msgTextTheirs:{ color: COLORS.text },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, justifyContent: 'flex-end' },
  edited:      { fontSize: 10, color: COLORS.light, fontStyle: 'italic' },
  time:        { fontSize: 10, color: COLORS.light },
  seen:        { fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: '700' },
  reactBar:    { flexDirection: 'row', gap: 4, marginTop: 3 },
  reactChip:   { fontSize: 12, backgroundColor: COLORS.card, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  typing:      { fontSize: 12, color: COLORS.muted, fontStyle: 'italic', paddingHorizontal: 16, paddingBottom: 4 },
  inputRow:    { flexDirection: 'row', padding: 10, gap: 8, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border, alignItems: 'flex-end' },
  input:       { flex: 1, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: COLORS.text, maxHeight: 100, backgroundColor: '#fff' },
  sendBtn:     { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  sendText:    { color: '#fff', fontSize: 20, fontWeight: '700' },
  empty:       { textAlign: 'center', color: COLORS.muted, padding: 40, fontSize: 14 },
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  reactPicker: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 6 },
  reactEmoji:  { fontSize: 32 },
  ownActions:  { flexDirection: 'row', gap: 12, marginTop: 16 },
  ownBtn:      { flex: 1, backgroundColor: COLORS.bg, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  ownBtnText:  { fontSize: 15, fontWeight: '800', color: COLORS.text },
  editCard:    { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  editTitle:   { fontSize: 16, fontWeight: '900', color: COLORS.text, marginBottom: 12 },
  editInput:   { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, padding: 12, fontSize: 15, color: COLORS.text, minHeight: 60, textAlignVertical: 'top', backgroundColor: '#fff' },
  editBtns:    { flexDirection: 'row', gap: 12, marginTop: 16 },
  editCancel:  { flex: 1, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  editCancelText: { fontSize: 15, fontWeight: '700', color: COLORS.muted },
  editSave:    { flex: 1, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  editSaveText:{ fontSize: 15, fontWeight: '800', color: '#fff' },
});
