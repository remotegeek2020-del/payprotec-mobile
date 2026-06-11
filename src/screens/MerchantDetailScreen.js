import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking,
  FlatList, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { COLORS } from '../config';
import { Merchants, Tickets, Tasks as TasksApi } from '../api';
import DatePickerModal from '../components/DatePickerModal';

// ── Shared helpers ─────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  'Approved', 'Pending', 'Enrollment', 'Closed', 'Declined',
  'Collections', 'Approved - Collections', 'Closed - Collections',
  'Closed - Risk', 'Fraud', 'Withdrawn',
];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return d < new Date();
}

function fmt$(n) {
  if (n == null || n === '') return '—';
  return '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function yesNo(v) { return v ? 'Yes' : 'No'; }

// ── Details tab sub-components ─────────────────────────────────────────────────

function Row({ label, value, onPress }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <TouchableOpacity onPress={onPress} disabled={!onPress}>
        <Text style={[s.rowValue, onPress && { color: COLORS.primary, textDecorationLine: 'underline' }]}>
          {value || '—'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.sectionCard}>{children}</View>
    </View>
  );
}

function EditField({ label, value, onChange, ...props }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.input}
        value={value ?? ''}
        onChangeText={onChange}
        placeholderTextColor={COLORS.light}
        {...props}
      />
    </View>
  );
}

function BoolChip({ label, value, onToggle }) {
  return (
    <TouchableOpacity style={[s.chip, value && s.chipActive]} onPress={onToggle}>
      <Text style={[s.chipText, value && s.chipTextActive]}>{label}: {value ? 'Yes' : 'No'}</Text>
    </TouchableOpacity>
  );
}

// ── Details tab (read + edit mode) ─────────────────────────────────────────────

const EDIT_FIELDS = [
  'dba_name', 'account_status', 'email', 'merchant_phone', 'merchant_primary_contact',
  'merchant_address', 'merchant_city', 'merchant_state', 'merchant_zip', 'merchant_country',
  'merchant_websites', 'processor', 'processor_platform', 'gateway_account_id', 'source',
  'shipping_status', 'irs_tin_status', 'status_id', 'account_code', 'ach_properties',
  'fresno_buy_rate_tier', 'isv_commission_code',
  'is_edge_enabled', 'is_pci_compliant', 'is_mobile', 'is_activated',
  'is_device_hub_link_enabled', 'major_merchant',
];

function DetailsTab({ merchant: m, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({});
  const [saving, setSaving]   = useState(false);

  function startEdit() {
    const f = {};
    EDIT_FIELDS.forEach(k => { f[k] = m[k]; });
    setForm(f);
    setEditing(true);
  }

  function set(field, v) { setForm(prev => ({ ...prev, [field]: v })); }

  async function save() {
    const payload = {};
    EDIT_FIELDS.forEach(k => {
      if (form[k] !== m[k]) payload[k] = form[k];
    });
    if (Object.keys(payload).length === 0) { setEditing(false); return; }
    setSaving(true);
    try {
      const res = await Merchants.update(m.id, payload);
      setSaving(false);
      if (res?.success) {
        setEditing(false);
        onSaved(payload);
      } else {
        Alert.alert('Error', res?.message || 'Failed to save changes.');
      }
    } catch {
      setSaving(false);
      Alert.alert('Error', 'Failed to save changes.');
    }
  }

  if (editing) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={s.tabContent} contentContainerStyle={[s.tabContentInner, { padding: 16 }]} keyboardShouldPersistTaps="handled">
          <EditField label="DBA Name" value={form.dba_name} onChange={v => set('dba_name', v)} />

          <Text style={s.fieldLabel}>Account Status</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 8 }}>
            {STATUS_OPTIONS.map(st => (
              <TouchableOpacity key={st} style={[s.chip, form.account_status === st && s.chipActive]}
                onPress={() => set('account_status', st)}>
                <Text style={[s.chipText, form.account_status === st && s.chipTextActive]}>{st}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <EditField label="Email" value={form.email} onChange={v => set('email', v)} autoCapitalize="none" keyboardType="email-address" />
          <EditField label="Phone" value={form.merchant_phone} onChange={v => set('merchant_phone', v)} keyboardType="phone-pad" />
          <EditField label="Primary Contact" value={form.merchant_primary_contact} onChange={v => set('merchant_primary_contact', v)} />
          <EditField label="Address" value={form.merchant_address} onChange={v => set('merchant_address', v)} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 2 }}><EditField label="City" value={form.merchant_city} onChange={v => set('merchant_city', v)} /></View>
            <View style={{ flex: 1 }}><EditField label="State" value={form.merchant_state} onChange={v => set('merchant_state', v)} maxLength={2} autoCapitalize="characters" /></View>
            <View style={{ flex: 1 }}><EditField label="ZIP" value={form.merchant_zip} onChange={v => set('merchant_zip', v)} keyboardType="numeric" /></View>
          </View>
          <EditField label="Country" value={form.merchant_country} onChange={v => set('merchant_country', v)} />
          <EditField label="Websites" value={form.merchant_websites} onChange={v => set('merchant_websites', v)} autoCapitalize="none" />

          <EditField label="Processor" value={form.processor} onChange={v => set('processor', v)} />
          <EditField label="Platform" value={form.processor_platform} onChange={v => set('processor_platform', v)} />
          <EditField label="Gateway ID" value={form.gateway_account_id} onChange={v => set('gateway_account_id', v)} />
          <EditField label="Source" value={form.source} onChange={v => set('source', v)} />
          <EditField label="ACH Properties" value={form.ach_properties} onChange={v => set('ach_properties', v)} />
          <EditField label="Buy Rate Tier" value={form.fresno_buy_rate_tier} onChange={v => set('fresno_buy_rate_tier', v)} />
          <EditField label="Commission Code" value={form.isv_commission_code} onChange={v => set('isv_commission_code', v)} />
          <EditField label="Status ID" value={form.status_id} onChange={v => set('status_id', v)} />
          <EditField label="Account Code" value={form.account_code} onChange={v => set('account_code', v)} />
          <EditField label="Shipping Status" value={form.shipping_status} onChange={v => set('shipping_status', v)} />
          <EditField label="IRS TIN Status" value={form.irs_tin_status} onChange={v => set('irs_tin_status', v)} />

          <Text style={s.fieldLabel}>Flags</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <BoolChip label="Edge"       value={!!form.is_edge_enabled}            onToggle={() => set('is_edge_enabled', !form.is_edge_enabled)} />
            <BoolChip label="PCI"        value={!!form.is_pci_compliant}           onToggle={() => set('is_pci_compliant', !form.is_pci_compliant)} />
            <BoolChip label="Mobile"     value={!!form.is_mobile}                  onToggle={() => set('is_mobile', !form.is_mobile)} />
            <BoolChip label="Activated"  value={!!form.is_activated}               onToggle={() => set('is_activated', !form.is_activated)} />
            <BoolChip label="Device Hub" value={!!form.is_device_hub_link_enabled} onToggle={() => set('is_device_hub_link_enabled', !form.is_device_hub_link_enabled)} />
            <BoolChip label="Major"      value={!!form.major_merchant}             onToggle={() => set('major_merchant', !form.major_merchant)} />
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 18, marginBottom: 30 }}>
            <TouchableOpacity style={[s.primaryBtn, { flex: 1, backgroundColor: COLORS.muted }]} onPress={() => setEditing(false)} disabled={saving}>
              <Text style={s.primaryBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.primaryBtn, { flex: 2 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  const location = [m.merchant_address, m.merchant_city, m.merchant_state, m.merchant_zip]
    .filter(Boolean).join(', ');

  return (
    <ScrollView style={s.tabContent} contentContainerStyle={s.tabContentInner}>
      <Section title="Core Identity & Status">
        <Row label="DBA Name"       value={m.dba_name} />
        <Row label="MID"            value={m.merchant_id} />
        <Row label="Status"         value={m.account_status} />
        <Row label="Status ID"      value={m.status_id} />
        <Row label="Account Code"   value={m.account_code} />
        <Row label="Major Merchant" value={yesNo(m.major_merchant)} />
        <Row label="Prime49"        value={yesNo(m.is_prime49)} />
      </Section>

      <Section title="Partner">
        <Row label="Partner ID"   value={m.agent_id} />
        <Row label="Partner Name" value={m.agent_name} />
      </Section>

      <Section title="Contact">
        <Row label="Primary Contact" value={m.merchant_primary_contact} />
        <Row label="Phone" value={m.merchant_phone}
          onPress={m.merchant_phone ? () => Linking.openURL(`tel:${m.merchant_phone}`) : undefined} />
        <Row label="Email" value={m.email}
          onPress={m.email ? () => Linking.openURL(`mailto:${m.email}`) : undefined} />
        <Row label="Websites" value={m.merchant_websites} />
        <Row label="Address"  value={location || null} />
        <Row label="Country"  value={m.merchant_country} />
      </Section>

      <Section title="Processing & Technical">
        <Row label="Processor"   value={m.processor} />
        <Row label="Platform"    value={m.processor_platform} />
        <Row label="Gateway ID"  value={m.gateway_account_id} />
        <Row label="ACH"         value={m.ach_properties} />
        <Row label="Source"      value={m.source} />
        <Row label="Edge"        value={yesNo(m.is_edge_enabled)} />
        <Row label="PCI"         value={yesNo(m.is_pci_compliant)} />
        <Row label="Mobile"      value={yesNo(m.is_mobile)} />
        <Row label="Activated"   value={yesNo(m.is_activated)} />
        <Row label="Device Hub"  value={yesNo(m.is_device_hub_link_enabled)} />
      </Section>

      <Section title="Volume & Financials">
        <Row label="Vol MTD"        value={fmt$(m.volume_mtd)} />
        <Row label="Vol 30D"        value={fmt$(m.volume_30_day)} />
        <Row label="Vol 90D"        value={fmt$(m.volume_90_day)} />
        <Row label="Total Volume"   value={fmt$(m.volume)} />
        <Row label="Buy Rate Tier"  value={m.fresno_buy_rate_tier} />
        <Row label="Commission"     value={m.isv_commission_code} />
      </Section>

      <Section title="Dates & Compliance">
        <Row label="Enrolled"        value={formatDate(m.enrollment_date)} />
        <Row label="Approved"        value={formatDate(m.approved_date)} />
        <Row label="Last Batch"      value={formatDate(m.last_batch_date)} />
        <Row label="Status Changed"  value={formatDate(m.account_status_change_date)} />
        <Row label="Shipping"        value={m.shipping_status} />
        <Row label="IRS TIN"         value={m.irs_tin_status} />
        <Row label="NDF"             value={m.ndf} />
      </Section>

      <TouchableOpacity style={[s.primaryBtn, { marginHorizontal: 16, marginTop: 20, marginBottom: 30 }]} onPress={startEdit}>
        <Text style={s.primaryBtnText}>✏️ Edit Merchant</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Equipment tab ──────────────────────────────────────────────────────────────

function EquipmentTab({ merchantUuid }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Merchants.getEquipment(merchantUuid)
      .then(d => setData(d?.success ? d : { current: [], past: [] }))
      .catch(() => setData({ current: [], past: [] }))
      .finally(() => setLoading(false));
  }, [merchantUuid]);

  if (loading) return <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />;

  const current = data?.current || [];
  const past    = data?.past    || [];

  return (
    <ScrollView style={s.tabContent} contentContainerStyle={[s.tabContentInner, { padding: 14 }]}>
      <Text style={s.sectionTitle}>Current Equipment ({current.length})</Text>
      {current.length === 0 && <Text style={s.empty}>No equipment currently deployed</Text>}
      {current.map((e, i) => (
        <View key={String(e.id ?? i)} style={s.equipCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.equipSerial}>{e.serial_number || '—'}</Text>
            <Text style={s.equipType}>{e.terminal_type || '—'}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: '#dcfce7' }]}>
            <Text style={[s.badgeText, { color: '#16a34a' }]}>DEPLOYED</Text>
          </View>
        </View>
      ))}

      <Text style={[s.sectionTitle, { marginTop: 20 }]}>Past Equipment ({past.length})</Text>
      {past.length === 0 && <Text style={s.empty}>No equipment history</Text>}
      {past.map((e, i) => (
        <View key={i} style={s.equipCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.equipSerial}>{e.serial_number || '—'}</Text>
            <Text style={s.equipType}>
              {e.terminal_type || '—'}
              {e.deployment_display_id ? ` · ${e.deployment_display_id}` : ''}
              {e.return_display_id ? ` · RMA ${e.return_display_id}` : ''}
            </Text>
          </View>
          <View style={[s.badge, { backgroundColor: '#f1f5f9' }]}>
            <Text style={[s.badgeText, { color: '#64748b' }]}>RETURNED</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ── Notes tab ──────────────────────────────────────────────────────────────────

function NoteCard({ note }) {
  const isSystem = note.type === 'system';
  const author   = note.display_name || note.user_name || note.created_by_name || 'Unknown';
  const date     = formatDate(note.created_at);

  return (
    <View style={[s.noteCard, isSystem && s.noteCardSystem]}>
      {note.title ? <Text style={s.noteTitle}>{note.title}</Text> : null}
      <Text style={[s.noteContent, isSystem && s.noteContentSystem]}>{note.body || note.content || note.note || ''}</Text>
      <View style={s.noteMeta}>
        <Text style={s.noteAuthor}>{author}</Text>
        {date ? <Text style={s.noteDate}>{date}</Text> : null}
      </View>
    </View>
  );
}

function NotesTab({ merchantId }) {
  const [notes, setNotes]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [loaded, setLoaded]         = useState(false);
  const [showInput, setShowInput]   = useState(false);
  const [noteText, setNoteText]     = useState('');
  const [posting, setPosting]       = useState(false);

  useEffect(() => {
    if (!loaded) {
      setLoading(true);
      Merchants.getNotes(merchantId)
        .then(data => { setNotes(data.data || data.notes || []); setLoaded(true); })
        .catch(() => setLoaded(true))
        .finally(() => setLoading(false));
    }
  }, [merchantId, loaded]);

  async function submitNote() {
    const content = noteText.trim();
    if (!content || posting) return;
    setPosting(true);
    try {
      const firstLine = content.split('\n')[0];
      const title = firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine;
      const res = await Merchants.addNote(merchantId, title, content);
      if (res.success) {
        setNoteText('');
        setShowInput(false);
        const data = await Merchants.getNotes(merchantId);
        setNotes(data.data || data.notes || []);
      }
    } catch {}
    setPosting(false);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={120}>
      <View style={s.tabContent}>
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />
        ) : (
          <FlatList
            data={notes}
            keyExtractor={(item, i) => String(item.id || item.note_id || i)}
            renderItem={({ item }) => <NoteCard note={item} />}
            contentContainerStyle={s.notesList}
            ListEmptyComponent={<Text style={s.empty}>No notes yet</Text>}
            ListFooterComponent={
              showInput ? (
                <View style={s.noteInputContainer}>
                  <TextInput
                    style={s.noteInput}
                    placeholder="Write a note…"
                    placeholderTextColor={COLORS.light}
                    value={noteText}
                    onChangeText={setNoteText}
                    multiline
                    autoFocus
                  />
                  <View style={s.noteInputActions}>
                    <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowInput(false); setNoteText(''); }}>
                      <Text style={s.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.postBtn, (!noteText.trim() || posting) && s.postBtnDisabled]}
                      onPress={submitNote}
                      disabled={!noteText.trim() || posting}
                    >
                      {posting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.postBtnText}>Post</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null
            }
          />
        )}

        {!showInput ? (
          <TouchableOpacity style={s.addNoteBtn} onPress={() => setShowInput(true)}>
            <Text style={s.addNoteBtnText}>+ Add Note</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Tasks tab ──────────────────────────────────────────────────────────────────

const PRIORITY_COLORS = {
  high:   { bg: '#fee2e2', text: COLORS.danger },
  medium: { bg: '#fef3c7', text: COLORS.warning },
  low:    { bg: '#d1fae5', text: COLORS.success },
};

const TASK_STATUS_COLORS = {
  pending:   { bg: '#dbeafe', text: COLORS.primary },
  completed: { bg: '#d1fae5', text: COLORS.success },
};

function MiniTaskCard({ item, onToggle }) {
  const priority  = (item.priority || 'medium').toLowerCase();
  const status    = (item.status   || 'pending').toLowerCase();
  const priorityC = PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium;
  const statusC   = TASK_STATUS_COLORS[status] || TASK_STATUS_COLORS.pending;
  const overdue   = status !== 'completed' && isOverdue(item.due_date);

  return (
    <TouchableOpacity style={s.taskCard} onPress={onToggle} activeOpacity={0.8}>
      <View style={s.taskCardTop}>
        <Text style={[s.taskTitle, status === 'completed' && { textDecorationLine: 'line-through', color: COLORS.muted }]} numberOfLines={2}>
          {item.title || '—'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 5, flexShrink: 0, marginLeft: 8 }}>
          <View style={[s.badge, { backgroundColor: priorityC.bg }]}>
            <Text style={[s.badgeText, { color: priorityC.text }]}>{priority.toUpperCase()}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: statusC.bg }]}>
            <Text style={[s.badgeText, { color: statusC.text }]}>{status.toUpperCase()}</Text>
          </View>
        </View>
      </View>
      <View style={s.taskCardBottom}>
        {item.due_date ? (
          <Text style={[s.taskDue, overdue && s.taskDueOverdue]}>
            {overdue ? 'Overdue: ' : 'Due: '}{formatDate(item.due_date)}
          </Text>
        ) : null}
        {item.assignee_name ? <Text style={s.taskAssignee}>{item.assignee_name}</Text> : null}
      </View>
      <Text style={s.taskHint}>Tap to mark {status === 'completed' ? 'pending' : 'completed'}</Text>
    </TouchableOpacity>
  );
}

function TasksTab({ merchantUuid }) {
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded]   = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle]     = useState('');
  const [body, setBody]       = useState('');
  const [dueDate, setDueDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [staff, setStaff]     = useState([]);
  const [assignee, setAssignee] = useState(null);
  const [posting, setPosting] = useState(false);

  async function reload() {
    const data = await Merchants.getMerchantTasks(merchantUuid);
    setTasks(data.data || data.tasks || []);
  }

  useEffect(() => {
    if (!loaded) {
      setLoading(true);
      reload()
        .then(() => setLoaded(true))
        .catch(() => setLoaded(true))
        .finally(() => setLoading(false));
    }
  }, [merchantUuid, loaded]);

  useEffect(() => {
    if (showAdd && staff.length === 0) {
      TasksApi.getStaff().then(d => setStaff(d?.data || [])).catch(() => {});
    }
  }, [showAdd]);

  function toggleTask(task) {
    Merchants.updateTaskStatus(task.id).then(res => {
      if (res?.success) {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: res.status } : t));
      }
    }).catch(() => {});
  }

  async function submitTask() {
    if (!title.trim() || posting) return;
    setPosting(true);
    try {
      const opts = {};
      if (body.trim()) opts.body = body.trim();
      if (dueDate)     opts.due_date = dueDate;
      if (assignee)    opts.assigned_to = assignee.id;
      const res = await Merchants.addTask(merchantUuid, title.trim(), opts);
      if (res?.success) {
        setTitle(''); setBody(''); setDueDate(''); setAssignee(null);
        setShowAdd(false);
        await reload();
      } else {
        Alert.alert('Error', res?.message || 'Failed to add task.');
      }
    } catch {
      Alert.alert('Error', 'Failed to add task.');
    }
    setPosting(false);
  }

  if (loading) return <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={tasks}
        keyExtractor={(item, i) => String(item.id || item.task_id || i)}
        renderItem={({ item }) => <MiniTaskCard item={item} onToggle={() => toggleTask(item)} />}
        contentContainerStyle={s.tasksList}
        ListEmptyComponent={<Text style={s.empty}>No tasks for this merchant</Text>}
        ListFooterComponent={
          showAdd ? (
            <View style={s.noteInputContainer}>
              <TextInput style={s.input} placeholder="Task title *" placeholderTextColor={COLORS.light}
                value={title} onChangeText={setTitle} />
              <TextInput style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]} placeholder="Details (optional)"
                placeholderTextColor={COLORS.light} value={body} onChangeText={setBody} multiline />
              <TouchableOpacity style={s.input} onPress={() => setShowDatePicker(true)}>
                <Text style={{ color: dueDate ? COLORS.text : COLORS.light, fontSize: 14 }}>
                  {dueDate || 'Due date (optional)'}
                </Text>
              </TouchableOpacity>
              {staff.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 6 }}>
                  {staff.map(u => (
                    <TouchableOpacity key={String(u.id)} style={[s.chip, assignee?.id === u.id && s.chipActive]}
                      onPress={() => setAssignee(assignee?.id === u.id ? null : u)}>
                      <Text style={[s.chipText, assignee?.id === u.id && s.chipTextActive]}>{u.full_name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <View style={s.noteInputActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setShowAdd(false)}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.postBtn, (!title.trim() || posting) && s.postBtnDisabled]}
                  onPress={submitTask}
                  disabled={!title.trim() || posting}
                >
                  {posting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.postBtnText}>Add</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : null
        }
      />

      {!showAdd ? (
        <TouchableOpacity style={s.addNoteBtn} onPress={() => setShowAdd(true)}>
          <Text style={s.addNoteBtnText}>+ Add Task</Text>
        </TouchableOpacity>
      ) : null}

      <DatePickerModal
        visible={showDatePicker}
        value={dueDate}
        title="Due Date"
        onSelect={d => { setDueDate(d); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
      />
    </View>
  );
}

// ── Tickets tab ────────────────────────────────────────────────────────────────

const TICKET_STATUS_COLORS = {
  open:        '#2563eb',
  in_progress: '#d97706',
  resolved:    '#16a34a',
  closed:      '#64748b',
};

function TicketsTab({ merchantUuid }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Tickets.listForStaff({ merchant_id: merchantUuid, limit: 50 })
      .then(d => setTickets(d?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [merchantUuid]);

  if (loading) return <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />;

  return (
    <FlatList
      data={tickets}
      keyExtractor={(item, i) => String(item.id ?? i)}
      contentContainerStyle={s.tasksList}
      ListEmptyComponent={<Text style={s.empty}>No tickets for this merchant</Text>}
      renderItem={({ item: t }) => {
        const stColor = TICKET_STATUS_COLORS[(t.status || '').toLowerCase()] || COLORS.muted;
        return (
          <View style={s.taskCard}>
            <View style={s.taskCardTop}>
              <Text style={s.taskTitle} numberOfLines={2}>
                #{t.ticket_number ?? t.id}  {t.subject || '—'}
              </Text>
              <View style={[s.badge, { backgroundColor: stColor + '22' }]}>
                <Text style={[s.badgeText, { color: stColor }]}>
                  {(t.status || '—').replace(/_/g, ' ').toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={s.taskAssignee}>
              {[t.type, t.category, t.priority].filter(Boolean).join(' · ')} · {formatDate(t.created_at)}
            </Text>
          </View>
        );
      }}
    />
  );
}

// ── MerchantDetailScreen ───────────────────────────────────────────────────────

const TABS = ['Details', 'Equipment', 'Notes', 'Tasks', 'Tickets'];

export default function MerchantDetailScreen({ route }) {
  const initial      = route.params?.merchant || {};
  // The merchants API expects merchant_uuid = the row UUID, not the MID.
  const merchantUuid = initial.id;
  const [merchant, setMerchant]   = useState(initial);
  const [activeTab, setActiveTab] = useState('Details');

  // Fetch the FULL merchant record (list rows only carry a subset of fields)
  useEffect(() => {
    if (merchantUuid) {
      Merchants.get(merchantUuid)
        .then(d => { if (d?.success && d.data) setMerchant({ ...initial, ...d.data }); })
        .catch(() => {});
    }
  }, [merchantUuid]);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{(merchant.dba_name || '?')[0].toUpperCase()}</Text>
        </View>
        <Text style={s.name}>{merchant.dba_name || '—'}</Text>
        <Text style={s.mid}>{merchant.merchant_id || ''}</Text>
        {merchant.account_status ? (
          <View style={s.headerBadge}>
            <Text style={s.headerBadgeText}>{merchant.account_status}</Text>
          </View>
        ) : null}
      </View>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={{ flexGrow: 1 }}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[s.tabBtn, activeTab === tab && s.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[s.tabBtnText, activeTab === tab && s.tabBtnTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'Details'   && (
          <DetailsTab
            merchant={merchant}
            onSaved={patch => setMerchant(prev => ({ ...prev, ...patch }))}
          />
        )}
        {activeTab === 'Equipment' && <EquipmentTab merchantUuid={merchantUuid} />}
        {activeTab === 'Notes'     && <NotesTab merchantId={merchantUuid} />}
        {activeTab === 'Tasks'     && <TasksTab merchantUuid={merchantUuid} />}
        {activeTab === 'Tickets'   && <TicketsTab merchantUuid={merchantUuid} />}
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.bg },

  // Header
  header:       { backgroundColor: COLORS.primaryDk, padding: 24, alignItems: 'center', paddingTop: 28 },
  avatar:       { width: 56, height: 56, borderRadius: 14, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText:   { color: COLORS.primaryDk, fontSize: 24, fontWeight: '900' },
  name:         { color: '#fff', fontSize: 19, fontWeight: '800', textAlign: 'center' },
  mid:          { color: 'rgba(255,255,255,.5)', fontSize: 12, fontFamily: 'monospace', marginTop: 4 },
  headerBadge:  { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, marginTop: 8 },
  headerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  // Tab bar
  tabBar:       { backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexGrow: 0 },
  tabBtn:       { flex: 1, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: COLORS.primary },
  tabBtnText:   { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  tabBtnTextActive: { color: COLORS.primary },

  // Details tab
  tabContent:      { flex: 1 },
  tabContentInner: { paddingBottom: 40 },
  section:      { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  sectionCard:  { backgroundColor: COLORS.card, borderRadius: 12, overflow: 'hidden' },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowLabel:     { fontSize: 13, color: COLORS.muted, fontWeight: '500' },
  rowValue:     { fontSize: 13, color: COLORS.text, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },

  // Edit form
  fieldLabel:   { fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, marginTop: 8 },
  input:        { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 11, fontSize: 14, color: COLORS.text, backgroundColor: '#fff', marginBottom: 4 },
  chip:         { borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: COLORS.card },
  chipActive:   { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:     { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  chipTextActive: { color: '#fff' },
  primaryBtn:   { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // Equipment tab
  equipCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 8, gap: 8 },
  equipSerial:  { fontSize: 14, fontWeight: '800', color: COLORS.text, fontFamily: 'monospace' },
  equipType:    { fontSize: 12, color: COLORS.muted, marginTop: 2 },

  // Notes tab
  notesList:    { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 20 },
  noteCard:     { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  noteCardSystem: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: COLORS.border },
  noteTitle:    { fontSize: 13, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  noteContent:  { fontSize: 14, color: COLORS.text, lineHeight: 20, marginBottom: 8 },
  noteContentSystem: { color: COLORS.muted, fontSize: 13 },
  noteMeta:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  noteAuthor:   { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  noteDate:     { fontSize: 11, color: COLORS.light },

  noteInputContainer: { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginHorizontal: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  noteInput:    { fontSize: 14, color: COLORS.text, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10 },
  noteInputActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  cancelBtn:    { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.muted },
  postBtn:      { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, backgroundColor: COLORS.primary, minWidth: 64, alignItems: 'center' },
  postBtnDisabled: { backgroundColor: COLORS.light },
  postBtnText:  { fontSize: 13, fontWeight: '800', color: '#fff' },

  addNoteBtn:   { margin: 14, marginTop: 4, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  addNoteBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // Tasks tab
  tasksList:    { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 30 },
  taskCard:     { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  taskCardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  taskTitle:    { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.text },
  badge:        { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:    { fontSize: 9, fontWeight: '800' },
  taskCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taskDue:      { fontSize: 11, color: COLORS.muted },
  taskDueOverdue: { color: COLORS.danger, fontWeight: '700' },
  taskAssignee: { fontSize: 11, color: COLORS.light },
  taskHint:     { fontSize: 9, color: COLORS.light, marginTop: 6, fontStyle: 'italic' },

  empty:        { textAlign: 'center', color: COLORS.muted, padding: 40, fontSize: 14 },
});
