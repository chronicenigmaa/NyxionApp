import React, { useEffect, useMemo, useState } from 'react';
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
import { getRealAssignedStudentsForTeacher, getAssignedStudentsForTeacher } from '../../services/demoData';
import { learn } from '../../services/api';

const BASE = 'https://nyxion-learnspace-production.up.railway.app/api/v1';
const LOCAL_GRADES_KEY = 'nyxion_local_grades';

async function saveLocalGrade(grade) {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_GRADES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const key = g => `${g.student_id}-${g.assignment_id}`;
    const filtered = list.filter(g => key(g) !== key(grade));
    const entry = {
      ...grade,
      id: grade.id || `local-grade-${Date.now()}`,
      graded_at: grade.graded_at || new Date().toISOString(),
      percentage: grade.max_marks
        ? Math.round((Number(grade.marks_obtained) / Number(grade.max_marks)) * 100)
        : grade.percentage || 0,
      grade: computeLetterGrade(grade.percentage || Math.round((Number(grade.marks_obtained) / Number(grade.max_marks)) * 100)),
    };
    await AsyncStorage.setItem(LOCAL_GRADES_KEY, JSON.stringify([entry, ...filtered]));
    return entry;
  } catch { return null; }
}

async function getLocalGrades() {
  try { return JSON.parse(await AsyncStorage.getItem(LOCAL_GRADES_KEY) || '[]'); }
  catch { return []; }
}

function computeLetterGrade(pct) {
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 60) return 'D';
  return 'F';
}

function normalizeStudent(s) {
  return {
    ...s,
    id: s.id ?? s.student_id ?? s.roll_number ?? s.email,
    full_name: s.full_name ?? s.name ?? s.student_name ?? s.username ?? 'Student',
    roll_number: s.roll_number ?? s.roll ?? 'N/A',
  };
}

function mergeGrades(apiGrades, localGrades, studentId, studentName) {
  const key = g => `${g.student_id}-${g.assignment_id}`;
  const apiKeys = new Set(apiGrades.map(key));
  const localForStudent = localGrades.filter(g => {
    if (!studentId && !studentName) return true;
    if (studentId && String(g.student_id) === String(studentId)) return true;
    if (studentName && g.student_name && g.student_name.trim().toLowerCase() === studentName.trim().toLowerCase()) return true;
    return false;
  });
  const localNew = localForStudent.filter(g => !apiKeys.has(key(g)));
  return [...apiGrades, ...localNew];
}

export default function GradesScreen({ navigation }) {
  const [grades, setGrades] = useState([]);
  const [teacherStudents, setTeacherStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [me, setMe] = useState(null);
  const [editingGrade, setEditingGrade] = useState(null);
  const [savingGrade, setSavingGrade] = useState(false);
  const [localGrades, setLocalGrades] = useState([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setError(null);
    try {
      const token = await AsyncStorage.getItem('learn_token');
      const meRes = await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      const meData = await meRes.json();
      if (!meRes.ok) throw new Error(meData.detail || 'Failed to load profile');
      setMe(meData);
      const teacherUser = meData.role?.toLowerCase() === 'teacher';
      setIsTeacher(teacherUser);

      const stored = await getLocalGrades();
      setLocalGrades(stored);

      if (teacherUser) {
        // Load students — try API first, fall back to local assignments
        let students = await getRealAssignedStudentsForTeacher(meData);
        if (!students.length) {
          for (const url of [`${BASE}/users/students`, `${BASE}/students/`, `${BASE}/users/?role=student`]) {
            try {
              const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
              if (res.ok) {
                const data = await res.json();
                const found = Array.isArray(data) ? data : data.items || data.students || data.users || [];
                if (found.length) { students = found.map(normalizeStudent); break; }
              }
            } catch {}
          }
        }
        if (!students.length) students = await getAssignedStudentsForTeacher(meData);
        students = students.map(normalizeStudent);
        setTeacherStudents(students);

        const first = students[0];
        setSelectedStudent(first ? String(first.id) : '');

        // Load grades for first student
        if (first) {
          const apiGrades = await fetchStudentGrades(token, first.id);
          setGrades(mergeGrades(apiGrades, stored, first.id, first.full_name));
        }
      } else {
        // Student view — match by id or name
        let apiGrades = [];
        try {
          const res = await fetch(`${BASE}/grades/my`, { headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json();
          if (res.ok) apiGrades = Array.isArray(data) ? data : data.grades || data.items || [];
        } catch {}
        setGrades(mergeGrades(apiGrades, stored, meData.id, meData.full_name || meData.name));
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const fetchStudentGrades = async (token, studentId) => {
    for (const path of [
      `/grades/student/${studentId}`,
      `/grades/?student_id=${studentId}`,
      `/grades/?student=${studentId}`,
    ]) {
      try {
        const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data.items || data.grades || [];
          if (list.length) return list;
        }
      } catch {}
    }
    return [];
  };

  // When selected student changes, reload grades
  useEffect(() => {
    if (!isTeacher || !selectedStudent) return;
    const student = teacherStudents.find(s => String(s.id) === String(selectedStudent));
    const studentName = student?.full_name;
    let active = true;
    (async () => {
      try {
        const token = await AsyncStorage.getItem('learn_token');
        const apiGrades = await fetchStudentGrades(token, selectedStudent);
        if (!active) return;
        setGrades(mergeGrades(apiGrades, localGrades, selectedStudent, studentName));
      } catch {}
    })();
    return () => { active = false; };
  }, [isTeacher, selectedStudent, localGrades, teacherStudents]);

  const studentOptions = useMemo(
    () => teacherStudents.map(s => ({
      label: `${s.full_name || 'Student'}${s.roll_number && s.roll_number !== 'N/A' ? ` · ${s.roll_number}` : ''}`,
      value: String(s.id),
    })),
    [teacherStudents]
  );

  const visibleGrades = useMemo(() => {
    if (!isTeacher || !selectedStudent) return grades;
    const student = teacherStudents.find(s => String(s.id) === String(selectedStudent));
    const studentName = student?.full_name?.trim().toLowerCase();
    return grades.filter(g =>
      String(g.student_id) === String(selectedStudent) ||
      (studentName && g.student_name && g.student_name.trim().toLowerCase() === studentName)
    );
  }, [grades, isTeacher, selectedStudent, teacherStudents]);

  const avg = visibleGrades.length
    ? (visibleGrades.reduce((s, g) => s + (Number(g.percentage) || 0), 0) / visibleGrades.length).toFixed(1)
    : null;

  const gradeColor = (pct) => {
    if (pct == null) return colors.textMuted;
    if (pct >= 90) return colors.success;
    if (pct >= 75) return colors.accent;
    if (pct >= 60) return '#FF9800';
    return colors.error;
  };

  const currentStudent = useMemo(
    () => teacherStudents.find(s => String(s.id) === String(selectedStudent)),
    [teacherStudents, selectedStudent]
  );

  const saveGrade = async () => {
    if (!editingGrade?.marks_obtained && editingGrade?.marks_obtained !== 0)
      return Alert.alert('Required', 'Enter marks');
    setSavingGrade(true);
    try {
      const gradePayload = {
        ...editingGrade,
        marks_obtained: Number(editingGrade.marks_obtained),
        percentage: editingGrade.max_marks
          ? Math.round((Number(editingGrade.marks_obtained) / Number(editingGrade.max_marks)) * 100)
          : editingGrade.percentage,
      };

      let apiSuccess = false;
      // Try grading via submission endpoint
      const submissionId = editingGrade.submission_id || editingGrade.submissionId;
      if (submissionId) {
        try {
          await learn.post(`/submissions/${submissionId}/grade`, {
            marks: Number(editingGrade.marks_obtained),
            feedback: editingGrade.feedback || '',
          });
          apiSuccess = true;
        } catch {}
      }
      // Try grades endpoint
      if (!apiSuccess) {
        for (const endpoint of ['/grades', '/grades/create']) {
          try {
            await learn.post(endpoint, {
              student_id: editingGrade.student_id,
              assignment_id: editingGrade.assignment_id,
              marks_obtained: Number(editingGrade.marks_obtained),
              max_marks: editingGrade.max_marks,
              feedback: editingGrade.feedback || '',
            });
            apiSuccess = true;
            break;
          } catch {}
        }
      }

      // Always save locally
      const saved = await saveLocalGrade(gradePayload);
      const isDupe = g =>
        (g.student_id && gradePayload.student_id && String(g.student_id) === String(gradePayload.student_id) && String(g.assignment_id) === String(gradePayload.assignment_id)) ||
        (g.student_name && gradePayload.student_name && g.student_name.trim().toLowerCase() === gradePayload.student_name.trim().toLowerCase() && String(g.assignment_id) === String(gradePayload.assignment_id));
      setLocalGrades(prev => [saved, ...prev.filter(g => !isDupe(g))]);
      setGrades(prev => [saved, ...prev.filter(g => !isDupe(g))]);

      Alert.alert('Saved', apiSuccess ? 'Grade saved successfully.' : 'Grade saved on this device.');
      setEditingGrade(null);
      setSelected(null);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSavingGrade(false); }
  };

  if (loading) return <LoadingScreen message="Loading grades..." />;
  if (error) return <ErrorScreen message={error} onRetry={load} />;

  return (
    <ScreenWrapper>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isTeacher ? 'Student Grades' : 'My Grades'}</Text>
        <View style={{ width: 60 }} />
      </View>

      {isTeacher ? (
        <>
          {teacherStudents.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>👩‍🏫</Text>
              <Text style={styles.emptyText}>No students assigned yet</Text>
            </View>
          ) : (
            <View style={styles.filterWrap}>
              <SelectField
                label="Student"
                value={selectedStudent}
                onChange={setSelectedStudent}
                options={studentOptions}
                placeholder="Select student"
              />
            </View>
          )}
          {currentStudent && (
            <View style={styles.avgCard}>
              <Text style={styles.studentName}>{currentStudent.full_name}</Text>
              <Text style={styles.studentMeta}>
                {currentStudent.roll_number !== 'N/A' ? `Roll: ${currentStudent.roll_number}` : ''}
                {currentStudent.class_name ? ` · Class ${currentStudent.class_name}` : ''}
                {currentStudent.section ? `-${currentStudent.section}` : ''}
              </Text>
              {avg && (
                <>
                  <Text style={[styles.avgVal, { color: gradeColor(parseFloat(avg)) }]}>{avg}%</Text>
                  <Text style={styles.avgLabel}>{visibleGrades.length} recorded grades</Text>
                </>
              )}
            </View>
          )}
        </>
      ) : (
        avg && (
          <View style={styles.avgCard}>
            <Text style={[styles.avgVal, { color: gradeColor(parseFloat(avg)) }]}>{avg}%</Text>
            <Text style={styles.avgLabel}>Average · {visibleGrades.length} graded</Text>
          </View>
        )
      )}

      <FlatList
        data={visibleGrades}
        keyExtractor={(item, i) => String(item.id || `${item.student_id}-${item.assignment_id}-${i}`)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.8}>
            <View style={styles.info}>
              <Text style={styles.name}>{item.assignment_title || 'Assignment'}</Text>
              {isTeacher && item.student_name ? <Text style={styles.studentLine}>{item.student_name}</Text> : null}
              {item.subject ? <Text style={styles.subject}>{item.subject}</Text> : null}
              {item.graded_at ? <Text style={styles.date}>{item.graded_at?.split('T')[0]}</Text> : null}
            </View>
            <View style={styles.scoreBox}>
              <Text style={[styles.pct, { color: gradeColor(item.percentage) }]}>{item.percentage ?? '—'}%</Text>
              <Text style={styles.marks}>{item.marks_obtained}/{item.max_marks}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>{isTeacher ? '📝' : '📊'}</Text>
            <Text style={styles.emptyText}>
              {isTeacher ? 'No grades yet — grade submissions from the Assignments screen' : 'No grades yet\nGrades appear after your teacher marks your work'}
            </Text>
          </View>
        }
      />

      {/* Grade detail modal */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selected?.assignment_title || 'Grade'}</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {[
                isTeacher ? ['Student', selected?.student_name] : null,
                ['Subject', selected?.subject],
                ['Marks', selected?.marks_obtained != null ? `${selected.marks_obtained} / ${selected.max_marks}` : null],
                ['Percentage', selected?.percentage != null ? `${selected.percentage}%` : null],
                ['Grade', selected?.grade],
                ['Graded On', selected?.graded_at?.split('T')[0]],
              ].filter(Boolean).filter(([, v]) => v).map(([label, value]) => (
                <View key={label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue}>{String(value)}</Text>
                </View>
              ))}
              {selected?.feedback ? (
                <View style={styles.feedbackBox}>
                  <Text style={styles.feedbackLabel}>{isTeacher ? 'Notes' : 'Teacher Feedback'}</Text>
                  <Text style={styles.feedbackText}>{selected.feedback}</Text>
                </View>
              ) : null}
              {isTeacher ? (
                <TouchableOpacity style={styles.editGradeBtn} onPress={() => setEditingGrade({ ...selected })}>
                  <Text style={styles.editGradeBtnText}>Edit / Save Grade</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Grade edit modal */}
      <Modal visible={!!editingGrade} animationType="slide" transparent onRequestClose={() => setEditingGrade(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Grade Submission</Text>
              <TouchableOpacity onPress={() => setEditingGrade(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {editingGrade?.student_name ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Student</Text>
                  <Text style={styles.detailValue}>{editingGrade.student_name}</Text>
                </View>
              ) : null}
              {editingGrade?.assignment_title ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Assignment</Text>
                  <Text style={styles.detailValue}>{editingGrade.assignment_title}</Text>
                </View>
              ) : null}
              <Text style={styles.inputLabel}>Marks Obtained {editingGrade?.max_marks ? `(out of ${editingGrade.max_marks})` : ''}</Text>
              <TextInput
                style={styles.input}
                value={editingGrade?.marks_obtained != null ? String(editingGrade.marks_obtained) : ''}
                onChangeText={v => setEditingGrade(prev => ({ ...prev, marks_obtained: v }))}
                keyboardType="numeric"
                placeholder="e.g. 85"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.inputLabel}>Feedback (optional)</Text>
              <TextInput
                style={[styles.input, styles.feedbackInput]}
                value={editingGrade?.feedback || ''}
                onChangeText={v => setEditingGrade(prev => ({ ...prev, feedback: v }))}
                placeholder="Write feedback for the student..."
                placeholderTextColor={colors.textMuted}
                multiline
              />
              <TouchableOpacity style={styles.editGradeBtn} onPress={saveGrade} disabled={savingGrade}>
                {savingGrade
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.editGradeBtnText}>Save Grade</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { color: colors.accent, fontSize: 16, fontWeight: '600', width: 60 },
  headerTitle: { flex: 1, color: colors.text, fontSize: fonts.sizes.lg, fontWeight: 'bold', textAlign: 'center' },
  filterWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  avgCard: { marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  avgVal: { fontSize: 52, fontWeight: 'bold', marginTop: 8 },
  avgLabel: { color: colors.textMuted, fontSize: 14, marginTop: 4 },
  studentName: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  studentMeta: { color: colors.textMuted, fontSize: 13 },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  info: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  studentLine: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  subject: { color: colors.accent, fontSize: 12, marginTop: 2 },
  date: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  scoreBox: { alignItems: 'flex-end' },
  pct: { fontSize: 24, fontWeight: 'bold' },
  marks: { color: colors.textMuted, fontSize: 11 },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: spacing.lg },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 24 },
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: 'bold', flex: 1 },
  modalClose: { color: colors.textMuted, fontSize: 20, paddingLeft: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { color: colors.textMuted, fontSize: 14 },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  feedbackBox: { backgroundColor: colors.accent + '11', borderRadius: 12, padding: spacing.md, marginTop: spacing.md },
  feedbackLabel: { color: colors.accent, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  feedbackText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  editGradeBtn: { marginTop: spacing.lg, backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  editGradeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  inputLabel: { color: colors.textMuted, fontSize: 13, marginTop: spacing.md, marginBottom: 6 },
  input: { backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text, fontSize: 14 },
  feedbackInput: { minHeight: 110, textAlignVertical: 'top' },
});
