import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, Modal, ScrollView, TextInput,
  Alert, ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import LoadingScreen from '../../components/LoadingScreen';
import ErrorScreen from '../../components/ErrorScreen';
import ScreenWrapper from '../../components/ScreenWrapper';
import SelectField from '../../components/SelectField';

const BASE = 'https://nyxion-learnspace-production.up.railway.app/api/v1';
const CLASS_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map((item) => ({ label: `Class ${item}`, value: item }));
const SECTION_OPTIONS = ['A', 'B', 'C', 'D', 'E'].map((item) => ({ label: `Section ${item}`, value: item }));
const SUBJECT_OPTIONS = ['Math', 'Science', 'English', 'Urdu', 'History', 'Computer'].map((item) => ({ label: item, value: item }));
const EMPTY_ASSIGNMENT = { title: '', subject: '', class_name: '', section: '', due_date: '', max_marks: '', description: '' };

async function getToken() { return AsyncStorage.getItem('learn_token'); }

const appendPickedFiles = (data, files, fieldName = 'files') => {
  files.forEach((file, index) => {
    data.append(fieldName, {
      uri: file.uri,
      type: file.mimeType || 'application/octet-stream',
      name: file.name || `${fieldName}-${index + 1}`,
    });
  });
};

const buildSubmissionPayload = (assignmentId, content, files) => {
  const payload = new FormData();
  payload.append('assignment_id', String(assignmentId));
  payload.append('content', content);
  appendPickedFiles(payload, files, 'files');
  return payload;
};

const buildAssignmentPayload = (assignment, files) => {
  if (!files.length) {
    return {
      body: JSON.stringify({
        title: assignment.title,
        subject: assignment.subject,
        class_name: assignment.class_name,
        section: assignment.section,
        due_date: assignment.due_date,
        max_marks: Number(assignment.max_marks || 0),
        description: assignment.description,
      }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  const payload = new FormData();
  payload.append('title', assignment.title);
  payload.append('subject', assignment.subject);
  payload.append('class_name', assignment.class_name);
  if (assignment.section) payload.append('section', assignment.section);
  payload.append('due_date', assignment.due_date);
  payload.append('max_marks', String(Number(assignment.max_marks || 0)));
  payload.append('description', assignment.description);
  appendPickedFiles(payload, files, 'files');
  return { body: payload, headers: {} };
};

export default function AssignmentsScreen({ navigation, route }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [submitText, setSubmitText] = useState('');
  const [submitFiles, setSubmitFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [userClass, setUserClass] = useState(null);
  const [noClass, setNoClass] = useState(false);
  const [me, setMe] = useState(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newAssignment, setNewAssignment] = useState(EMPTY_ASSIGNMENT);
  const [assignmentFiles, setAssignmentFiles] = useState([]);
  const teacherMode = route?.params?.teacherMode;
  const canCreate = isTeacher || teacherMode;

  useEffect(() => { load(); }, []);

  const pickFiles = async (setter, multiple = true) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple, copyToCacheDirectory: true });
      if (result.canceled) return;
      setter(result.assets || []);
    } catch (e) {
      Alert.alert('File Picker Failed', e.message);
    }
  };

  const removeFile = (setter, fileName) => setter((prev) => prev.filter((file) => file.name !== fileName));

  const load = async () => {
    setError(null);
    setNoClass(false);
    try {
      const token = await getToken();
      const meRes = await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      const meData = await meRes.json();
      if (!meRes.ok) throw new Error(meData.detail || 'Failed to load profile');
      setMe(meData);
      const isTeacherUser = meData.role?.toLowerCase() === 'teacher' || teacherMode;
      setIsTeacher(isTeacherUser);
      const assignedSection = meData.assigned_sections?.length ? meData.assigned_sections.join(', ') : null;
      setUserClass(meData.class_name || assignedSection);

      if (!meData.class_name && !assignedSection && !isTeacherUser) {
        setNoClass(true);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const res = await fetch(`${BASE}/assignments/`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to load assignments');
      setItems(Array.isArray(data) ? data : data.items || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const submit = async () => {
    if (!submitText.trim() && !submitFiles.length) return Alert.alert('Required', 'Add a submission message or attach a file');
    setSubmitting(true);
    try {
      const token = await getToken();
      let lastError = 'Submission failed';
      let success = false;
      for (const endpoint of ['/submissions/submit', '/submissions/', '/assignments/submit']) {
        const payload = buildSubmissionPayload(selected.id, submitText, submitFiles);
        const res = await fetch(`${BASE}${endpoint}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: payload,
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          success = true;
          break;
        }
        lastError = data.detail || data.message || `HTTP ${res.status}`;
      }

      if (!success) throw new Error(lastError);

      Alert.alert('Submitted', 'Your assignment has been submitted.');
      setSelected(null);
      setSubmitText('');
      setSubmitFiles([]);
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSubmitting(false); }
  };

  const createAssignment = async () => {
    if (!newAssignment.title || !newAssignment.class_name) return Alert.alert('Required', 'Title and class are required');
    setSubmitting(true);
    try {
      const token = await getToken();
      const payload = buildAssignmentPayload(newAssignment, assignmentFiles);

      const res = await fetch(`${BASE}/assignments/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, ...payload.headers },
        body: payload.body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.message || 'Failed to create assignment');
      Alert.alert('Created', 'Assignment created successfully');
      setShowCreate(false);
      setNewAssignment(EMPTY_ASSIGNMENT);
      setAssignmentFiles([]);
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSubmitting(false); }
  };

  const statusColor = (status) => status === 'submitted' ? colors.success : status === 'graded' ? colors.accent : colors.primary;

  const teacherHeaderAction = useMemo(() => canCreate ? (
    <TouchableOpacity style={styles.headerAction} onPress={() => setShowCreate(true)}>
      <Text style={styles.headerActionText}>+ Create</Text>
    </TouchableOpacity>
  ) : (
    <View style={styles.countBadge}><Text style={styles.countText}>{items.length}</Text></View>
  ), [canCreate, items.length]);

  if (loading) return <LoadingScreen message="Loading assignments..." />;
  if (error) return <ErrorScreen message={error} onRetry={load} />;

  if (noClass) {
    return (
      <ScreenWrapper>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>← Back</Text></TouchableOpacity>
          <Text style={styles.headerTitle}>Assignments</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.noClassBox}>
          <Text style={styles.noClassEmoji}>⚠️</Text>
          <Text style={styles.noClassTitle}>Class Not Set</Text>
          <Text style={styles.noClassText}>
            Your class hasn't been assigned yet.{'\n\n'}
            Ask your teacher to add you to your class in EduOS,{'\n'}
            or contact your school admin.{'\n\n'}
            Your email needs to match your EduOS student record.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setNoClass(false); setLoading(true); load(); }}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>{isTeacher ? 'Teacher Assignments' : 'Assignments'}</Text>
        {teacherHeaderAction}
      </View>

      {userClass ? <View style={styles.classBanner}><Text style={styles.classBannerText}>Class: {userClass}</Text></View> : null}
      {canCreate ? (
        <View style={styles.teacherBanner}>
          <Text style={styles.teacherBannerTitle}>Create and distribute work from here</Text>
          <Text style={styles.teacherBannerText}>You can now attach files for students and target by class plus section.</Text>
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.8}>
            <View style={styles.cardTop}>
              <Text style={styles.name}>{item.title}</Text>
              <View style={[styles.badge, { backgroundColor: statusColor(item.status) + '22' }]}>
                <Text style={{ color: statusColor(item.status), fontSize: 11, fontWeight: '700' }}>{item.status?.toUpperCase?.() || 'OPEN'}</Text>
              </View>
            </View>
            {item.subject ? <Text style={styles.subject}>{item.subject}</Text> : null}
            {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}
            <View style={styles.cardFooter}>
              <Text style={styles.due}>Due: {item.due_date?.split?.('T')?.[0] || item.due_date || 'N/A'}</Text>
              <Text style={styles.marks}>Max: {item.max_marks || 'N/A'}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyEmoji}>📝</Text><Text style={styles.emptyText}>No assignments yet{'\n'}Your teacher hasn't posted any</Text></View>}
      />

      {canCreate ? (
        <TouchableOpacity style={styles.fab} onPress={() => setShowCreate(true)}>
          <Text style={styles.fabText}>+ Create Assignment</Text>
        </TouchableOpacity>
      ) : null}

      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Assignment</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.formLabel}>Title *</Text>
              <TextInput style={styles.formInput} value={newAssignment.title} onChangeText={(value) => setNewAssignment((prev) => ({ ...prev, title: value }))} placeholder="Assignment title" placeholderTextColor={colors.textMuted} />
              <SelectField label="Subject" value={newAssignment.subject} onChange={(value) => setNewAssignment((prev) => ({ ...prev, subject: value }))} options={SUBJECT_OPTIONS} placeholder="Select subject" />
              <SelectField label="Class *" value={newAssignment.class_name} onChange={(value) => setNewAssignment((prev) => ({ ...prev, class_name: value }))} options={CLASS_OPTIONS} placeholder="Select class" />
              <SelectField label="Section" value={newAssignment.section} onChange={(value) => setNewAssignment((prev) => ({ ...prev, section: value }))} options={SECTION_OPTIONS} placeholder="Select section" />
              <Text style={styles.formLabel}>Due Date</Text>
              <TextInput style={styles.formInput} value={newAssignment.due_date} onChangeText={(value) => setNewAssignment((prev) => ({ ...prev, due_date: value }))} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} autoCapitalize="none" />
              <Text style={styles.formLabel}>Max Marks</Text>
              <TextInput style={styles.formInput} value={newAssignment.max_marks} onChangeText={(value) => setNewAssignment((prev) => ({ ...prev, max_marks: value }))} placeholder="100" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
              <Text style={styles.formLabel}>Description</Text>
              <TextInput style={[styles.formInput, styles.textArea]} value={newAssignment.description} onChangeText={(value) => setNewAssignment((prev) => ({ ...prev, description: value }))} placeholder="Assignment instructions" placeholderTextColor={colors.textMuted} multiline />
              <TouchableOpacity style={styles.filePickerBtn} onPress={() => pickFiles(setAssignmentFiles, true)}>
                <Text style={styles.filePickerText}>{assignmentFiles.length ? `Files Selected (${assignmentFiles.length})` : 'Attach Files'}</Text>
              </TouchableOpacity>
              {assignmentFiles.map((file) => (
                <View key={file.name} style={styles.fileChip}>
                  <Text style={styles.fileChipText}>{file.name}</Text>
                  <TouchableOpacity onPress={() => removeFile(setAssignmentFiles, file.name)}><Text style={styles.fileRemove}>Remove</Text></TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.saveBtn} onPress={createAssignment} disabled={submitting}>
                <Text style={styles.saveBtnText}>{submitting ? 'Saving...' : 'Create Assignment'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selected?.title}</Text>
              <TouchableOpacity onPress={() => setSelected(null)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {selected?.subject ? <View style={styles.modalTag}><Text style={styles.modalTagText}>{selected.subject}</Text></View> : null}
              {[
                ['Due Date', selected?.due_date?.split?.('T')?.[0] || selected?.due_date],
                ['Max Marks', selected?.max_marks],
                ['Class', selected?.class_name],
                ['Section', selected?.section],
                ['Teacher', selected?.teacher_name],
              ].filter(([, value]) => value).map(([label, value]) => (
                <View key={label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue}>{String(value)}</Text>
                </View>
              ))}
              {selected?.description ? (
                <>
                  <Text style={styles.sectionLabel}>Description</Text>
                  <Text style={styles.descFull}>{selected.description}</Text>
                </>
              ) : null}
              {!isTeacher && selected?.status !== 'submitted' && selected?.status !== 'graded' ? (
                <>
                  <Text style={styles.sectionLabel}>Your Submission</Text>
                  <TextInput
                    style={styles.submitInput}
                    value={submitText}
                    onChangeText={setSubmitText}
                    placeholder="Write your answer here..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    textAlignVertical="top"
                  />
                  <TouchableOpacity style={styles.filePickerBtn} onPress={() => pickFiles(setSubmitFiles, true)}>
                    <Text style={styles.filePickerText}>{submitFiles.length ? `Files Selected (${submitFiles.length})` : 'Attach Submission Files'}</Text>
                  </TouchableOpacity>
                  {submitFiles.map((file) => (
                    <View key={file.name} style={styles.fileChip}>
                      <Text style={styles.fileChipText}>{file.name}</Text>
                      <TouchableOpacity onPress={() => removeFile(setSubmitFiles, file.name)}><Text style={styles.fileRemove}>Remove</Text></TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={submitting}>
                    {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Assignment</Text>}
                  </TouchableOpacity>
                </>
              ) : !isTeacher ? (
                <View style={styles.submittedBanner}><Text style={styles.submittedText}>Already {selected?.status}</Text></View>
              ) : null}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { color: colors.primary, fontSize: 16, fontWeight: '600', width: 60 },
  headerTitle: { flex: 1, color: colors.text, fontSize: fonts.sizes.lg, fontWeight: 'bold', textAlign: 'center' },
  headerAction: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.primary, borderRadius: 20 },
  headerActionText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  countBadge: { backgroundColor: colors.primary + '33', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, minWidth: 60, alignItems: 'flex-end' },
  countText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  classBanner: { backgroundColor: colors.primary + '11', paddingHorizontal: spacing.lg, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  classBannerText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  teacherBanner: { marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  teacherBannerTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  teacherBannerText: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 110 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  subject: { color: colors.accent, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  desc: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  due: { color: colors.textMuted, fontSize: 12 },
  marks: { color: colors.textMuted, fontSize: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  noClassBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  noClassEmoji: { fontSize: 56, marginBottom: 16 },
  noClassTitle: { color: colors.text, fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  noClassText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 22 },
  retryBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 24 },
  retryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 24 },
  formLabel: { color: colors.textMuted, fontSize: 13, marginBottom: 6, marginTop: spacing.md },
  formInput: { backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text, fontSize: 14 },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: 'bold', flex: 1 },
  modalClose: { color: colors.textMuted, fontSize: 20, paddingLeft: 12 },
  modalTag: { alignSelf: 'flex-start', backgroundColor: colors.accent + '22', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: spacing.md },
  modalTagText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { color: colors.textMuted, fontSize: 14 },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  sectionLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.md, marginBottom: spacing.sm },
  descFull: { color: colors.text, fontSize: 14, lineHeight: 22, marginBottom: spacing.md },
  submitInput: { backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: spacing.md, color: colors.text, fontSize: 14, minHeight: 140 },
  submitBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: spacing.md },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  submittedBanner: { backgroundColor: colors.success + '22', borderRadius: 12, padding: spacing.md, alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.xl },
  submittedText: { color: colors.success, fontSize: 15, fontWeight: '700' },
  filePickerBtn: { marginTop: spacing.md, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: 12, alignItems: 'center' },
  filePickerText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  fileChip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  fileChipText: { color: colors.text, flex: 1, marginRight: 12, fontSize: 13 },
  fileRemove: { color: colors.error, fontWeight: '700', fontSize: 12 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: spacing.lg },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg, backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 30, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  fabText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
