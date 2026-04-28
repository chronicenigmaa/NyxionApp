import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, Modal, ScrollView, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import LoadingScreen from '../../components/LoadingScreen';
import ErrorScreen from '../../components/ErrorScreen';
import ScreenWrapper from '../../components/ScreenWrapper';
import SelectField from '../../components/SelectField';
import { learn } from '../../services/api';

const BASE = 'https://nyxion-learnspace-production.up.railway.app/api/v1';

const CLASS_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map(v => ({ label: `Class ${v}`, value: v }));
const SECTION_OPTIONS = ['A', 'B', 'C', 'D', 'E'].map(v => ({ label: `Section ${v}`, value: v }));
const SUBJECT_OPTIONS = ['Math', 'Science', 'English', 'Urdu', 'History', 'Computer', 'Physics', 'Chemistry', 'Biology', 'Islamiat'].map(v => ({ label: v, value: v }));
const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({ label: String(i + 1), value: String(i + 1).padStart(2, '0') }));
const MONTH_OPTIONS = [
  { label: 'January', value: '01' }, { label: 'February', value: '02' }, { label: 'March', value: '03' },
  { label: 'April', value: '04' }, { label: 'May', value: '05' }, { label: 'June', value: '06' },
  { label: 'July', value: '07' }, { label: 'August', value: '08' }, { label: 'September', value: '09' },
  { label: 'October', value: '10' }, { label: 'November', value: '11' }, { label: 'December', value: '12' },
];
const YEAR_OPTIONS = ['2025', '2026', '2027', '2028'].map(v => ({ label: v, value: v }));
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({ label: String(i).padStart(2, '0') + ':00', value: String(i).padStart(2, '0') }));
const MINUTE_OPTIONS = ['00', '15', '30', '45'].map(v => ({ label: v, value: v }));
const DURATION_OPTIONS = [30, 45, 60, 90, 120, 150, 180].map(v => ({ label: `${v} minutes`, value: String(v) }));

const EMPTY_EXAM = { title: '', subject: '', class_name: '', section: '', duration_minutes: '', total_marks: '', scheduled_at: '' };

export default function ExamsScreen({ navigation, route }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [me, setMe] = useState(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newExam, setNewExam] = useState(EMPTY_EXAM);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [datePickerValue, setDatePickerValue] = useState({ day: '01', month: '01', year: '2026', hour: '09', minute: '00' });
  const teacherMode = route?.params?.teacherMode;
  const canCreate = isTeacher || teacherMode;

  useEffect(() => { load(); }, []);

  const load = async () => {
    setError(null);
    try {
      const token = await AsyncStorage.getItem('learn_token');
      const meRes = await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      const meData = await meRes.json();
      if (!meRes.ok) throw new Error(meData.detail || 'Failed to load profile');
      setMe(meData);
      const teacherUser = meData.role?.toLowerCase() === 'teacher' || teacherMode;
      setIsTeacher(teacherUser);
      if (teacherUser) {
        setNewExam(prev => ({
          ...prev,
          class_name: meData.class_name || prev.class_name,
          section: meData.section || prev.section,
        }));
      }

      const res = await fetch(`${BASE}/exams/`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed');
      setExams(Array.isArray(data) ? data : []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const openDatePicker = () => {
    if (newExam.scheduled_at && /\d{4}-\d{2}-\d{2}T/.test(newExam.scheduled_at)) {
      const [datePart, timePart] = newExam.scheduled_at.split('T');
      const [year, month, day] = datePart.split('-');
      const [hour, minute] = (timePart || '09:00').split(':');
      setDatePickerValue({ day, month, year, hour, minute: minute?.slice(0, 2) || '00' });
    } else {
      const now = new Date();
      setDatePickerValue({
        day: String(now.getDate()).padStart(2, '0'),
        month: String(now.getMonth() + 1).padStart(2, '0'),
        year: String(now.getFullYear()),
        hour: '09',
        minute: '00',
      });
    }
    setDatePickerOpen(true);
  };

  const confirmDatePicker = () => {
    const dt = `${datePickerValue.year}-${datePickerValue.month}-${datePickerValue.day}T${datePickerValue.hour}:${datePickerValue.minute}:00`;
    setNewExam(prev => ({ ...prev, scheduled_at: dt }));
    setDatePickerOpen(false);
  };

  const createExam = async () => {
    if (!newExam.title) return Alert.alert('Required', 'Exam title is required');
    if (!newExam.class_name) return Alert.alert('Required', 'Class is required');
    setSaving(true);
    try {
      await learn.post('/exams', {
        title: newExam.title,
        subject: newExam.subject || undefined,
        class_name: newExam.class_name,
        section: newExam.section || undefined,
        duration_minutes: newExam.duration_minutes ? Number(newExam.duration_minutes) : undefined,
        total_marks: newExam.total_marks ? Number(newExam.total_marks) : undefined,
        scheduled_at: newExam.scheduled_at || undefined,
      });
      Alert.alert('Created', 'Exam created successfully');
      setShowCreate(false);
      setNewExam(EMPTY_EXAM);
      load();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen message="Loading exams..." />;
  if (error) return <ErrorScreen message={error} onRetry={load} />;

  const statusColor = s => s === 'live' ? colors.success : s === 'ended' ? colors.error : colors.accent;
  const statusLabel = s => s === 'live' ? 'LIVE' : s === 'ended' ? 'ENDED' : 'SCHEDULED';

  const formatScheduled = (dt) => {
    if (!dt) return null;
    const [datePart, timePart] = dt.split('T');
    return `${datePart}  ${timePart?.slice(0, 5) || ''}`.trim();
  };

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isTeacher ? 'Manage Exams' : 'Exams'}</Text>
        {canCreate ? (
          <TouchableOpacity style={styles.headerAction} onPress={() => setShowCreate(true)}>
            <Text style={styles.headerActionText}>+ Create</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.countBadge}><Text style={styles.countText}>{exams.length}</Text></View>
        )}
      </View>

      <FlatList
        data={exams}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.error} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.8}>
            <View style={styles.cardTop}>
              <Text style={styles.name}>{item.title}</Text>
              <View style={[styles.badge, { backgroundColor: statusColor(item.status) + '22' }]}>
                <Text style={{ color: statusColor(item.status), fontSize: 11, fontWeight: '700' }}>
                  {statusLabel(item.status)}
                </Text>
              </View>
            </View>
            {item.subject ? <Text style={styles.subject}>{item.subject}</Text> : null}
            {item.class_name ? (
              <Text style={styles.classTxt}>Class {item.class_name}{item.section ? `-${item.section}` : ''}</Text>
            ) : null}
            <View style={styles.metaRow}>
              {item.duration_minutes ? <Text style={styles.meta}>⏱ {item.duration_minutes} min</Text> : null}
              {item.total_marks ? <Text style={styles.meta}>📊 {item.total_marks} marks</Text> : null}
              <Text style={styles.meta}>❓ {item.questions?.length || 0} questions</Text>
            </View>
            {item.scheduled_at ? (
              <Text style={styles.scheduled}>📅 {formatScheduled(item.scheduled_at)}</Text>
            ) : null}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyText}>No exams found{'\n'}{isTeacher ? 'Create your first exam using the + Create button' : 'Exams created by your teacher will appear here'}</Text>
          </View>
        }
      />

      {/* Create Exam Modal */}
      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Exam</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.formLabel}>Title *</Text>
              <TextInput
                style={styles.formInput}
                value={newExam.title}
                onChangeText={v => setNewExam(prev => ({ ...prev, title: v }))}
                placeholder="e.g. Mid-Term Mathematics"
                placeholderTextColor={colors.textMuted}
              />

              <SelectField
                label="Subject"
                value={newExam.subject}
                onChange={v => setNewExam(prev => ({ ...prev, subject: v }))}
                options={SUBJECT_OPTIONS}
                placeholder="Select subject"
              />

              {me?.class_name ? (
                <>
                  <Text style={styles.formLabel}>Class</Text>
                  <View style={[styles.formInput, { justifyContent: 'center', minHeight: 48 }]}>
                    <Text style={styles.readOnlyText}>Class {me.class_name}</Text>
                  </View>
                </>
              ) : (
                <SelectField
                  label="Class *"
                  value={newExam.class_name}
                  onChange={v => setNewExam(prev => ({ ...prev, class_name: v }))}
                  options={CLASS_OPTIONS}
                  placeholder="Select class"
                />
              )}

              {me?.section ? (
                <>
                  <Text style={styles.formLabel}>Section</Text>
                  <View style={[styles.formInput, { justifyContent: 'center', minHeight: 48 }]}>
                    <Text style={styles.readOnlyText}>Section {me.section}</Text>
                  </View>
                </>
              ) : (
                <SelectField
                  label="Section"
                  value={newExam.section}
                  onChange={v => setNewExam(prev => ({ ...prev, section: v }))}
                  options={SECTION_OPTIONS}
                  placeholder="Select section (optional)"
                />
              )}

              <SelectField
                label="Duration"
                value={newExam.duration_minutes}
                onChange={v => setNewExam(prev => ({ ...prev, duration_minutes: v }))}
                options={DURATION_OPTIONS}
                placeholder="Select duration"
              />

              <Text style={styles.formLabel}>Total Marks</Text>
              <TextInput
                style={styles.formInput}
                value={newExam.total_marks}
                onChangeText={v => setNewExam(prev => ({ ...prev, total_marks: v }))}
                placeholder="e.g. 100"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />

              <Text style={styles.formLabel}>Scheduled Date & Time</Text>
              <TouchableOpacity onPress={openDatePicker} style={[styles.formInput, { justifyContent: 'center', minHeight: 48 }]}>
                <Text style={newExam.scheduled_at ? styles.readOnlyText : styles.placeholderText}>
                  {newExam.scheduled_at ? formatScheduled(newExam.scheduled_at) : 'Pick date and time'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveBtn} onPress={createExam} disabled={saving}>
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.saveBtnText}>Create Exam</Text>}
              </TouchableOpacity>
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Date & Time Picker Modal */}
      <Modal visible={datePickerOpen} animationType="slide" transparent onRequestClose={() => setDatePickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Date & Time</Text>
              <TouchableOpacity onPress={() => setDatePickerOpen(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <SelectField label="Day" value={datePickerValue.day} onChange={v => setDatePickerValue(p => ({ ...p, day: v }))} options={DAY_OPTIONS} placeholder="Day" />
              <SelectField label="Month" value={datePickerValue.month} onChange={v => setDatePickerValue(p => ({ ...p, month: v }))} options={MONTH_OPTIONS} placeholder="Month" />
              <SelectField label="Year" value={datePickerValue.year} onChange={v => setDatePickerValue(p => ({ ...p, year: v }))} options={YEAR_OPTIONS} placeholder="Year" />
              <SelectField label="Hour" value={datePickerValue.hour} onChange={v => setDatePickerValue(p => ({ ...p, hour: v }))} options={HOUR_OPTIONS} placeholder="Hour" />
              <SelectField label="Minute" value={datePickerValue.minute} onChange={v => setDatePickerValue(p => ({ ...p, minute: v }))} options={MINUTE_OPTIONS} placeholder="Minute" />
              <TouchableOpacity style={styles.saveBtn} onPress={confirmDatePicker}>
                <Text style={styles.saveBtnText}>Confirm</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selected?.title}</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {[
                ['Subject', selected?.subject],
                ['Class', selected?.class_name ? `Class ${selected.class_name}${selected?.section ? `-${selected.section}` : ''}` : null],
                ['Duration', selected?.duration_minutes ? `${selected.duration_minutes} minutes` : null],
                ['Total Marks', selected?.total_marks],
                ['Questions', selected?.questions?.length],
                ['Scheduled', selected?.scheduled_at ? formatScheduled(selected.scheduled_at) : null],
                ['Status', selected?.status?.toUpperCase()],
              ].filter(([, v]) => v != null && v !== '').map(([label, value]) => (
                <View key={label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue}>{String(value)}</Text>
                </View>
              ))}
              {(selected?.restrict_tab_switch || selected?.restrict_copy_paste || selected?.fullscreen_required || selected?.shuffle_questions) ? (
                <View style={styles.rulesBox}>
                  <Text style={styles.rulesTitle}>Exam Rules</Text>
                  {selected?.restrict_tab_switch && <Text style={styles.rule}>• Tab switching is monitored</Text>}
                  {selected?.restrict_copy_paste && <Text style={styles.rule}>• Copy/paste is disabled</Text>}
                  {selected?.fullscreen_required && <Text style={styles.rule}>• Fullscreen required</Text>}
                  {selected?.shuffle_questions && <Text style={styles.rule}>• Questions are shuffled</Text>}
                  {selected?.max_tab_warnings > 0 && <Text style={styles.rule}>• Max {selected.max_tab_warnings} tab switch warnings</Text>}
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { color: colors.accent, fontSize: 16, marginRight: spacing.md },
  title: { flex: 1, color: colors.text, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  headerAction: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.accent, borderRadius: 20 },
  headerActionText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  countBadge: { backgroundColor: colors.error + '33', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  countText: { color: colors.error, fontSize: 13, fontWeight: '600' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, paddingTop: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  subject: { color: colors.accent, fontSize: 12, fontWeight: '600', marginBottom: 2 },
  classTxt: { color: colors.textMuted, fontSize: 12, marginBottom: 6 },
  metaRow: { flexDirection: 'row', gap: 12, marginBottom: 4, flexWrap: 'wrap' },
  meta: { color: colors.textMuted, fontSize: 12 },
  scheduled: { color: colors.primary, fontSize: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 24 },
  formLabel: { color: colors.textMuted, fontSize: 13, marginBottom: 6, marginTop: spacing.md },
  formInput: { backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text, fontSize: 14 },
  readOnlyText: { color: colors.text, fontSize: 14 },
  placeholderText: { color: colors.textMuted, fontSize: 14 },
  saveBtn: { backgroundColor: colors.accent, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: spacing.lg },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: 'bold', flex: 1 },
  modalClose: { color: colors.textMuted, fontSize: 20, paddingLeft: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { color: colors.textMuted, fontSize: 14 },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  rulesBox: { backgroundColor: colors.error + '11', borderRadius: 12, padding: spacing.md, marginTop: spacing.md },
  rulesTitle: { color: colors.error, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  rule: { color: colors.textMuted, fontSize: 13, marginBottom: 4 },
});
