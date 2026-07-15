import { API_BASE_URL } from './config';
import { Storage } from './storage';

// Unified client for /api/chat. The backend derives the sender from the token,
// so partner calls carry `partner_token` in the body and staff calls send the
// Bearer session header. One helper serves both portals.
async function call(mode, body) {
  const headers = { 'Content-Type': 'application/json' };
  let payload = body;
  if (mode === 'staff') {
    const token = await Storage.get('staff_session_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } else {
    const partner_token = await Storage.get('partner_session_token');
    payload = { ...body, partner_token };
  }
  const res = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch (e) { return { success: false, error: `Server error (${res.status})` }; }
}

export const REACTIONS = ['like', 'love', 'laugh', 'wow', 'sad', 'angry'];
export const REACTION_EMOJI = { like: '👍', love: '❤️', laugh: '😂', wow: '😮', sad: '😢', angry: '😡' };

export function makeChat(mode) {
  const c = (body) => call(mode, body);
  return {
    mode,
    async myId() {
      if (mode === 'staff') {
        const raw = await Storage.get('staff_user');
        try { return String(JSON.parse(raw).userid); } catch (e) { return null; }
      }
      return Storage.get('partner_person_id');
    },
    // Lists
    getUserList:  () => c({ action: 'getUserList' }),
    getGroups:    () => c({ action: 'getGroups' }),
    getUnreadCount: () => c({ action: 'getUnreadCount' }),
    // Threads
    getHistory:      (recipient_id, page = 0) => c({ action: 'getHistory', recipient_id, page, limit: 50 }),
    getGroupHistory: (group_id, page = 0)     => c({ action: 'getGroupHistory', group_id, page, limit: 50 }),
    sendMessage:      (recipient_id, content) => c({ action: 'sendMessage', recipient_id, content, message_type: 'dm' }),
    sendGroupMessage: (group_id, content)     => c({ action: 'sendGroupMessage', group_id, content }),
    editMessage:   (message_id, content) => c({ action: 'editMessage', message_id, content }),
    deleteMessage: (message_id)          => c({ action: 'deleteMessage', message_id }),
    reactMessage:  (message_id, reaction) => c({ action: 'reactMessage', message_id, reaction }),
    setTyping:     (target_id, is_group) => c({ action: 'setTyping', target_id, is_group }),
    // Groups
    createGroup:       (name, members)         => c({ action: 'createGroup', name, members }),
    getGroupMembers:   (group_id)              => c({ action: 'getGroupMembers', group_id }),
    addGroupMembers:   (group_id, members)     => c({ action: 'addGroupMembers', group_id, members }),
    removeGroupMember: (group_id, member_id)   => c({ action: 'removeGroupMember', group_id, member_id }),
    renameGroup:       (group_id, name)        => c({ action: 'renameGroup', group_id, name }),
    leaveGroup:        (group_id)              => c({ action: 'leaveGroup', group_id }),
    deleteGroup:       (group_id)              => c({ action: 'deleteGroup', group_id }),
    // Presence
    setStatus:  (status) => c({ action: 'setStatus', status }),
  };
}
