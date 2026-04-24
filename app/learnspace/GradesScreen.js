import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, Modal, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import LoadingScreen from '../../components/LoadingScreen';
import ErrorScreen from '../../components/ErrorScreen';
import ScreenWrapper from '../../components/ScreenWrapper';
import SelectField from '../../components/SelectField';
import { buildDemoGradesForStudents, getAssignedStudentsForTeacher } from '../../services/demoData';

const BASE = 'https://nyxion-learnspace-production.up.railway.app/api/v1';

export default function GradesScreen({ navigation }) {
  const [grades, setGrades] = useState([]);
  const [teacherStudents, setTeacherStudents] = useState([]);
  const [teacherSummary, setTeacherSummary] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [me, setMe] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setError(null);
    try {
      const token = await AsyncStorage.getItem('learn_token');
      const meRes = await fetch(`${BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const meData = await meRes.json();
      if (!meRes.ok) throw new Error(meData.detail || 'Failed to load profile');

      const teacherUser = meData.role?.toLowerCase() === 'teacher';
      setMe(meData);
      setIsTeacher(teacherUser);

      if (teacherUser) {
        const students = await getAssignedStudentsForTeacher(meData);
        const teacherGrades = buildDemoGradesForStudents(students);
        const summary = students.map((student) => {
          const studentGrades = teacherGrades.filter((grade) => String(grade.student_id) === String(student.id));
          const average = studentGrades.length
            ? Math.round(studentGrades.reduce((sum, grade) => sum + (grade.percentage || 0), 0) / studentGrades.length)
            : null;
          return {
            ...student,
            average,
            totalRecords: studentGrades.length,
          };
        });

        setTeacherStudents(students);
        setTeacherSummary(summary);
        setGrades(teacherGrades);
        setSelectedStudent(summary[0] ? String(summary[0].id) : '');
      } else {
        const res = await fetch(`${BASE}/grades/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to load grades');
        setGrades(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const studentOptions = useMemo(
    () => teacherSummary.map((student) => ({
      label: `${student.full_name}${student.roll_number ? ` • ${student.roll_number}` : ''}`,
      value: String(student.id),
    })),
    [teacherSummary]
  );

  const visibleGrades = useMemo(() => {
    if (!isTeacher) return grades;
    if (!selectedStudent) return grades;
    return grades.filter((grade) => String(grade.student_id) === String(selectedStudent));
  }, [grades, isTeacher, selectedStudent]);

  const teacherCard = useMemo(
    () => teacherSummary.find((student) => String(student.id) === String(selectedStudent)) || teacherSummary[0],
    [teacherSummary, selectedStudent]
  );

  const avg = visibleGrades.length
    ? (visibleGrades.reduce((sum, grade) => sum + (grade.percentage || 0), 0) / visibleGrades.length).toFixed(1)
    : null;

  const gradeColor = (pct) => {
    if (pct == null) return colors.textMuted;
    if (pct >= 90) return colors.success;
    if (pct >= 75) return colors.accent;
    if (pct >= 60) return '#FF9800';
    return colors.error;
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
          <View style={styles.teacherIntro}>
            <Text style={styles.teacherIntroTitle}>{me?.full_name || me?.name || 'Teacher'}</Text>
            <Text style={styles.teacherIntroText}>
              Review the students currently mapped to your portal and open any record for marks and feedback.
            </Text>
          </View>
          <View style={styles.filterWrap}>
            <SelectField
              label="Student"
              value={selectedStudent}
              onChange={setSelectedStudent}
              options={studentOptions}
              placeholder={teacherStudents.length ? 'Select student' : 'No students assigned'}
            />
          </View>
          {teacherCard ? (
            <View style={styles.avgCard}>
              <Text style={styles.studentName}>{teacherCard.full_name}</Text>
              <Text style={styles.studentMeta}>
                {teacherCard.roll_number || 'No roll'} · Class {teacherCard.class_name || '—'}{teacherCard.section ? `-${teacherCard.section}` : ''}
              </Text>
              <Text style={[styles.avgVal, { color: gradeColor(teacherCard.average) }]}>{teacherCard.average ?? '—'}%</Text>
              <Text style={styles.avgLabel}>{teacherCard.totalRecords} recorded grades</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>👩‍🏫</Text>
              <Text style={styles.emptyText}>No students assigned yet{"\n"}Use EduOS student management to connect students to this teacher.</Text>
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
        keyExtractor={(item) => String(item.id || item.assignment_id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.8}>
            <View style={styles.info}>
              <Text style={styles.name}>{item.assignment_title}</Text>
              {isTeacher ? <Text style={styles.studentLine}>{item.student_name}</Text> : null}
              {item.subject && <Text style={styles.subject}>{item.subject}</Text>}
              <Text style={styles.date}>{item.graded_at?.split('T')[0]}</Text>
            </View>
            <View style={styles.scoreBox}>
              <Text style={[styles.pct, { color: gradeColor(item.percentage) }]}>{item.percentage}%</Text>
              <Text style={styles.marks}>{item.marks_obtained}/{item.max_marks}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>{isTeacher ? '📝' : '📊'}</Text>
            <Text style={styles.emptyText}>
              {isTeacher
                ? 'No grades to show for this student yet'
                : 'No grades yet\nGrades appear after your teacher marks your work'}
            </Text>
          </View>
        }
      />

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selected?.assignment_title}</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {[
                isTeacher ? ['Student', selected?.student_name] : null,
                isTeacher ? ['Roll Number', selected?.roll_number] : null,
                ['Subject', selected?.subject],
                ['Marks', `${selected?.marks_obtained} / ${selected?.max_marks}`],
                ['Percentage', `${selected?.percentage}%`],
                ['Grade', selected?.grade],
                ['Graded On', selected?.graded_at?.split('T')[0]],
              ].filter(Boolean).filter(([, value]) => value).map(([label, value]) => (
                <View key={label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue}>{value}</Text>
                </View>
              ))}
              {selected?.feedback ? (
                <View style={styles.feedbackBox}>
                  <Text style={styles.feedbackLabel}>{isTeacher ? 'Teacher Notes' : 'Teacher Feedback'}</Text>
                  <Text style={styles.feedbackText}>{selected.feedback}</Text>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { color: colors.accent, fontSize: 16, fontWeight: '600', width: 60 },
  headerTitle: { flex: 1, color: colors.text, fontSize: fonts.sizes.lg, fontWeight: 'bold', textAlign: 'center' },
  teacherIntro: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  teacherIntroTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  teacherIntroText: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  filterWrap: { paddingHorizontal: spacing.lg },
  avgCard: { marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  avgVal: { fontSize: 52, fontWeight: 'bold' },
  avgLabel: { color: colors.textMuted, fontSize: 14, marginTop: 4 },
  studentName: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 4 },
  studentMeta: { color: colors.textMuted, fontSize: 13 },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  info: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  studentLine: { color: colors.text, fontSize: 12, marginTop: 2 },
  subject: { color: colors.accent, fontSize: 12, marginTop: 2 },
  date: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  scoreBox: { alignItems: 'flex-end' },
  pct: { fontSize: 24, fontWeight: 'bold' },
  marks: { color: colors.textMuted, fontSize: 11 },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: spacing.lg },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 24 },
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: 'bold', flex: 1 },
  modalClose: { color: colors.textMuted, fontSize: 20, paddingLeft: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { color: colors.textMuted, fontSize: 14 },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  feedbackBox: { backgroundColor: colors.accent + '11', borderRadius: 12, padding: spacing.md, marginTop: spacing.md },
  feedbackLabel: { color: colors.accent, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  feedbackText: { color: colors.text, fontSize: 14, lineHeight: 20 },
});
