import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, Modal, ScrollView, TextInput,
  Alert, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import LoadingScreen from '../../components/LoadingScreen';
import ErrorScreen from '../../components/ErrorScreen';
import ScreenWrapper from '../../components/ScreenWrapper';

const BASE = 'https://nyxion-learnspace-production.up.railway.app/api/v1';

async function getToken() { return AsyncStorage.getItem('learn_token'); }

async function ensureClassSet() {
  // If student has no class_name, fetch profile and check
  const token = await getToken();
  const res = await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const user = await res.json();
  return user;
}

export default function AssignmentsScreen({ navigation, route }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [submitText, setSubmitText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [userClass, setUserClass] = useState(null);
  const [noClass, setNoClass] = useState(false);
  const [me, setMe] = useState(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newAssignment, setNewAssignment] = useState({ title: '', subject: '', class_name: '', due_date: '', max_marks: '', description: '' });
  const teacherMode = route?.params?.teacherMode;
  const canCreate = isTeacher || teacherMode;

  useEffect(() => { load(); }, []);

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

      const res = await fetch(`${BASE}/assignments/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed');
      setItems(Array.isArray(data) ? data : []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const submit = async () => {
    if (!submitText.trim()) return Alert.alert('Required', 'Please write your submission');
    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/submissions/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ assignment_id: selected.id, content: submitText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Submission failed');
      Alert.alert('✅ Submitted!', 'Your assignment has been submitted.');
      setSelected(null);
      setSubmitText('');
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSubmitting(false); }
  };

  const createAssignment = async () => {
    if (!newAssignment.title || !newAssignment.class_name) return Alert.alert('Required', 'Title and class are required');
    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/assignments/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: newAssignment.title,
          subject: newAssignment.subject,
          class_name: newAssignment.class_name,
          due_date: newAssignment.due_date,
          max_marks: Number(newAssignment.max_marks),
          description: newAssignment.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to create assignment');
      Alert.alert('✅ Created', 'Assignment created successfully');
      setShowCreate(false);
      setNewAssignment({ title: '', subject: '', class_name: '', due_date: '', max_marks: '', description: '' });
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSubmitting(false); }
  };

  if (loading) return <LoadingScreen message="Loading assignments..." />;
  if (error) return <ErrorScreen message={error} onRetry={load} />;

  const statusColor = s => s === 'submitted' ? colors.success : s === 'graded' ? colors.accent : colors.primary;

  if (noClass) {
    return (
      <ScreenWrapper>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
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
            <Text style={styles.retryBtnText}>🔄 Retry</Text>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isTeacher ? 'Teacher Assignments' : 'Assignments'}</Text>
        {canCreate ? (
          <TouchableOpacity style={styles.headerAction} onPress={() => setShowCreate(true)}>
            <Text style={styles.headerActionText}>+ Create</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.countBadge]}>
            <Text style={styles.countText}>{items.length}</Text>
          </View>
        )}
      </View>

      {userClass && (
        <View style={styles.classBanner}>
          <Text style={styles.classBannerText}>📚 Class: {userClass}</Text>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.8}>
            <View style={styles.cardTop}>
              <Text style={styles.name}>{item.title}</Text>
              <View style={[styles.badge, { backgroundColor: statusColor(item.status) + '22' }]}>
                <Text style={{ color: statusColor(item.status), fontSize: 11, fontWeight: '700' }}>
                  {item.status?.toUpperCase()}
                </Text>
              </View>
            </View>
            {item.subject && <Text style={styles.subject}>{item.subject}</Text>}
            {item.description && <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>}
            <View style={styles.cardFooter}>
              <Text style={styles.due}>📅 Due: {item.due_date?.split('T')[0]}</Text>
              <Text style={styles.marks}>Max: {item.max_marks} marks</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📝</Text>
            <Text style={styles.emptyText}>No assignments yet{'\n'}Your teacher hasn't posted any</Text>
          </View>
        }
      />

      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Assignment</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {[
                ['Title *', 'title'],
                ['Subject', 'subject'],
                ['Class *', 'class_name'],
                ['Due Date', 'due_date'],
                ['Max Marks', 'max_marks'],
              ].map(([label, key]) => (
                <View key={key}>
                  <Text style={styles.formLabel}>{label}</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newAssignment[key]}
                    onChangeText={v => setNewAssignment(prev => ({ ...prev, [key]: v }))}
                    placeholder={label.replace(' *', '')}
                    placeholderTextColor={colors.textMuted}
                    keyboardType={key === 'max_marks' ? 'numeric' : 'default'}
                    autoCapitalize={key === 'class_name' ? 'words' : 'sentences'}
                  />
                </View>
              ))}
              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                style={[styles.formInput, { minHeight: 120, textAlignVertical: 'top' }]}
                value={newAssignment.description}
                onChangeText={v => setNewAssignment(prev => ({ ...prev, description: v }))}
                placeholder="Assignment instructions"
                placeholderTextColor={colors.textMuted}
                multiline
              />
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
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {selected?.subject && <View style={styles.modalTag}><Text style={styles.modalTagText}>{selected.subject}</Text></View>}
              {[
                ['Due Date', selected?.due_date?.split('T')[0]],
                ['Max Marks', selected?.max_marks],
                ['Class', selected?.class_name],
                ['Teacher', selected?.teacher_name],
              ].filter(([, v]) => v).map(([label, value]) => (
                <View key={label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue}>{String(value)}</Text>
                </View>
              ))}
              {selected?.description && (
                <>
                  <Text style={styles.sectionLabel}>Description</Text>
                  <Text style={styles.descFull}>{selected.description}</Text>
                </>
              )}
              {selected?.status !== 'submitted' && selected?.status !== 'graded' ? (
                <>
                  <Text style={styles.sectionLabel}>Your Submission</Text>
                  <TextInput
                    style={styles.submitInput}
                    value={submitText}
                    onChangeText={setSubmitText}
                    placeholder="Write your answer here..."
                    placeholderTextColor={colors.textMuted}
                    multiline numberOfLines={6}
                    textAlignVertical="top"
                  />
                  <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={submitting}>
                    {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>📤 Submit Assignment</Text>}
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.submittedBanner}>
                  <Text style={styles.submittedText}>✅ Already {selected?.status}</Text>
                </View>
              )}
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
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl },
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
});
