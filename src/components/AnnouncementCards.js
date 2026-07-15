import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking } from 'react-native';
import { COLORS } from '../config';

// body_text is authored as HTML on the web (WYSIWYG). Native has no HTML
// renderer, so convert block tags to line breaks, strip the rest, and decode
// the common entities.
function htmlToText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|h[1-6]|li)\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Renders active marketing announcements as homepage cards. `api` supplies
// getActive / track / dismiss (partner or staff variant). Mirrors the web
// homepage announcement card: impression tracked once, CTA opens the link and
// tracks a click, dismissible cards can be permanently dismissed.
export default function AnnouncementCards({ api }) {
  const [items, setItems] = useState([]);
  const tracked = useRef(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getActive();
        if (cancelled || !res?.success) return;
        const list = res.data || [];
        setItems(list);
        list.forEach(c => {
          if (c?.id && !tracked.current.has(c.id)) {
            tracked.current.add(c.id);
            api.track(c.id, 'impression', c.variant).catch(() => {});
          }
        });
      } catch (e) { /* ignore — announcements are non-critical */ }
    })();
    return () => { cancelled = true; };
  }, []);

  function onCta(c) {
    api.track(c.id, 'click', c.variant, c.cta_url).catch(() => {});
    if (/until_action$/.test(c.display_mode || '')) {
      api.dismiss(c.id).catch(() => {});
      setItems(list => list.filter(x => x.id !== c.id));
    }
    if (c.cta_url) Linking.openURL(c.cta_url).catch(() => {});
  }

  function onDismiss(c) {
    api.dismiss(c.id).catch(() => {});
    setItems(list => list.filter(x => x.id !== c.id));
  }

  if (!items.length) return null;

  return (
    <View style={s.wrap}>
      {items.map(c => {
        const dismissible = /dismissible$/.test(c.display_mode || 'card_dismissible');
        return (
          <View key={c.id} style={s.card}>
            {dismissible && (
              <TouchableOpacity style={s.close} onPress={() => onDismiss(c)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.closeText}>✕</Text>
              </TouchableOpacity>
            )}
            {c.image_url ? (
              <Image source={{ uri: c.image_url }} style={s.image} resizeMode="cover" />
            ) : null}
            <View style={s.body}>
              {c.title ? <Text style={s.title}>{htmlToText(c.title)}</Text> : null}
              {c.body_text ? <Text style={s.text}>{htmlToText(c.body_text)}</Text> : null}
              {c.cta_enabled && c.cta_label ? (
                <TouchableOpacity style={s.cta} onPress={() => onCta(c)} activeOpacity={0.85}>
                  <Text style={s.ctaText}>{c.cta_label}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:     { marginBottom: 8 },
  card:     { backgroundColor: COLORS.card, borderRadius: 16, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3, borderWidth: 1, borderColor: COLORS.border },
  close:    { position: 'absolute', top: 8, right: 8, zIndex: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  closeText:{ color: '#fff', fontSize: 13, fontWeight: '800' },
  image:    { width: '100%', height: 150, backgroundColor: COLORS.bg },
  body:     { padding: 16 },
  title:    { fontSize: 16, fontWeight: '900', color: COLORS.text, marginBottom: 6, letterSpacing: -0.01 },
  text:     { fontSize: 14, color: COLORS.ink || COLORS.text, lineHeight: 20 },
  cta:      { alignSelf: 'flex-start', marginTop: 14, backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11 },
  ctaText:  { color: '#fff', fontSize: 14, fontWeight: '800' },
});
