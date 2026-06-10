import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS } from '../config';
import { Community } from '../api';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function Avatar({ name, size = 36 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[s.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

function PostCard({ item, onOpen }) {
  return (
    <TouchableOpacity style={s.postCard} onPress={() => onOpen(item)} activeOpacity={0.8}>
      <View style={s.postTop}>
        <Avatar name={item.author_name} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.authorName}>{item.author_name || 'Unknown'}</Text>
          <Text style={s.postTime}>{timeAgo(item.created_at)}</Text>
        </View>
        {item.channel_name ? (
          <View style={s.channelBadge}>
            <Text style={s.channelText}>{item.channel_name}</Text>
          </View>
        ) : null}
      </View>
      <Text style={s.postBody} numberOfLines={4}>{item.body || ''}</Text>
      <View style={s.postFooter}>
        <Text style={s.reactionCount}>{item.reaction_count > 0 ? `👍 ${item.reaction_count}` : ''}</Text>
        <Text style={s.commentCount}>{item.comment_count > 0 ? `💬 ${item.comment_count}` : ''}</Text>
      </View>
    </TouchableOpacity>
  );
}

function PostDetailModal({ post, visible, onClose }) {
  const [comments, setComments]     = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting]         = useState(false);
  const [reacted, setReacted]         = useState(false);
  const [reactionCount, setReactionCount] = useState(post?.reaction_count || 0);

  useEffect(() => {
    if (visible && post?.id) {
      setLoadingComments(true);
      setReacted(post.liked_by_me || false);
      setReactionCount(post.reaction_count || 0);
      Community.getComments(post.id)
        .then(d => setComments(d.data || []))
        .catch(() => {})
        .finally(() => setLoadingComments(false));
    } else {
      setComments([]); setCommentText('');
    }
  }, [visible, post?.id]);

  async function handleReact() {
    try {
      const res = await Community.react(post.id);
      setReacted(res.action === 'added');
      setReactionCount(res.count ?? reactionCount);
    } catch {}
  }

  async function submitComment() {
    const text = commentText.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      await Community.addComment(post.id, text);
      setComments(prev => [...prev, { body: text, author_name: 'You', created_at: new Date().toISOString() }]);
      setCommentText('');
    } catch {}
    setPosting(false);
  }

  if (!post) return null;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView style={s.modalCard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle} numberOfLines={1}>{post.author_name || 'Post'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
            <Text style={s.detailTime}>{timeAgo(post.created_at)}</Text>
            <Text style={s.detailBody}>{post.body || ''}</Text>

            <TouchableOpacity style={[s.reactBtn, reacted && s.reactBtnActive]} onPress={handleReact}>
              <Text style={[s.reactBtnText, reacted && s.reactBtnTextActive]}>
                👍 {reactionCount > 0 ? reactionCount : ''} Like
              </Text>
            </TouchableOpacity>

            <Text style={s.commentsTitle}>Comments {comments.length > 0 ? `(${comments.length})` : ''}</Text>

            {loadingComments
              ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} />
              : comments.map((c, i) => (
                  <View key={i} style={s.commentItem}>
                    <Avatar name={c.author_name} size={28} />
                    <View style={s.commentBubble}>
                      <Text style={s.commentAuthor}>{c.author_name || 'Unknown'}</Text>
                      <Text style={s.commentBody}>{c.body || ''}</Text>
                    </View>
                  </View>
                ))
            }
          </ScrollView>

          <View style={s.commentInput}>
            <TextInput
              style={s.commentBox}
              placeholder="Write a comment…"
              placeholderTextColor={COLORS.light}
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <TouchableOpacity
              style={[s.sendBtn, (!commentText.trim() || posting) && s.sendBtnDisabled]}
              onPress={submitComment}
              disabled={!commentText.trim() || posting}
            >
              {posting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.sendBtnText}>Send</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function CreatePostModal({ visible, channels, onClose, onCreated }) {
  const [body, setBody]           = useState('');
  const [channelId, setChannelId] = useState(null);
  const [saving, setSaving]       = useState(false);

  function reset() { setBody(''); setChannelId(channels[0]?.id || null); }

  useEffect(() => {
    if (visible && channels.length) setChannelId(channels[0].id);
  }, [visible]);

  async function submit() {
    if (!body.trim() || !channelId || saving) return;
    setSaving(true);
    try {
      await Community.createPost(channelId, body.trim());
      reset();
      onClose();
      onCreated();
    } catch {}
    setSaving(false);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView style={s.modalCard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>New Post</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {channels.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {channels.map(ch => (
                  <TouchableOpacity
                    key={ch.id}
                    style={[s.channelChip, channelId === ch.id && s.channelChipActive]}
                    onPress={() => setChannelId(ch.id)}
                  >
                    <Text style={[s.channelChipText, channelId === ch.id && s.channelChipTextActive]}>
                      {ch.name || ch.id}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          <TextInput
            style={s.postInput}
            placeholder="What's on your mind?"
            placeholderTextColor={COLORS.light}
            value={body}
            onChangeText={setBody}
            multiline
            autoFocus
          />

          <TouchableOpacity
            style={[s.postSubmitBtn, (!body.trim() || saving) && s.postSubmitBtnDisabled]}
            onPress={submit}
            disabled={!body.trim() || saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.postSubmitText}>Post</Text>
            }
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export default function CommunityScreen() {
  const [posts, setPosts]         = useState([]);
  const [channels, setChannels]   = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore]     = useState(false);
  const [page, setPage]           = useState(0);
  const [selected, setSelected]   = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  async function loadChannels() {
    try {
      const d = await Community.getChannels();
      const ch = d.data || [];
      setChannels(ch);
      if (ch.length && !activeChannel) setActiveChannel(ch[0].id);
    } catch {}
  }

  async function loadPosts(channelId = activeChannel, pg = 0, append = false) {
    if (pg === 0) setLoading(true);
    try {
      const d = await Community.getFeed({ channel_id: channelId, page: pg, limit: 20 });
      const rows = d.data || [];
      setPosts(append ? prev => [...prev, ...rows] : rows);
      setHasMore(d.has_more || false);
      setPage(pg);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { loadChannels(); }, []);
  useEffect(() => { if (activeChannel) loadPosts(activeChannel, 0, false); }, [activeChannel]);

  function onRefresh() { setRefreshing(true); loadPosts(activeChannel, 0, false); }
  function loadMore()  { if (hasMore && !loading) loadPosts(activeChannel, page + 1, true); }

  return (
    <View style={s.container}>
      {channels.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.channelBar} contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10, gap: 8 }}>
          {channels.map(ch => (
            <TouchableOpacity
              key={ch.id}
              style={[s.channelTab, activeChannel === ch.id && s.channelTabActive]}
              onPress={() => setActiveChannel(ch.id)}
            >
              <Text style={[s.channelTabText, activeChannel === ch.id && s.channelTabTextActive]}>
                {ch.name || ch.id}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading && posts.length === 0
        ? <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />
        : <FlatList
            data={posts}
            keyExtractor={(item, i) => String(item.id || i)}
            renderItem={({ item }) => <PostCard item={item} onOpen={setSelected} />}
            contentContainerStyle={s.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
            onEndReached={loadMore}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={!loading ? <Text style={s.empty}>No posts yet. Be the first!</Text> : null}
            ListFooterComponent={loading && posts.length > 0 ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> : null}
          />
      }

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>

      <PostDetailModal post={selected} visible={!!selected} onClose={() => setSelected(null)} />
      <CreatePostModal
        visible={showCreate}
        channels={channels}
        onClose={() => setShowCreate(false)}
        onCreated={() => loadPosts(activeChannel, 0, false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.bg },
  channelBar:     { flexGrow: 0, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  channelTab:     { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg },
  channelTabActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  channelTabText:       { fontSize: 13, fontWeight: '700', color: COLORS.muted },
  channelTabTextActive: { color: '#fff' },
  list:           { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 80 },
  postCard:       { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  postTop:        { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar:         { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText:     { color: '#fff', fontWeight: '800' },
  authorName:     { fontSize: 13, fontWeight: '700', color: COLORS.text },
  postTime:       { fontSize: 11, color: COLORS.muted, marginTop: 1 },
  channelBadge:   { backgroundColor: COLORS.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  channelText:    { fontSize: 10, fontWeight: '700', color: COLORS.muted },
  postBody:       { fontSize: 14, color: COLORS.text, lineHeight: 20, marginBottom: 10 },
  postFooter:     { flexDirection: 'row', gap: 12 },
  reactionCount:  { fontSize: 12, color: COLORS.muted },
  commentCount:   { fontSize: 12, color: COLORS.muted },
  empty:          { textAlign: 'center', color: COLORS.muted, padding: 40, fontSize: 14 },
  fab:            { position: 'absolute', bottom: 24, right: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 6 },
  fabText:        { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 34 },
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard:      { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle:     { fontSize: 17, fontWeight: '800', color: COLORS.text, flex: 1, marginRight: 10 },
  modalClose:     { fontSize: 18, color: COLORS.muted, fontWeight: '700' },
  detailTime:     { fontSize: 11, color: COLORS.muted, marginBottom: 8 },
  detailBody:     { fontSize: 15, color: COLORS.text, lineHeight: 22, marginBottom: 16 },
  reactBtn:       { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  reactBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  reactBtnText:   { fontSize: 13, fontWeight: '700', color: COLORS.muted },
  reactBtnTextActive: { color: '#fff' },
  commentsTitle:  { fontSize: 13, fontWeight: '800', color: COLORS.text, marginBottom: 10 },
  commentItem:    { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-start' },
  commentBubble:  { flex: 1, marginLeft: 10, backgroundColor: COLORS.bg, borderRadius: 12, padding: 10 },
  commentAuthor:  { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginBottom: 2 },
  commentBody:    { fontSize: 13, color: COLORS.text, lineHeight: 18 },
  commentInput:   { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  commentBox:     { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 10, fontSize: 14, color: COLORS.text, maxHeight: 80, textAlignVertical: 'top' },
  sendBtn:        { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  sendBtnDisabled:{ backgroundColor: COLORS.light },
  sendBtnText:    { color: '#fff', fontWeight: '700', fontSize: 13 },
  postInput:      { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, fontSize: 14, color: COLORS.text, minHeight: 100, textAlignVertical: 'top', marginBottom: 12 },
  postSubmitBtn:  { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  postSubmitBtnDisabled: { backgroundColor: COLORS.light },
  postSubmitText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  channelChip:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg },
  channelChipActive:   { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  channelChipText:     { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  channelChipTextActive: { color: '#fff' },
});
