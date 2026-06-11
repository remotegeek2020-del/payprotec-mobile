import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, TextInput, Alert,
} from 'react-native';
import { COLORS } from '../config';
import { Partners } from '../api';

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

function AgentCard({ item, onPress }) {
  const ts = tierStyle(item.tier);
  return (
    <TouchableOpacity style={s.card} onPress={() => onPress(item)} activeOpacity={0.75}>
      <View style={s.cardTop}>
        <View style={s.rankBadge}>
          <Text style={s.rankText}>#{item.rank ?? '—'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.agentName} numberOfLines={1}>{item.name || '—'}</Text>
          <Text style={s.companyName} numberOfLines={1}>{item.company_name || ''}</Text>
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
            {item.growth_pct != null ? `${item.growth_pct > 0 ? '+' : ''}${Number(item.growth_pct).toFixed(1)}%` : '—'}
          </Text>
          <Text style={s.statLabel}>Growth</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

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
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Rank</Text>
              <Text style={s.metaValue}>#{agent.rank ?? '—'}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Tier</Text>
              <Text style={s.metaValue}>{agent.tier || '—'}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Merchants</Text>
              <Text style={s.metaValue}>{agent.merchant_count ?? '—'}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>30-Day Volume</Text>
              <Text style={s.metaValue}>{fmt$(agent.volume_30_day)}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>90-Day Volume</Text>
              <Text style={s.metaValue}>{fmt$(agent.volume_90_day)}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Growth</Text>
              <Text style={[s.metaValue, { color: agent.growth_pct >= 0 ? COLORS.success : COLORS.danger }]}>
                {agent.growth_pct != null ? `${agent.growth_pct > 0 ? '+' : ''}${Number(agent.growth_pct).toFixed(1)}%` : '—'}
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

function PersonRow({ item, onPress }) {
  return (
    <TouchableOpacity style={s.personRow} onPress={() => onPress(item)} activeOpacity={0.75}>
      <View style={s.personAvatar}>
        <Text style={s.personAvatarText}>
          {(item.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={s.personName} numberOfLines={1}>{item.full_name || '—'}</Text>
        {item.email ? <Text style={s.personEmail} numberOfLines={1}>{item.email}</Text> : null}
      </View>
      {item.phone_number ? <Text style={s.personPhone}>{item.phone_number}</Text> : null}
    </TouchableOpacity>
  );
}

function CompanyRow({ item, onPress }) {
  return (
    <TouchableOpacity style={s.personRow} onPress={() => onPress(item)} activeOpacity={0.75}>
      <View style={s.personAvatar}>
        <Text style={s.personAvatarText}>
          {(item.company_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={s.personName} numberOfLines={1}>{item.company_name || '—'}</Text>
        <Text style={s.personEmail}>
          {item.agent_count ?? 0} agent{Number(item.agent_count) === 1 ? '' : 's'}
        </Text>
      </View>
      <Text style={s.chevron}>›</Text>
    </TouchableOpacity>
  );
}

// Inline editor for one identifier (rev_share + prime49). The agent ID
// string itself cannot be changed — the backend does not allow renaming.
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
    } catch (e) {
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
          <Text style={s.identNote}>Agent ID cannot be changed (backend does not allow renaming).</Text>
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

// Shows a company's agents with their agent IDs (id_string) + rev shares.
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
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          {loading
            ? <ActivityIndicator color={COLORS.primary} style={{ margin: 24 }} />
            : (
              <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
                {agents.length === 0 && <Text style={s.empty}>No agents in this company</Text>}
                {agents.map(a => (
                  <View key={String(a.agent_id)} style={s.agentBlock}>
                    <Text style={s.personName}>{a.person_name || '—'}</Text>
                    {a.person_email ? <Text style={s.personEmail}>{a.person_email}</Text> : null}
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

// Edit a person's full_name / email / phone_number.
function EditPartnerModal({ person, visible, onClose, onSaved }) {
  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && person) {
      setName(person.full_name || '');
      setEmail(person.email || '');
      setPhone(person.phone_number || '');
    }
  }, [visible, person]);

  async function save() {
    if (!person) return;
    if (!name.trim()) {
      Alert.alert('Validation', 'Name is required.');
      return;
    }
    const changes = [];
    if (name.trim() !== (person.full_name || ''))   changes.push(['full_name', name.trim()]);
    if (email.trim() !== (person.email || ''))      changes.push(['email', email.trim()]);
    if (phone.trim() !== (person.phone_number || '')) changes.push(['phone_number', phone.trim()]);
    if (changes.length === 0) { onClose(); return; }

    setSaving(true);
    try {
      for (const [field, value] of changes) {
        const res = await Partners.updatePersonField(person.id, field, value);
        if (!res?.success) {
          throw new Error(res?.message || `Failed to update ${field.replace(/_/g, ' ')}`);
        }
      }
      setSaving(false);
      onSaved();
    } catch (e) {
      setSaving(false);
      Alert.alert('Error', e?.message || 'Failed to save changes.');
    }
  }

  if (!person) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Edit Partner</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
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
            <TouchableOpacity style={s.primaryBtn} onPress={save} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.primaryBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const NEW_ID_ROW = () => ({ string: '', rev: '50', prime: false });

// Full create-partner flow (complete_onboarding).
function CreatePartnerModal({ visible, onClose, onCreated }) {
  const [name, setName]     = useState('');
  const [email, setEmail]   = useState('');
  const [phone, setPhone]   = useState('');
  const [companyMode, setCompanyMode] = useState('independent'); // 'independent' | 'existing' | 'new'
  const [companies, setCompanies]     = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [selectedCompany, setSelectedCompany]   = useState(null);
  const [newCompanyName, setNewCompanyName]     = useState('');
  const [idRows, setIdRows] = useState([NEW_ID_ROW()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(''); setEmail(''); setPhone('');
      setCompanyMode('independent');
      setSelectedCompany(null); setNewCompanyName('');
      setIdRows([NEW_ID_ROW()]);
    }
  }, [visible]);

  useEffect(() => {
    if (visible && companyMode === 'existing' && companies.length === 0) {
      setCompaniesLoading(true);
      Partners.getCompanies()
        .then(d => setCompanies(d?.data || []))
        .catch(() => {})
        .finally(() => setCompaniesLoading(false));
    }
  }, [visible, companyMode]);

  function setRow(i, patch) {
    setIdRows(rows => rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }

  async function submit() {
    if (!name.trim()) {
      Alert.alert('Validation', 'Name is required.');
      return;
    }
    if (companyMode === 'existing' && !selectedCompany) {
      Alert.alert('Validation', 'Select a company, or choose Independent / New.');
      return;
    }
    if (companyMode === 'new' && !newCompanyName.trim()) {
      Alert.alert('Validation', 'Enter the new company name.');
      return;
    }
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

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>New Partner</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
            <Text style={s.fieldLabel}>Name *</Text>
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

            <Text style={s.fieldLabel}>Company</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
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
                {companiesLoading
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
              <TextInput style={[s.input, { marginTop: 8 }]} value={newCompanyName} onChangeText={setNewCompanyName}
                placeholder="New company name" placeholderTextColor={COLORS.light} />
            )}

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
                      {row.prime ? 'P49: Yes' : 'P49: No'}
                    </Text>
                  </TouchableOpacity>
                  {idRows.length > 1 && (
                    <TouchableOpacity
                      onPress={() => setIdRows(rows => rows.filter((_, idx) => idx !== i))}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={s.removeRow}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
            <TouchableOpacity style={s.addRowBtn} onPress={() => setIdRows(rows => [...rows, NEW_ID_ROW()])}>
              <Text style={s.addRowText}>+ Add another ID</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.primaryBtn} onPress={submit} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.primaryBtnText}>Create Partner</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function PartnersScreen() {
  const [view, setView]           = useState('ranked'); // 'ranked' | 'all' | 'companies'
  const [agents, setAgents]       = useState([]);
  const [persons, setPersons]     = useState([]);
  const [companies, setCompanies] = useState([]);
  const [personQuery, setPersonQuery] = useState('');
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected]   = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [editPerson, setEditPerson] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [rankedCount, setRankedCount] = useState('—');
  const [allCount, setAllCount]   = useState('—');

  async function load(refresh = false) {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [lb, full, comp] = await Promise.allSettled([
        Partners.getLeaderboard(),
        Partners.getList(),
        Partners.getCompaniesFull(),
      ]);
      if (lb.value) {
        setAgents(lb.value.data || []);
        setRankedCount(lb.value.total ?? (lb.value.data || []).length);
      }
      if (full.value?.data?.persons) {
        setPersons(full.value.data.persons);
        setAllCount(full.value.data.persons.length);
      }
      if (comp.value?.data) {
        setCompanies(comp.value.data);
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  const filteredPersons = personQuery.trim()
    ? persons.filter(p =>
        (p.full_name || '').toLowerCase().includes(personQuery.trim().toLowerCase()) ||
        (p.email || '').toLowerCase().includes(personQuery.trim().toLowerCase()))
    : persons;

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />
  );

  return (
    <View style={s.container}>
      <View style={s.metricsRow}>
        <View style={[s.metric, { borderLeftColor: COLORS.primary }]}>
          <Text style={[s.metricNum, { color: COLORS.primary }]}>{allCount}</Text>
          <Text style={s.metricLabel}>Total Partners</Text>
        </View>
        <View style={[s.metric, { borderLeftColor: COLORS.success }]}>
          <Text style={[s.metricNum, { color: COLORS.success }]}>{rankedCount}</Text>
          <Text style={s.metricLabel}>With Activity</Text>
        </View>
      </View>

      {/* View toggle */}
      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, view === 'ranked' && s.tabActive]} onPress={() => setView('ranked')}>
          <Text style={[s.tabText, view === 'ranked' && s.tabTextActive]}>Leaderboard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, view === 'all' && s.tabActive]} onPress={() => setView('all')}>
          <Text style={[s.tabText, view === 'all' && s.tabTextActive]}>All Partners</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, view === 'companies' && s.tabActive]} onPress={() => setView('companies')}>
          <Text style={[s.tabText, view === 'companies' && s.tabTextActive]}>Companies</Text>
        </TouchableOpacity>
      </View>

      {view === 'all' && (
        <View style={s.searchWrap}>
          <TextInput
            style={s.searchInput}
            placeholder="Search by name or email…"
            placeholderTextColor={COLORS.light}
            value={personQuery}
            onChangeText={setPersonQuery}
          />
        </View>
      )}

      {loading
        ? <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />
        : view === 'ranked'
          ? <FlatList
              data={agents}
              keyExtractor={item => String(item.person_id || item.agent_id)}
              renderItem={({ item }) => <AgentCard item={item} onPress={setSelected} />}
              contentContainerStyle={s.list}
              refreshControl={refreshControl}
              ListEmptyComponent={<Text style={s.empty}>No partners found</Text>}
            />
          : view === 'all'
            ? <FlatList
                data={filteredPersons}
                keyExtractor={(item, i) => String(item.id || i)}
                renderItem={({ item }) => <PersonRow item={item} onPress={setEditPerson} />}
                contentContainerStyle={s.list}
                refreshControl={refreshControl}
                ListEmptyComponent={<Text style={s.empty}>No partners found</Text>}
              />
            : <FlatList
                data={companies}
                keyExtractor={(item, i) => String(item.id ?? i)}
                renderItem={({ item }) => <CompanyRow item={item} onPress={setSelectedCompany} />}
                contentContainerStyle={s.list}
                refreshControl={refreshControl}
                ListEmptyComponent={<Text style={s.empty}>No companies found</Text>}
              />
      }

      {/* Add-partner FAB */}
      <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
        <Text style={s.fabText}>＋</Text>
      </TouchableOpacity>

      <ScorecardModal
        agent={selected}
        visible={!!selected}
        onClose={() => setSelected(null)}
      />

      <CompanyAgentsModal
        company={selectedCompany}
        visible={!!selectedCompany}
        onClose={() => setSelectedCompany(null)}
      />

      <EditPartnerModal
        person={editPerson}
        visible={!!editPerson}
        onClose={() => setEditPerson(null)}
        onSaved={() => {
          setEditPerson(null);
          load(true);
        }}
      />

      <CreatePartnerModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          load(true);
          Alert.alert('Success', 'Partner created.');
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.bg },
  metricsRow:  { flexDirection: 'row', padding: 14, paddingBottom: 4 },
  metric:      { flex: 1, backgroundColor: COLORS.card, borderRadius: 10, padding: 12, borderLeftWidth: 3 },
  metricNum:   { fontSize: 22, fontWeight: '900' },
  metricLabel: { fontSize: 10, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase' },
  list:        { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 90 },
  card:        { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTop:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  rankBadge:   { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryDk, alignItems: 'center', justifyContent: 'center' },
  rankText:    { color: '#fff', fontSize: 12, fontWeight: '800' },
  agentName:   { fontSize: 14, fontWeight: '700', color: COLORS.text },
  companyName: { fontSize: 11, color: COLORS.muted, marginTop: 1 },
  tierBadge:   { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  tierText:    { fontSize: 10, fontWeight: '800' },
  cardStats:   { flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10 },
  stat:        { flex: 1, alignItems: 'center' },
  statNum:     { fontSize: 14, fontWeight: '800', color: COLORS.text },
  statLabel:   { fontSize: 10, color: COLORS.muted, fontWeight: '600', marginTop: 2 },
  empty:       { textAlign: 'center', color: COLORS.muted, padding: 40 },
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard:   { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle:  { fontSize: 17, fontWeight: '800', color: COLORS.text, flex: 1, marginRight: 10 },
  modalClose:  { fontSize: 18, color: COLORS.muted, fontWeight: '700' },
  metaRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  metaLabel:   { fontSize: 13, color: COLORS.muted, fontWeight: '500' },
  metaValue:   { fontSize: 13, color: COLORS.text, fontWeight: '700', maxWidth: '55%', textAlign: 'right' },
  sectionTitle:{ fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 16, marginBottom: 4 },
  tabs:        { flexDirection: 'row', marginHorizontal: 14, marginTop: 10, backgroundColor: COLORS.card, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  tab:         { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive:   { backgroundColor: COLORS.primary },
  tabText:     { fontSize: 13, fontWeight: '700', color: COLORS.muted },
  tabTextActive: { color: '#fff' },
  searchWrap:  { paddingHorizontal: 14, paddingTop: 10 },
  searchInput: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 11, fontSize: 14, color: COLORS.text },
  personRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, padding: 12, marginBottom: 8 },
  personAvatar:     { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  personAvatarText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  personName:  { fontSize: 14, fontWeight: '700', color: COLORS.text },
  personEmail: { fontSize: 11, color: COLORS.muted, marginTop: 1 },
  personPhone: { fontSize: 11, color: COLORS.light, marginLeft: 8 },
  chevron:     { fontSize: 22, color: COLORS.light, fontWeight: '600', marginLeft: 8 },
  // Company agents modal
  agentBlock:  { backgroundColor: COLORS.bg, borderRadius: 12, padding: 12, marginBottom: 10 },
  identRow:    { marginTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8 },
  identTop:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  identChip:   { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  identChipText: { fontSize: 12, fontWeight: '800', color: COLORS.text },
  identRev:    { flex: 1, fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  identEdit:   { marginTop: 8 },
  identNote:   { fontSize: 10, color: COLORS.light, marginTop: 6, fontStyle: 'italic' },
  // Forms
  fieldLabel:  { fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 12, marginBottom: 4 },
  input:       { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 10, fontSize: 14, color: COLORS.text, marginBottom: 4 },
  inputSmall:  { width: 64, textAlign: 'center', marginTop: 0 },
  chip:        { borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: COLORS.bg },
  chipActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:    { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  chipTextActive: { color: '#fff' },
  companyPicker: { marginTop: 8, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, backgroundColor: COLORS.bg, padding: 4 },
  companyOption: { padding: 10, borderRadius: 8 },
  companyOptionActive: { backgroundColor: COLORS.primary },
  companyOptionText: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  idRowWrap:   { marginBottom: 8 },
  removeRow:   { fontSize: 16, color: COLORS.danger, fontWeight: '700' },
  addRowBtn:   { alignSelf: 'flex-start', paddingVertical: 6 },
  addRowText:  { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  smallBtn:    { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center' },
  smallBtnPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  smallBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  primaryBtn:  { backgroundColor: COLORS.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 18 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  fab:         { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  fabText:     { color: '#fff', fontSize: 26, fontWeight: '700', marginTop: -2 },
});
