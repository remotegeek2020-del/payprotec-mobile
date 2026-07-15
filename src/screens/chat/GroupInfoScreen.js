import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { COLORS } from '../../config';
import { makeChat } from '../../chat-api';

export default function GroupInfoScreen({ navigation, route }) {
  const { mode, conversation } = route.params;
  const api = useRef(makeChat(mode)).current;
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(!!conversation.is_owner);
  const [rename, setRename]   = useState(false);
  const [newName, setNewName] = useState(conversation.name || '');
  const [addOpen, setAddOpen] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [myId, setMyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.getGroupMembers(conversation.id);
      if (res?.success) setMembers(res.data || []);
    } catch (e) { /* ignore */ }
    setLoading(false);
  }, [api, conversation.id]);

  useEffect(() => { api.myId().then(setMyId); load(); }, [api, load]);

  async function openAdd() {
    setAddOpen(true);
    try {
      const res = await api.getUserList();
      if (res?.success) {
        const existing = new Set(members.map(m => String(m.id)));
        setCandidates((res.data || []).filter(u => !existing.has(String(u.id))));
      }
    } catch (e) { /* ignore */ }
  }

  async function addMember(u) {
    try {
      await api.addGroupMembers(conversation.id, [{ id: u.id, type: u.user_type === 'partner' ? 'partner' : 'staff' }]);
      setAddOpen(false);
      load();
    } catch (e) { Alert.alert('Error', 'Could not add member.'); }
  }

  function removeMember(m) {
    Alert.alert('Remove member', `Remove ${m.name} from the group?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try { await api.removeGroupMember(conversation.id, m.id); load(); }
        catch (e) { Alert.alert('Error', 'Could not remove member.'); }
      } },
    ]);
  }

  async function doRename() {
    const n = newName.trim();
    if (!n) return;
    try { await api.renameGroup(conversation.id, n); conversation.name = n; setRename(false); }
    catch (e) { Alert.alert('Error', 'Could not rename group.'); }
  }

  function leave() {
    Alert.alert('Leave group', 'Leave this group?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: async () => {
        try { await api.leaveGroup(conversation.id); navigation.popToTop(); }
        catch (e) { Alert.alert('Error', 'Could not leave group.'); }
      } },
    ]);
  }

  function destroy() {
    Alert.alert('Delete group', 'Delete this group for everyone? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.deleteGroup(conversation.id); navigation.popToTop(); }
        catch (e) { Alert.alert('Error', 'Could not delete group.'); }
      } },
    ]);
  }

  return (
    <View style={s.root}>
      <View style={s.head}>
        <View style={s.gAvatar}><Text style={{ fontSize: 26 }}>👥</Text></View>
        <Text style={s.gName}>{conversation.name}</Text>
        <TouchableOpacity onPress={() => { setNewName(conversation.name || ''); setRename(true); }}>
          <Text style={s.renameLink}>Rename</Text>
        </TouchableOpacity>
      </View>

      <View style={s.sectionRow}>
        <Text style={s.sectionTitle}>Members {members.length ? `(${members.length})` : ''}</Text>
        <TouchableOpacity onPress={openAdd}><Text style={s.addLink}>＋ Add</Text></TouchableOpacity>
      </View>

      {loading
        ? <ActivityIndicator color={COLORS.primary} style={{ margin: 24 }} />
        : (
          <FlatList
            data={members}
            keyExtractor={m => String(m.id)}
            renderItem={({ item }) => {
              const me = String(item.id) === String(myId);
              return (
                <View style={s.mRow}>
                  <View style={s.mAvatar}><Text style={s.mAvatarText}>{(item.name || '?')[0]?.toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.mName}>{item.name}{me ? ' (you)' : ''}</Text>
                    <Text style={s.mType}>{item.type === 'partner' ? 'Partner' : 'Staff'}</Text>
                  </View>
                  {isOwner && !me ? (
                    <TouchableOpacity onPress={() => removeMember(item)}><Text style={s.removeX}>Remove</Text></TouchableOpacity>
                  ) : null}
                </View>
              );
            }}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )
      }

      <View style={s.footer}>
        <TouchableOpacity style={s.leaveBtn} onPress={leave}><Text style={s.leaveText}>Leave Group</Text></TouchableOpacity>
        {isOwner ? (
          <TouchableOpacity style={s.deleteBtn} onPress={destroy}><Text style={s.deleteText}>Delete Group</Text></TouchableOpacity>
        ) : null}
      </View>

      {/* Rename modal */}
      <Modal visible={rename} transparent animationType="slide" onRequestClose={() => setRename(false)}>
        <View style={s.overlay}>
          <View style={s.card}>
            <Text style={s.cardTitle}>Rename group</Text>
            <TextInput style={s.input} value={newName} onChangeText={setNewName} autoFocus />
            <View style={s.cardBtns}>
              <TouchableOpacity style={s.cancel} onPress={() => setRename(false)}><Text style={s.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={s.save} onPress={doRename}><Text style={s.saveText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add members modal */}
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <View style={s.overlay}>
          <View style={[s.card, { maxHeight: '70%' }]}>
            <View style={s.cardHeadRow}>
              <Text style={s.cardTitle}>Add members</Text>
              <TouchableOpacity onPress={() => setAddOpen(false)}><Text style={s.close}>✕</Text></TouchableOpacity>
            </View>
            <FlatList
              data={candidates}
              keyExtractor={u => String(u.id)}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.candRow} onPress={() => addMember(item)}>
                  <Text style={s.mName}>{item.name}</Text>
                  <Text style={s.addPlus}>＋</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={s.empty}>Everyone's already in this group.</Text>}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: COLORS.bg },
  head:        { alignItems: 'center', paddingVertical: 24, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  gAvatar:     { width: 64, height: 64, borderRadius: 32, backgroundColor: '#6d28d9', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  gName:       { fontSize: 20, fontWeight: '900', color: COLORS.text },
  renameLink:  { fontSize: 13, color: COLORS.primary, fontWeight: '700', marginTop: 6 },
  sectionRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 },
  sectionTitle:{ fontSize: 12, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  addLink:     { fontSize: 14, color: COLORS.primary, fontWeight: '800' },
  mRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.card, borderRadius: 12, padding: 12, marginHorizontal: 12, marginBottom: 8 },
  mAvatar:     { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  mAvatarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  mName:       { fontSize: 15, fontWeight: '700', color: COLORS.text },
  mType:       { fontSize: 12, color: COLORS.muted, marginTop: 1 },
  removeX:     { color: COLORS.danger, fontWeight: '700', fontSize: 13 },
  footer:      { padding: 16, gap: 10 },
  leaveBtn:    { backgroundColor: '#fef3c7', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  leaveText:   { color: '#92620a', fontWeight: '800', fontSize: 15 },
  deleteBtn:   { backgroundColor: '#fee2e2', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  deleteText:  { color: COLORS.danger, fontWeight: '800', fontSize: 15 },
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  card:        { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30 },
  cardHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle:   { fontSize: 16, fontWeight: '900', color: COLORS.text, marginBottom: 12 },
  close:       { fontSize: 18, color: COLORS.muted, fontWeight: '700' },
  input:       { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, padding: 12, fontSize: 15, color: COLORS.text, backgroundColor: '#fff' },
  cardBtns:    { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancel:      { flex: 1, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  cancelText:  { fontSize: 15, fontWeight: '700', color: COLORS.muted },
  save:        { flex: 1, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  saveText:    { fontSize: 15, fontWeight: '800', color: '#fff' },
  candRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  addPlus:     { fontSize: 20, color: COLORS.primary, fontWeight: '800' },
  empty:       { textAlign: 'center', color: COLORS.muted, padding: 24 },
});
