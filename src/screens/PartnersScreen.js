import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, TextInput, Alert,
} from 'react-native';
import { COLORS } from '../config';
import { Partners, Tickets } from '../api';

const TIER_COLORS = {
  gold:     { bg: '#fef3c7', text: '#d97706' },
  silver:   { bg: '#f1f5f9', text: '#64748b' },
  bronze:   { bg: '#fde8d8', text: '#b45309' },
  platinum: { bg: '#e0f2fe', text: '#0369a1' },
};

function tierStyle(tier) {
  return TIER_COLORS[(tier || '').toLowerCase()] || { bg: COLORS.bg, text: COLORS.muted };
}

function fmt$(n) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// ── Leaderboard card ──────────────────────────────────────────────────────────

function LeaderboardCard({ item, onPress }) {
  const ts = tierStyle(item.tier);
  return (
    <TouchableOpacity style={s.card} onPress={() => onPress(item)} activeOpacity={0.75}>
      <View style={s.cardTop}>
        <View style={s.rankBadge}>
          <Text style={s.rankText}>#{item.rank ?? '—'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.agentName} numberOfLines={1}>{item.name || '—'}</Text>
          <Text style={s.subLine} numberOfLines={1}>{item.company_name || ''}</Text>
        </View>
        {item.tier ? (
          <View style={[s.tierBadge, { backgroundColor: ts.bg }]}>
            <Text style={[s.tierText, { color: ts.text }]}>{item.tier.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>
      <View style={s.cardStats}>
        <View style={s.stat}>
          <Text style={s.statNum}>{item.merchant_count ?? '—'}</Text>
          <Text style={s.statLabel}>Merchants</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statNum}>{fmt$(item.volume_30_day)}</Text>
          <Text style={s.statLabel}>30-Day Vol</Text>
        </View>
        <View style={s.stat}>
          <Text style={[s.statNum, { color: item.growth_pct >= 0 ? COLORS.success : COLORS.danger }]}>
            {item.growth_pct != null
              ? `${item.growth_pct > 0 ? '+' : ''}${Number(item.growth_pct).toFixed(1)}%`
              : '—'}
          </Text>
          <Text style={s.statLabel}>Growth</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Partner card (All Partners tab) ──────────────────────────────────────────
// Shows a person's avatar, name, email, and all companies + agent IDs inline.

function PersonCard({ person, agentRows, onPress }) {
  const totalIds = agentRows.reduce((n, a) => n + (a.identifiers?.length || 0), 0);
  return (
    <TouchableOpacity style={s.card} onPress={() => onPress(person, agentRows)} activeOpacity={0.75}>
      {/* Header row */}
      <View style={s.cardTop}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initials(person.full_name)}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.agentName} numberOfLines={1}>{person.full_name || '—'}</Text>
          {person.email ? <Text style={s.subLine} numberOfLines={1}>{person.email}</Text> : null}
        </View>
        {totalIds > 0 ? (
          <View style={s.idCountBadge}>
            <Text style={s.idCountText}>{totalIds} ID{totalIds !== 1 ? 's' : ''}</Text>
          </View>
        ) : null}
      </View>

      {/* Companies + identifiers section */}
      {agentRows.length > 0 ? (
        <View style={s.agentsList}>
          {agentRows.map((ag, idx) => (
            <View key={String(ag.agent_id ?? idx)} style={s.agentGroup}>
              <Text style={s.agentGroupCompany} numberOfLines={1}>
                {ag.company_name || 'Independent'}
              </Text>
              <View style={s.idBadgesRow}>
                {(ag.identifiers || []).length === 0 ? (
                  <Text style={s.noIdsText}>No IDs</Text>
                ) : (ag.identifiers || []).map((ident, ii) => (
                  <View key={String(ident.id ?? ii)} style={s.idBadge}>
                    <Text style={s.idBadgeString}>{ident.id_string}</Text>
                    <Text style={s.idBadgeRev}> {ident.rev_share ?? '—'}%</Text>
                    {ident.prime49 ? <Text style={s.primeStar}> ⭐</Text> : null}
                    {Number(ident.merchant_count) > 0 ? (
                      <View style={s.mktChip}>
                        <Text style={s.mktChipText}>{ident.merchant_count}</Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={s.noIdsText}>No agents on record</Text>
      )}
    </TouchableOpacity>
  );
}

// ── Company row (Companies tab) ───────────────────────────────────────────────

function CompanyRow({ item, onPress }) {
  return (
    <TouchableOpacity style={s.personRow} onPress={() => onPress(item)} activeOpacity={0.75}>
      <View style={s.avatar}>
        <Text style={s.avatarText}>{initials(item.company_name)}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={s.agentName} numberOfLines={1}>{item.company_name || '—'}</Text>
        <Text style={s.subLine}>
          {item.agent_count ?? 0} agent{Number(item.agent_count) === 1 ? '' : 's'}
        </Text>
      </View>
      <Text style={s.chevron}>›</Text>
    </TouchableOpacity>
  );
}

// ── Identifier row (inline editor) ───────────────────────────────────────────
// id_string is IMMUTABLE — backend has no rename action.

function IdentifierRow({ ident, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [rev, setRev]         = useState(String(ident.rev_share ?? ''));
  const [prime, setPrime]     = useState(!!ident.prime49);
  const [saving, setSaving]   = useState(false);

  async function save() {
    const revNum = Number(rev);
    if (rev.trim() === '' || Number.isNaN(revNum)) {
      Alert.alert('Invalid value', 'Rev share must be a number.');
      return;
    }
    setSaving(true);
    try {
      const res = await Partners.updateIdentifier(ident.id, { rev_share: revNum, prime49: prime });
      if (res?.success) {
        setEditing(false);
        onSaved && onSaved({ ...ident, rev_share: revNum, prime49: prime });
      } else {
        Alert.alert('Error', res?.message || 'Failed to update identifier.');
      }
    } catch {
      Alert.alert('Error', 'Failed to update identifier.');
    }
    setSaving(false);
  }

  return (
    <View style={s.identRow}>
      <View style={s.identTop}>
        <View style={s.identChip}>
          <Text style={s.identChipText}>{ident.id_string}</Text>
        </View>
        {!editing ? (
          <>
            <Text style={s.identRev}>Rev {ident.rev_share ?? '—'}%</Text>
            {ident.prime49 ? <Text style={s.identPrime}>⭐ Prime49</Text> : null}
            {Number(ident.merchant_count) > 0 ? (
              <View style={s.mktChip}>
                <Text style={s.mktChipText}>{ident.merchant_count} mkt</Text>
              </View>
            ) : null}
            <TouchableOpacity style={s.smallBtn} onPress={() => {
              setRev(String(ident.rev_share ?? ''));
              setPrime(!!ident.prime49);
              setEditing(true);
            }}>
              <Text style={s.smallBtnText}>Edit</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
      {editing && (
        <View style={s.identEdit}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={s.fieldLabel}>Rev share</Text>
            <TextInput
              style={[s.input, s.inputSmall]}
              value={rev}
              onChangeText={setRev}
              keyboardType="numeric"
              placeholder="50"
              placeholderTextColor={COLORS.light}
            />
            <Text style={s.fieldLabel}>Prime49</Text>
            <TouchableOpacity
              style={[s.chip, prime && s.chipActive]}
              onPress={() => setPrime(p => !p)}
            >
              <Text style={[s.chipText, prime && s.chipTextActive]}>{prime ? 'Yes' : 'No'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.identNote}>Agent ID string is immutable and cannot be changed.</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TouchableOpacity style={[s.smallBtn, s.smallBtnPrimary]} onPress={save} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={[s.smallBtnText, { color: '#fff' }]}>Save</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.smallBtn} onPress={() => setEditing(false)} disabled={saving}>
              <Text style={s.smallBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Scorecard modal (Leaderboard → tap) ──────────────────────────────────────

function ScorecardModal({ agent, visible, onClose }) {
  const [scorecard, setScorecard] = useState(null);
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    if (visible && agent?.person_id) {
      setLoading(true);
      Partners.getScorecard(agent.person_id)
        .then(d => setScorecard(d.scorecard || null))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setScorecard(null);
    }
  }, [visible, agent]);

  if (!agent) return null;
  const totals = scorecard?.totals || {};

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle} numberOfLines={1}>{agent.name}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
            {[
              ['Rank', `#${agent.rank ?? '—'}`],
              ['Tier', agent.tier || '—'],
              ['Merchants', agent.merchant_count ?? '—'],
              ['30-Day Volume', fmt$(agent.volume_30_day)],
              ['90-Day Volume', fmt$(agent.volume_90_day)],
            ].map(([label, val]) => (
              <View key={label} style={s.metaRow}>
                <Text style={s.metaLabel}>{label}</Text>
                <Text style={s.metaValue}>{val}</Text>
              </View>
            ))}
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Growth</Text>
              <Text style={[s.metaValue, { color: agent.growth_pct >= 0 ? COLORS.success : COLORS.danger }]}>
                {agent.growth_pct != null
                  ? `${agent.growth_pct > 0 ? '+' : ''}${Number(agent.growth_pct).toFixed(1)}%`
                  : '—'}
              </Text>
            </View>

            {loading && <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} />}

            {scorecard && (
              <>
                <Text style={s.sectionTitle}>Scorecard Totals</Text>
                {Object.entries(totals).map(([k, v]) => (
                  <View key={k} style={s.metaRow}>
                    <Text style={s.metaLabel}>{k.replace(/_/g, ' ')}</Text>
                    <Text style={s.metaValue}>{typeof v === 'number' ? v.toLocaleString() : String(v)}</Text>
                  </View>
                ))}
                {scorecard.top_merchants?.length > 0 && (
                  <>
                    <Text style={s.sectionTitle}>Top Merchants</Text>
                    {scorecard.top_merchants.slice(0, 5).map((m, i) => (
                      <View key={i} style={s.metaRow}>
                        <Text style={s.metaLabel} numberOfLines={1}>{m.dba_name || m.merchant_id}</Text>
                        <Text style={s.metaValue}>{fmt$(m.volume)}</Text>
                      </View>
                    ))}
                  </>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Partner detail modal (All Partners → tap) ─────────────────────────────────
// Mirrors the web app's partner profile: Info (incl. GHL/portal/branded),
// Agents & IDs (with nested sub-IDs), Merchants per ID, Notes, Tickets.

const STATUS_COLORS = {
  open:        '#2563eb',
  in_progress: '#d97706',
  resolved:    '#16a34a',
  closed:      '#64748b',
};

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(); } catch { return String(d); }
}

function PartnerDetailModal({ person, agentRows, visible, onClose, onSaved }) {
  const [tab, setTab]       = useState('info');
  const [name, setName]     = useState('');
  const [email, setEmail]   = useState('');
  const [phone, setPhone]   = useState('');
  const [saving, setSaving] = useState(false);
  const [localAgents, setLocalAgents] = useState([]);

  // Notes
  const [notes, setNotes]           = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteBody, setNoteBody]     = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  // Tickets
  const [tickets, setTickets]             = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  // Merchants per identifier
  const [merchIdent, setMerchIdent]     = useState(null);
  const [merchants, setMerchants]       = useState([]);
  const [merchantsLoading, setMerchantsLoading] = useState(false);

  useEffect(() => {
    if (visible && person) {
      setName(person.full_name || '');
      setEmail(person.email || '');
      setPhone(person.phone_number || '');
      setTab('info');
      setNotes([]); setNoteBody('');
      setTickets([]);
      setMerchIdent(null); setMerchants([]);
    }
    setLocalAgents(agentRows || []);
  }, [visible, person, agentRows]);

  // Lazy-load notes / tickets when their tab is first opened
  useEffect(() => {
    if (!visible || !person) return;
    if (tab === 'notes' && notes.length === 0 && !notesLoading) {
      setNotesLoading(true);
      Partners.getNotes(person.id, person.hl_contact_id)
        .then(d => setNotes(d?.data || []))
        .catch(() => {})
        .finally(() => setNotesLoading(false));
    }
    if (tab === 'tickets' && tickets.length === 0 && !ticketsLoading) {
      setTicketsLoading(true);
      Tickets.listForStaff({ person_id: person.id, limit: 50 })
        .then(d => setTickets(d?.data || []))
        .catch(() => {})
        .finally(() => setTicketsLoading(false));
    }
  }, [tab, visible, person]);

  // Flatten all identifiers across agents (for Merchants tab chips)
  const allIdents = localAgents.flatMap(a =>
    (a.identifiers || []).map(i => ({ ...i, company_name: a.company_name })));

  function loadMerchants(ident) {
    setMerchIdent(ident);
    setMerchantsLoading(true);
    setMerchants([]);
    Partners.getIdentifierMerchants(ident.id)
      .then(d => setMerchants(d?.data || []))
      .catch(() => {})
      .finally(() => setMerchantsLoading(false));
  }

  async function saveInfo() {
    if (!person) return;
    if (!name.trim()) { Alert.alert('Validation', 'Name is required.'); return; }
    const changes = [];
    if (name.trim() !== (person.full_name || ''))     changes.push(['full_name', name.trim()]);
    if (email.trim() !== (person.email || ''))        changes.push(['email', email.trim()]);
    if (phone.trim() !== (person.phone_number || '')) changes.push(['phone_number', phone.trim()]);
    if (changes.length === 0) { onClose(); return; }

    setSaving(true);
    try {
      for (const [field, value] of changes) {
        const res = await Partners.updatePersonField(person.id, field, value);
        if (!res?.success) throw new Error(res?.message || `Failed to update ${field.replace(/_/g,' ')}`);
      }
      setSaving(false);
      onSaved();
    } catch (e) {
      setSaving(false);
      Alert.alert('Error', e?.message || 'Failed to save changes.');
    }
  }

  async function addNote() {
    if (!noteBody.trim()) return;
    setNoteSaving(true);
    try {
      const res = await Partners.addNote(person.id, noteBody.trim(), { hl_contact_id: person.hl_contact_id });
      if (res?.success) {
        setNoteBody('');
        const d = await Partners.getNotes(person.id, person.hl_contact_id);
        setNotes(d?.data || []);
      } else {
        Alert.alert('Error', res?.message || 'Failed to add note.');
      }
    } catch {
      Alert.alert('Error', 'Failed to add note.');
    }
    setNoteSaving(false);
  }

  async function togglePin(note) {
    const res = await Partners.updateNote(note.id, { is_pinned: !note.is_pinned, hl_contact_id: person.hl_contact_id });
    if (res?.success) {
      setNotes(prev => prev.map(n => n.id === note.id ? { ...n, is_pinned: !note.is_pinned } : n));
    }
  }

  function deleteNote(note) {
    Alert.alert('Delete Note', 'Delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const res = await Partners.deleteNote(note.id, person.hl_contact_id);
        if (res?.success) setNotes(prev => prev.filter(n => n.id !== note.id));
        else Alert.alert('Error', res?.message || 'Failed to delete note.');
      }},
    ]);
  }

  function onIdentSaved(agentId, updated) {
    setLocalAgents(prev => prev.map(a => a.agent_id !== agentId ? a : {
      ...a,
      identifiers: (a.identifiers || []).map(i => i.id === updated.id ? { ...i, ...updated } : i),
    }));
  }

  if (!person) return null;

  const sortedNotes = [...notes].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));

  const TABS = [['info', 'Info'], ['ids', 'IDs'], ['merchants', 'Merchants'], ['notes', 'Notes'], ['tickets', 'Tickets']];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle} numberOfLines={1}>{person.full_name || '—'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={[s.tabs, { marginHorizontal: 0, marginTop: 0, marginBottom: 12 }]}>
            {TABS.map(([key, label]) => (
              <TouchableOpacity key={key} style={[s.tab, tab === key && s.tabActive]} onPress={() => setTab(key)}>
                <Text style={[s.tabTextSm, tab === key && s.tabTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Info ── */}
          {tab === 'info' && (
            <ScrollView contentContainerStyle={{ paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
              {/* Status badges */}
              <View style={s.badgeRow}>
                <View style={[s.statusBadge, { backgroundColor: person.is_portal_active ? '#dcfce7' : '#f1f5f9' }]}>
                  <Text style={[s.statusBadgeText, { color: person.is_portal_active ? '#16a34a' : '#64748b' }]}>
                    {person.is_portal_active ? '● Portal Active' : '○ Portal Off'}
                  </Text>
                </View>
                {person.is_branded ? (
                  <View style={[s.statusBadge, { backgroundColor: '#dbeafe' }]}>
                    <Text style={[s.statusBadgeText, { color: '#2563eb' }]}>🔒 Branded</Text>
                  </View>
                ) : null}
              </View>

              <Text style={s.fieldLabel}>Full Name</Text>
              <TextInput style={s.input} value={name} onChangeText={setName}
                placeholder="Full name" placeholderTextColor={COLORS.light} />
              <Text style={s.fieldLabel}>Email</Text>
              <TextInput style={s.input} value={email} onChangeText={setEmail}
                placeholder="Email" placeholderTextColor={COLORS.light}
                autoCapitalize="none" keyboardType="email-address" />
              <Text style={s.fieldLabel}>Phone</Text>
              <TextInput style={s.input} value={phone} onChangeText={setPhone}
                placeholder="Phone number" placeholderTextColor={COLORS.light}
                keyboardType="phone-pad" />

              <Text style={s.sectionTitle}>Details</Text>
              {[
                ['Enrolled', fmtDate(person.enrolled_at)],
                ['GHL Contact ID', person.hl_contact_id || 'Not linked'],
                ['Last Portal Login', fmtDate(person.last_portal_login)],
                ['Portal Password Set', person.portal_password_set ? 'Yes' : 'No'],
              ].map(([label, val]) => (
                <View key={label} style={s.metaRow}>
                  <Text style={s.metaLabel}>{label}</Text>
                  <Text style={s.metaValue} numberOfLines={1}>{val}</Text>
                </View>
              ))}

              <TouchableOpacity style={s.primaryBtn} onPress={saveInfo} disabled={saving}>
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.primaryBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* ── Agents & IDs (with nested sub-IDs) ── */}
          {tab === 'ids' && (
            <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
              {localAgents.length === 0 ? (
                <Text style={s.empty}>No agent records for this person</Text>
              ) : localAgents.map((ag, idx) => {
                const idents   = ag.identifiers || [];
                const identIds = new Set(idents.map(i => i.id));
                // Top-level: no parent, or parent belongs to a different agent
                const tops = idents.filter(i => !i.parent_config_id || !identIds.has(i.parent_config_id));
                const subsByParent = {};
                idents.forEach(i => {
                  if (i.parent_config_id && identIds.has(i.parent_config_id)) {
                    (subsByParent[i.parent_config_id] ||= []).push(i);
                  }
                });
                return (
                  <View key={String(ag.agent_id ?? idx)} style={s.agentBlock}>
                    <Text style={s.agentBlockCompany} numberOfLines={1}>
                      {ag.company_name || 'Independent'}
                    </Text>
                    {idents.length === 0 ? (
                      <Text style={s.identNote}>No agent IDs assigned</Text>
                    ) : tops.map(ident => (
                      <View key={String(ident.id)}>
                        <IdentifierRow
                          ident={ident}
                          onSaved={updated => onIdentSaved(ag.agent_id, updated)}
                        />
                        {(subsByParent[ident.id] || []).map(sub => (
                          <View key={String(sub.id)} style={s.subIdentWrap}>
                            <Text style={s.subIdentLabel}>↳ sub-partner</Text>
                            <IdentifierRow
                              ident={sub}
                              onSaved={updated => onIdentSaved(ag.agent_id, updated)}
                            />
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* ── Merchants per identifier ── */}
          {tab === 'merchants' && (
            <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
              {allIdents.length === 0 ? (
                <Text style={s.empty}>No agent IDs — no merchants to show</Text>
              ) : (
                <>
                  <Text style={s.fieldLabel}>Select an agent ID</Text>
                  <View style={s.idBadgesRow}>
                    {allIdents.map(ident => (
                      <TouchableOpacity
                        key={String(ident.id)}
                        style={[s.chip, merchIdent?.id === ident.id && s.chipActive]}
                        onPress={() => loadMerchants(ident)}
                      >
                        <Text style={[s.chipText, merchIdent?.id === ident.id && s.chipTextActive]}>
                          {ident.id_string}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {merchantsLoading && <ActivityIndicator color={COLORS.primary} style={{ margin: 20 }} />}

                  {merchIdent && !merchantsLoading && (
                    merchants.length === 0
                      ? <Text style={s.empty}>No merchants under {merchIdent.id_string}</Text>
                      : merchants.map((m, i) => (
                        <View key={String(m.merchant_id ?? i)} style={s.merchRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.agentName} numberOfLines={1}>{m.dba_name || m.merchant_id}</Text>
                            <Text style={s.subLine}>
                              {[m.merchant_city, m.merchant_state].filter(Boolean).join(', ') || '—'}
                              {m.account_status ? `  ·  ${m.account_status}` : ''}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={s.statNum}>{fmt$(m.volume_30_day)}</Text>
                            <Text style={s.statLabel}>30-day</Text>
                          </View>
                        </View>
                      ))
                  )}
                </>
              )}
            </ScrollView>
          )}

          {/* ── Notes ── */}
          {tab === 'notes' && (
            <ScrollView contentContainerStyle={{ paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
                <TextInput
                  style={[s.input, { flex: 1, marginBottom: 0, minHeight: 44 }]}
                  value={noteBody}
                  onChangeText={setNoteBody}
                  placeholder="Write a note…"
                  placeholderTextColor={COLORS.light}
                  multiline
                />
                <TouchableOpacity style={[s.smallBtn, s.smallBtnPrimary, { height: 44 }]} onPress={addNote} disabled={noteSaving}>
                  {noteSaving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={[s.smallBtnText, { color: '#fff' }]}>Add</Text>}
                </TouchableOpacity>
              </View>
              {person.hl_contact_id ? (
                <Text style={s.identNote}>Notes sync with GoHighLevel contact.</Text>
              ) : null}

              {notesLoading && <ActivityIndicator color={COLORS.primary} style={{ margin: 20 }} />}
              {!notesLoading && sortedNotes.length === 0 && <Text style={s.empty}>No notes yet</Text>}
              {sortedNotes.map(n => (
                <View key={String(n.id)} style={[s.noteCard, n.is_pinned && s.noteCardPinned]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {n.is_pinned ? <Text style={{ fontSize: 11 }}>📌 </Text> : null}
                    {n.title ? <Text style={s.agentName} numberOfLines={1}>{n.title}</Text> : null}
                    <View style={{ flex: 1 }} />
                    {n.source === 'ghl' ? (
                      <View style={s.ghlBadge}><Text style={s.ghlBadgeText}>GHL</Text></View>
                    ) : null}
                  </View>
                  <Text style={s.noteBody}>{n.body}</Text>
                  <View style={s.noteFooter}>
                    <Text style={s.subLine}>
                      {n.author_name ? `${n.author_name} · ` : ''}{fmtDate(n.created_at)}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <TouchableOpacity onPress={() => togglePin(n)}>
                        <Text style={s.noteAction}>{n.is_pinned ? 'Unpin' : 'Pin'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteNote(n)}>
                        <Text style={[s.noteAction, { color: COLORS.danger }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          {/* ── Tickets ── */}
          {tab === 'tickets' && (
            <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
              {ticketsLoading && <ActivityIndicator color={COLORS.primary} style={{ margin: 20 }} />}
              {!ticketsLoading && tickets.length === 0 && <Text style={s.empty}>No tickets for this partner</Text>}
              {tickets.map(t => {
                const stColor = STATUS_COLORS[(t.status || '').toLowerCase()] || COLORS.muted;
                return (
                  <View key={String(t.id)} style={s.merchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.agentName} numberOfLines={1}>
                        #{t.ticket_number ?? t.id}  {t.subject || '—'}
                      </Text>
                      <Text style={s.subLine}>
                        {[t.type, t.category, t.priority].filter(Boolean).join(' · ')} · {fmtDate(t.created_at)}
                      </Text>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: stColor + '22' }]}>
                      <Text style={[s.statusBadgeText, { color: stColor }]}>
                        {(t.status || '—').replace(/_/g, ' ')}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Company agents modal (Companies tab → tap) ────────────────────────────────

function CompanyAgentsModal({ company, visible, onClose }) {
  const [agents, setAgents]   = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && company?.id != null) {
      setLoading(true);
      Partners.getCompanyAgents(company.id)
        .then(d => setAgents(d?.data || []))
        .catch(() => setAgents([]))
        .finally(() => setLoading(false));
    } else {
      setAgents([]);
    }
  }, [visible, company]);

  function onIdentSaved(agentId, updated) {
    setAgents(prev => prev.map(a => a.agent_id !== agentId ? a : {
      ...a,
      identifiers: (a.identifiers || []).map(i => i.id === updated.id ? { ...i, ...updated } : i),
    }));
  }

  if (!company) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle} numberOfLines={1}>{company.company_name}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          {loading
            ? <ActivityIndicator color={COLORS.primary} style={{ margin: 24 }} />
            : (
              <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
                {agents.length === 0
                  ? <Text style={s.empty}>No agents in this company</Text>
                  : agents.map(a => (
                    <View key={String(a.agent_id)} style={s.agentBlock}>
                      <Text style={s.agentName}>{a.person_name || '—'}</Text>
                      {a.person_email ? <Text style={s.subLine}>{a.person_email}</Text> : null}
                      {(a.identifiers || []).length === 0
                        ? <Text style={s.identNote}>No agent IDs</Text>
                        : (a.identifiers || []).map(ident => (
                          <IdentifierRow
                            key={String(ident.id)}
                            ident={ident}
                            onSaved={updated => onIdentSaved(a.agent_id, updated)}
                          />
                        ))}
                    </View>
                  ))}
              </ScrollView>
            )}
        </View>
      </View>
    </Modal>
  );
}

// ── Create partner modal (FAB → tap) ──────────────────────────────────────────
// 3-step wizard matching the web app's onboarding flow.

const NEW_ID_ROW = () => ({ string: '', rev: '50', prime: false });

function CreatePartnerModal({ visible, onClose, onCreated }) {
  const [step, setStep]           = useState(1); // 1: Identity, 2: Business, 3: IDs
  const [name, setName]           = useState('');
  const [email, setEmail]         = useState('');
  const [phone, setPhone]         = useState('');
  const [companyMode, setCompanyMode] = useState('independent');
  const [companies, setCompanies]     = useState([]);
  const [compLoading, setCompLoading] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [newCompanyName, setNewCompanyName]   = useState('');
  const [idRows, setIdRows] = useState([NEW_ID_ROW()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setStep(1);
      setName(''); setEmail(''); setPhone('');
      setCompanyMode('independent');
      setSelectedCompany(null); setNewCompanyName('');
      setIdRows([NEW_ID_ROW()]);
    }
  }, [visible]);

  useEffect(() => {
    if (visible && step === 2 && companyMode === 'existing' && companies.length === 0) {
      setCompLoading(true);
      Partners.getCompanies()
        .then(d => setCompanies(d?.data || []))
        .catch(() => {})
        .finally(() => setCompLoading(false));
    }
  }, [visible, step, companyMode]);

  function setRow(i, patch) {
    setIdRows(rows => rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }

  async function submit() {
    const identifiers = idRows
      .filter(r => r.string.trim())
      .map(r => ({ string: r.string.trim(), rev: Number(r.rev) || 0, prime: !!r.prime }));

    const company =
      companyMode === 'independent' ? { isIndependent: true } :
      companyMode === 'existing'    ? { id: selectedCompany.id } :
                                      { name: newCompanyName.trim() };

    setSaving(true);
    try {
      const res = await Partners.createPartner({
        person: { name: name.trim(), email: email.trim(), phone: phone.trim() },
        company,
        identifiers,
        isQuickAdd: false,
        allowNoEmail: !email.trim(),
      });
      setSaving(false);
      if (res?.success) {
        onCreated();
      } else {
        Alert.alert('Error', res?.message || 'Failed to create partner.');
      }
    } catch (e) {
      setSaving(false);
      Alert.alert('Error', e?.message || 'Failed to create partner.');
    }
  }

  const stepDots = [1, 2, 3].map(n => (
    <View key={n} style={[s.stepDot, step >= n && s.stepDotActive]} />
  ));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>
              {step === 1 ? 'Step 1: Identity' : step === 2 ? 'Step 2: Business Info' : 'Step 3: IDs & Access'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={s.stepDots}>{stepDots}</View>

          <ScrollView contentContainerStyle={{ paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
            {/* Step 1 — Identity */}
            {step === 1 && (
              <>
                <Text style={s.fieldLabel}>Full Name *</Text>
                <TextInput style={s.input} value={name} onChangeText={setName}
                  placeholder="Full name" placeholderTextColor={COLORS.light} />
                <Text style={s.fieldLabel}>Email</Text>
                <TextInput style={s.input} value={email} onChangeText={setEmail}
                  placeholder="Email (optional)" placeholderTextColor={COLORS.light}
                  autoCapitalize="none" keyboardType="email-address" />
                <Text style={s.fieldLabel}>Phone</Text>
                <TextInput style={s.input} value={phone} onChangeText={setPhone}
                  placeholder="Phone (optional)" placeholderTextColor={COLORS.light}
                  keyboardType="phone-pad" />
                <TouchableOpacity
                  style={s.primaryBtn}
                  onPress={() => {
                    if (!name.trim()) { Alert.alert('Validation', 'Name is required.'); return; }
                    setStep(2);
                  }}
                >
                  <Text style={s.primaryBtnText}>Next: Business Info →</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Step 2 — Business Info */}
            {step === 2 && (
              <>
                <Text style={s.fieldLabel}>Company / Firm</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  {[['independent', 'Independent'], ['existing', 'Existing'], ['new', 'New']].map(([mode, label]) => (
                    <TouchableOpacity
                      key={mode}
                      style={[s.chip, companyMode === mode && s.chipActive]}
                      onPress={() => setCompanyMode(mode)}
                    >
                      <Text style={[s.chipText, companyMode === mode && s.chipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {companyMode === 'existing' && (
                  <View style={s.companyPicker}>
                    {compLoading
                      ? <ActivityIndicator color={COLORS.primary} style={{ margin: 12 }} />
                      : companies.length === 0
                        ? <Text style={s.identNote}>No companies found</Text>
                        : (
                          <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
                            {companies.map(c => (
                              <TouchableOpacity
                                key={String(c.id)}
                                style={[s.companyOption, selectedCompany?.id === c.id && s.companyOptionActive]}
                                onPress={() => setSelectedCompany(c)}
                              >
                                <Text style={[s.companyOptionText, selectedCompany?.id === c.id && { color: '#fff' }]}>
                                  {c.company_name}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        )}
                  </View>
                )}

                {companyMode === 'new' && (
                  <TextInput style={[s.input, { marginTop: 4 }]} value={newCompanyName} onChangeText={setNewCompanyName}
                    placeholder="New company name" placeholderTextColor={COLORS.light} />
                )}

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                  <TouchableOpacity style={[s.primaryBtn, { flex: 1, backgroundColor: COLORS.muted }]} onPress={() => setStep(1)}>
                    <Text style={s.primaryBtnText}>← Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.primaryBtn, { flex: 2 }]}
                    onPress={() => {
                      if (companyMode === 'existing' && !selectedCompany) {
                        Alert.alert('Validation', 'Select a company or choose Independent / New.');
                        return;
                      }
                      if (companyMode === 'new' && !newCompanyName.trim()) {
                        Alert.alert('Validation', 'Enter the new company name.');
                        return;
                      }
                      setStep(3);
                    }}
                  >
                    <Text style={s.primaryBtnText}>Next: IDs →</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Step 3 — Identifiers & Access */}
            {step === 3 && (
              <>
                <Text style={s.fieldLabel}>Agent IDs</Text>
                {idRows.map((row, i) => (
                  <View key={i} style={s.idRowWrap}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TextInput
                        style={[s.input, { flex: 1, marginBottom: 0 }]}
                        value={row.string}
                        onChangeText={v => setRow(i, { string: v })}
                        placeholder="ID string"
                        placeholderTextColor={COLORS.light}
                        autoCapitalize="characters"
                      />
                      <TextInput
                        style={[s.input, s.inputSmall, { marginBottom: 0 }]}
                        value={row.rev}
                        onChangeText={v => setRow(i, { rev: v })}
                        placeholder="Rev"
                        placeholderTextColor={COLORS.light}
                        keyboardType="numeric"
                      />
                      <TouchableOpacity
                        style={[s.chip, row.prime && s.chipActive]}
                        onPress={() => setRow(i, { prime: !row.prime })}
                      >
                        <Text style={[s.chipText, row.prime && s.chipTextActive]}>
                          {row.prime ? 'P49 ✓' : 'P49'}
                        </Text>
                      </TouchableOpacity>
                      {idRows.length > 1 && (
                        <TouchableOpacity onPress={() => setIdRows(rows => rows.filter((_, idx) => idx !== i))}
                          hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
                          <Text style={s.removeRow}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
                <TouchableOpacity style={s.addRowBtn} onPress={() => setIdRows(rows => [...rows, NEW_ID_ROW()])}>
                  <Text style={s.addRowText}>+ Add another ID</Text>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                  <TouchableOpacity style={[s.primaryBtn, { flex: 1, backgroundColor: COLORS.muted }]} onPress={() => setStep(2)}>
                    <Text style={s.primaryBtnText}>← Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.primaryBtn, { flex: 2 }]} onPress={submit} disabled={saving}>
                    {saving
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={s.primaryBtnText}>Complete ✓</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function PartnersScreen() {
  const [view, setView]               = useState('ranked'); // 'ranked' | 'all' | 'companies'
  const [leaderboard, setLeaderboard] = useState([]);
  const [persons, setPersons]         = useState([]);
  const [companies, setCompanies]     = useState([]);
  // in-memory cross-reference: person_id → [{agent_id, company_name, identifiers[]}]
  const [agentsByPerson, setAgentsByPerson] = useState({});

  const [query, setQuery]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedAgent, setSelectedAgent]   = useState(null); // leaderboard scorecard
  const [detailPerson, setDetailPerson]     = useState(null); // partner detail
  const [detailAgents, setDetailAgents]     = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [showCreate, setShowCreate]         = useState(false);

  const [rankedCount, setRankedCount] = useState('—');
  const [allCount, setAllCount]       = useState('—');

  async function load(refresh = false) {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [lb, full] = await Promise.allSettled([
        Partners.getLeaderboard(),
        Partners.getList(),
      ]);

      if (lb.value?.data) {
        setLeaderboard(lb.value.data);
        setRankedCount(lb.value.total ?? lb.value.data.length);
      }

      if (full.value?.data) {
        const {
          persons: pArr = [],
          agents:  aArr = [],
          identifiers: iArr = [],
          companies: cArr = [],
        } = full.value.data;

        setPersons(pArr);
        setAllCount(pArr.length);

        // Build company name lookup
        const compById = {};
        cArr.forEach(c => { compById[c.id] = c; });

        // Build identifiers-per-agent lookup (agent_identifiers.agent_id → agents.id)
        const identByAgent = {};
        iArr.forEach(i => {
          const key = i.agent_id;
          if (key == null) return;
          if (!identByAgent[key]) identByAgent[key] = [];
          identByAgent[key].push(i);
        });

        // Build agents-per-person map.
        // agents.parent_agent_id is the FK to persons.id (despite the confusing name).
        const byPerson = {};
        aArr.forEach(a => {
          const pid = a.parent_agent_id; // FK to persons.id
          const aid = a.id;              // agents.id, referenced by agent_identifiers.agent_id
          if (pid == null) return;
          if (!byPerson[pid]) byPerson[pid] = [];
          byPerson[pid].push({
            ...a,
            agent_id: aid,
            company_name: a.company_id
              ? (compById[a.company_id]?.company_name || 'Unknown Company')
              : 'Independent',
            identifiers: identByAgent[aid] || [],
          });
        });

        setAgentsByPerson(byPerson);
        // Use companies from this same response for the Companies tab
        setCompanies(cArr.map(c => ({
          ...c,
          agent_count: aArr.filter(a => a.company_id === c.id).length,
        })));
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  // Filtered persons: search by name, email, or any agent ID string
  const filteredPersons = useMemo(() => {
    if (!query.trim()) return persons;
    const q = query.trim().toLowerCase();
    return persons.filter(p => {
      if ((p.full_name || '').toLowerCase().includes(q)) return true;
      if ((p.email || '').toLowerCase().includes(q)) return true;
      return (agentsByPerson[p.id] || []).some(a =>
        (a.identifiers || []).some(i => (i.id_string || '').toLowerCase().includes(q))
      );
    });
  }, [persons, agentsByPerson, query]);

  function openPersonDetail(person, agents) {
    setDetailPerson(person);
    setDetailAgents(agents || agentsByPerson[person.id] || []);
  }

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />
  );

  return (
    <View style={s.container}>
      {/* Stats row */}
      <View style={s.metricsRow}>
        <View style={[s.metric, { borderLeftColor: COLORS.primary }]}>
          <Text style={[s.metricNum, { color: COLORS.primary }]}>{allCount}</Text>
          <Text style={s.metricLabel}>Total Partners</Text>
        </View>
        <View style={[s.metric, { borderLeftColor: COLORS.success }]}>
          <Text style={[s.metricNum, { color: COLORS.success }]}>{rankedCount}</Text>
          <Text style={s.metricLabel}>With Activity</Text>
        </View>
        <View style={[s.metric, { borderLeftColor: COLORS.warning || '#f59e0b' }]}>
          <Text style={[s.metricNum, { color: COLORS.warning || '#f59e0b' }]}>{companies.length || '—'}</Text>
          <Text style={s.metricLabel}>Companies</Text>
        </View>
      </View>

      {/* Tab toggle */}
      <View style={s.tabs}>
        {[['ranked', 'Leaderboard'], ['all', 'All Partners'], ['companies', 'Companies']].map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[s.tab, view === key && s.tabActive]}
            onPress={() => { setView(key); setQuery(''); }}
          >
            <Text style={[s.tabText, view === key && s.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search bar — only in All Partners */}
      {view === 'all' && (
        <View style={s.searchWrap}>
          <TextInput
            style={s.searchInput}
            placeholder="Search by name, email, or agent ID…"
            placeholderTextColor={COLORS.light}
            value={query}
            onChangeText={setQuery}
          />
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />
      ) : view === 'ranked' ? (
        <FlatList
          data={leaderboard}
          keyExtractor={item => String(item.person_id || item.agent_id)}
          renderItem={({ item }) => <LeaderboardCard item={item} onPress={setSelectedAgent} />}
          contentContainerStyle={s.list}
          refreshControl={refreshControl}
          ListEmptyComponent={<Text style={s.empty}>No partners found</Text>}
        />
      ) : view === 'all' ? (
        <FlatList
          data={filteredPersons}
          keyExtractor={(item, i) => String(item.id ?? i)}
          renderItem={({ item }) => (
            <PersonCard
              person={item}
              agentRows={agentsByPerson[item.id] || []}
              onPress={openPersonDetail}
            />
          )}
          contentContainerStyle={s.list}
          refreshControl={refreshControl}
          ListEmptyComponent={<Text style={s.empty}>No partners found</Text>}
        />
      ) : (
        <FlatList
          data={companies}
          keyExtractor={(item, i) => String(item.id ?? i)}
          renderItem={({ item }) => <CompanyRow item={item} onPress={setSelectedCompany} />}
          contentContainerStyle={s.list}
          refreshControl={refreshControl}
          ListEmptyComponent={<Text style={s.empty}>No companies found</Text>}
        />
      )}

      {/* FAB — add partner */}
      <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
        <Text style={s.fabText}>＋</Text>
      </TouchableOpacity>

      <ScorecardModal
        agent={selectedAgent}
        visible={!!selectedAgent}
        onClose={() => setSelectedAgent(null)}
      />

      <PartnerDetailModal
        person={detailPerson}
        agentRows={detailAgents}
        visible={!!detailPerson}
        onClose={() => setDetailPerson(null)}
        onSaved={() => { setDetailPerson(null); load(true); }}
      />

      <CompanyAgentsModal
        company={selectedCompany}
        visible={!!selectedCompany}
        onClose={() => setSelectedCompany(null)}
      />

      <CreatePartnerModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          load(true);
          Alert.alert('Success', 'Partner created successfully.');
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.bg },
  metricsRow:   { flexDirection: 'row', padding: 14, paddingBottom: 4, gap: 8 },
  metric:       { flex: 1, backgroundColor: COLORS.card, borderRadius: 10, padding: 10, borderLeftWidth: 3 },
  metricNum:    { fontSize: 20, fontWeight: '900' },
  metricLabel:  { fontSize: 9, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase' },
  list:         { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 90 },

  // Cards
  card:         { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTop:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  rankBadge:    { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryDk, alignItems: 'center', justifyContent: 'center' },
  rankText:     { color: '#fff', fontSize: 12, fontWeight: '800' },
  avatar:       { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { color: '#fff', fontSize: 13, fontWeight: '800' },
  agentName:    { fontSize: 14, fontWeight: '700', color: COLORS.text },
  subLine:      { fontSize: 11, color: COLORS.muted, marginTop: 1 },
  tierBadge:    { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  tierText:     { fontSize: 10, fontWeight: '800' },
  cardStats:    { flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10 },
  stat:         { flex: 1, alignItems: 'center' },
  statNum:      { fontSize: 14, fontWeight: '800', color: COLORS.text },
  statLabel:    { fontSize: 10, color: COLORS.muted, fontWeight: '600', marginTop: 2 },

  // Person card — companies + IDs
  idCountBadge: { backgroundColor: COLORS.primaryDk, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  idCountText:  { color: '#fff', fontSize: 10, fontWeight: '800' },
  agentsList:   { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8, gap: 6 },
  agentGroup:   { marginBottom: 4 },
  agentGroupCompany: { fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  idBadgesRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  idBadge:      { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  idBadgeString:{ fontSize: 11, fontWeight: '800', color: COLORS.text },
  idBadgeRev:   { fontSize: 10, color: COLORS.muted, fontWeight: '600' },
  primeStar:    { fontSize: 10 },
  mktChip:      { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 4 },
  mktChipText:  { color: '#fff', fontSize: 9, fontWeight: '800' },
  noIdsText:    { fontSize: 11, color: COLORS.light, fontStyle: 'italic' },

  // Company row
  personRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, padding: 12, marginBottom: 8 },
  chevron:      { fontSize: 22, color: COLORS.light, fontWeight: '600', marginLeft: 8 },
  empty:        { textAlign: 'center', color: COLORS.muted, padding: 40 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard:    { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '88%' },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle:   { fontSize: 17, fontWeight: '800', color: COLORS.text, flex: 1, marginRight: 10 },
  modalClose:   { fontSize: 18, color: COLORS.muted, fontWeight: '700' },
  metaRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  metaLabel:    { fontSize: 13, color: COLORS.muted, fontWeight: '500' },
  metaValue:    { fontSize: 13, color: COLORS.text, fontWeight: '700', maxWidth: '55%', textAlign: 'right' },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 16, marginBottom: 4 },

  // Tabs
  tabs:         { flexDirection: 'row', marginHorizontal: 14, marginTop: 10, backgroundColor: COLORS.card, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  tab:          { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive:    { backgroundColor: COLORS.primary },
  tabText:      { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  tabTextSm:    { fontSize: 11, fontWeight: '700', color: COLORS.muted },
  tabTextActive:{ color: '#fff' },

  // Partner detail extras
  badgeRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusBadge:  { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusBadgeText: { fontSize: 11, fontWeight: '800' },
  subIdentWrap: { marginLeft: 16, borderLeftWidth: 2, borderLeftColor: COLORS.border, paddingLeft: 10 },
  subIdentLabel:{ fontSize: 10, color: COLORS.light, fontStyle: 'italic', marginTop: 6 },
  merchRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: COLORS.border, gap: 8 },
  noteCard:     { backgroundColor: COLORS.bg, borderRadius: 10, padding: 12, marginTop: 10, borderWidth: 1, borderColor: COLORS.border },
  noteCardPinned: { borderColor: COLORS.primary, backgroundColor: '#f0f9ff' },
  noteBody:     { fontSize: 13, color: COLORS.text, marginTop: 4, lineHeight: 18 },
  noteFooter:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  noteAction:   { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  ghlBadge:     { backgroundColor: '#ede9fe', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  ghlBadgeText: { fontSize: 9, fontWeight: '800', color: '#7c3aed' },

  // Search
  searchWrap:   { paddingHorizontal: 14, paddingTop: 10 },
  searchInput:  { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 11, fontSize: 14, color: COLORS.text },

  // Identifier editor
  agentBlock:   { backgroundColor: COLORS.bg, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  agentBlockHeader: { marginBottom: 6 },
  agentCompanyLabel: { flexDirection: 'row', alignItems: 'center' },
  agentBlockCompany: { fontSize: 13, fontWeight: '800', color: COLORS.text },
  identRow:     { marginTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8 },
  identTop:     { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  identChip:    { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  identChipText:{ fontSize: 12, fontWeight: '800', color: COLORS.text },
  identRev:     { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  identPrime:   { fontSize: 11, color: COLORS.muted },
  identEdit:    { marginTop: 8 },
  identNote:    { fontSize: 10, color: COLORS.light, marginTop: 6, fontStyle: 'italic' },

  // Forms
  fieldLabel:   { fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 12, marginBottom: 4 },
  input:        { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 10, fontSize: 14, color: COLORS.text, marginBottom: 4 },
  inputSmall:   { width: 64, textAlign: 'center', marginTop: 0 },
  chip:         { borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: COLORS.bg },
  chipActive:   { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:     { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  chipTextActive: { color: '#fff' },
  companyPicker:  { marginTop: 4, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, backgroundColor: COLORS.bg, padding: 4 },
  companyOption:  { padding: 10, borderRadius: 8 },
  companyOptionActive: { backgroundColor: COLORS.primary },
  companyOptionText: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  idRowWrap:    { marginBottom: 8 },
  removeRow:    { fontSize: 16, color: COLORS.danger, fontWeight: '700' },
  addRowBtn:    { alignSelf: 'flex-start', paddingVertical: 6 },
  addRowText:   { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  smallBtn:     { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center' },
  smallBtnPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  smallBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  primaryBtn:   { backgroundColor: COLORS.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 14 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // Create wizard
  stepDots:     { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12 },
  stepDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  stepDotActive:{ backgroundColor: COLORS.primary },

  // FAB
  fab:          { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  fabText:      { color: '#fff', fontSize: 26, fontWeight: '700', marginTop: -2 },
});
