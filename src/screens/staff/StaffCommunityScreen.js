import React from 'react';
import { staffRequest } from '../../staff-api';
import { Storage } from '../../storage';
import CommunityScreen from '../CommunityScreen';

// Staff community uses the same /api/community endpoint and actions as the
// partner community, but authenticates with the staff Bearer session and
// identifies the author via `staff_userid` in the body (resolveUser in
// api/community.js).
async function req(body) {
  const raw = await Storage.get('staff_user');
  const me = raw ? JSON.parse(raw) : {};
  return staffRequest('/api/community', { staff_userid: me.userid, ...body });
}

const StaffCommunity = {
  getChannels() {
    return req({ action: 'get_channels' });
  },
  getFeed({ channel_id, page = 0, limit = 20 } = {}) {
    const body = { action: 'get_feed', page, limit };
    if (channel_id) body.channel_id = channel_id;
    return req(body);
  },
  createPost(channel_id, body) {
    return req({ action: 'create_post', body, channel_id });
  },
  react(post_id, emoji = '👍') {
    return req({ action: 'react', post_id, emoji });
  },
  getComments(post_id) {
    return req({ action: 'get_comments', post_id });
  },
  addComment(post_id, body) {
    return req({ action: 'add_comment', post_id, body });
  },
};

export default function StaffCommunityScreen() {
  return <CommunityScreen api={StaffCommunity} />;
}
