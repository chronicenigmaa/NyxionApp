import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput,
  RefreshControl, Modal, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import LoadingScreen from '../../components/LoadingScreen';
import ErrorScreen from '../../components/ErrorScreen';
import ScreenWrapper from '../../components/ScreenWrapper';
import SelectField from '../../components/SelectField';
import {
  assignStudentToTeacher,
  removeStudentFromTeacher,
  seedNadiaAssignments,
} from '../../services/demoData';

const BASE = 'https://nyxion-eduos-production-63b9.up.railway.app/api/v1';

const EMPTY_FORM = {
  full_name: '',
  father_name: '',
  roll_number: '',
  class_name: '',
  section: '',
  phone: '',
  email: '',
  teacher_id: '',
  teacher_name: '',
};

export default function StudentsScreen({ navigation }) {
  const [students, setStudents] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const classOptions = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const sectionOptions = ['A', 'B', 'C', 'D', 'E'];
  const classDropdown = classOptions.map(option => ({ label: `Class ${option}`, value: option }));
  const sectionDropdown = sectionOptions.map(option => ({ label: `Section ${option}`, value: option }));
  const teacherDropdown = useMemo(
    () => [{ label: 'Not assigned', value: '' }, ...teachers.map(teacher => ({ label: teacher.full_name, value: String(teacher.id) }))],
    [teachers]
  );

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!search) {
      setFiltered(students);
      return;
    }
    const q = search.toLowerCase();
    setFiltered(
      students.filter((student) =>
        student.full_name?.toLowerCase().includes(q) ||
        student.roll_number?.toLowerCase().includes(q) ||
        student.class_name?.toLowerCase().includes(q) ||
        student.teacher_name?.toLowerCase().includes(q)
      )
    );
  }, [search, students]);

  const syncStudentAssignment = async (studentData) => {
    const previousTeacherId = String(studentData.previous_teacher_id || '');
    const nextTeacherId = String(studentData.teacher_id || '');
    const nextTeacher = teachers.find((teacher) => String(teacher.id) === nextTeacherId);

    if (previousTeacherId && previousTeacherId !== nextTeacherId) {
      await removeStudentFromTeacher(studentData, previousTeacherId);
    }
    if (nextTeacherId && nextTeacher) {
      await assignStudentToTeacher(
        {
          ...studentData,
          teacher_id: nextTeacherId,
          teacher_name: nextTeacher.full_name,
        },
        nextTeacher
      );
    }
  };

  const load = async () => {
    setError(null);
    try {
      const token = await AsyncStorage.getItem('token');
      const [studentsRes, teachersRes] = await Promise.all([
        fetch(`${BASE}/students/`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${BASE}/teachers/`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const studentsData = await studentsRes.json();
      const teachersData = await teachersRes.json();
      if (!studentsRes.ok) throw new Error(studentsData.detail || 'Failed to load students');
      if (!teachersRes.ok) throw new Error(teachersData.detail || 'Failed to load teachers');

      const teacherList = Array.isArray(teachersData) ? teachersData : teachersData.teachers || teachersData.items || [];
      const studentList = Array.isArray(studentsData) ? studentsData : studentsData.students || studentsData.items || [];
      const { students: seededStudents } = await seedNadiaAssignments(teacherList, studentList);

      setTeachers(teacherList);
      setStudents(seededStudents);
      setFiltered(seededStudents);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const setTeacherOnForm = (teacherId, setter) => {
    const teacher = teachers.find((item) => String(item.id) === String(teacherId));
    setter((prev) => ({
      ...prev,
      teacher_id: teacherId,
      teacher_name: teacher?.full_name || '',
    }));
  };

  const addStudent = async () => {
    if (!form.full_name) return Alert.alert('Required', 'Full name is required');
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const payload = {
        full_name: form.full_name,
        father_name: form.father_name,
        roll_number: form.roll_number,
        class_name: form.class_name,
        section: form.section,
        phone: form.phone,
        email: form.email,
      };
      if (form.teacher_id) payload.teacher_id = Number.isNaN(Number(form.teacher_id)) ? form.teacher_id : Number(form.teacher_id);

      const res = await fetch(`${BASE}/students/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to add student');

      await syncStudentAssignment({
        ...data,
        ...payload,
        id: data?.id ?? data?.student_id ?? form.roll_number ?? form.email ?? form.full_name,
        teacher_id: form.teacher_id,
        teacher_name: form.teacher_name,
      });

      Alert.alert('Added', `${form.full_name} added successfully`);
      setShowAdd(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const updateStudent = async () => {
    if (!selected?.full_name) return Alert.alert('Required', 'Full name is required');
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const payload = {
        full_name: selected.full_name,
        father_name: selected.father_name,
        roll_number: selected.roll_number,
        class_name: selected.class_name,
        section: selected.section,
        phone: selected.phone,
        email: selected.email,
      };
      if (selected.teacher_id) payload.teacher_id = Number.isNaN(Number(selected.teacher_id)) ? selected.teacher_id : Number(selected.teacher_id);

      const res = await fetch(`${BASE}/students/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to update student');

      await syncStudentAssignment({
        ...selected,
        ...data,
        previous_teacher_id: selected.previous_teacher_id ?? selected.teacher_id_before_edit,
      });

      Alert.alert('Updated', `${selected.full_name} updated successfully`);
      setSelected(null);
      load();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteStudent = async () => {
    if (!selected) return;
    Alert.alert('Confirm Delete', `Delete ${selected.full_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            const token = await AsyncStorage.getItem('token');
            const res = await fetch(`${BASE}/students/${selected.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.detail || 'Failed to delete student');
            }
            if (selected.teacher_id) {
              await removeStudentFromTeacher(selected, selected.teacher_id);
            }
            Alert.alert('Deleted', `${selected.full_name} has been removed.`);
            setSelected(null);
            load();
          } catch (e) {
            Alert.alert('Error', e.message);
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const openStudent = (student) => {
    setSelected({
      ...student,
      teacher_id: student.teacher_id ? String(student.teacher_id) : '',
      previous_teacher_id: student.teacher_id ? String(student.teacher_id) : '',
      teacher_id_before_edit: student.teacher_id ? String(student.teacher_id) : '',
    });
  };

  if (loading) return <LoadingScreen message="Loading students..." />;
  if (error) return <ErrorScreen message={error} onRetry={load} />;

  return (
    <ScreenWrapper style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Students</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.helperText}>Manage student records, assign class teachers, and keep portal access aligned.</Text>

      <TextInput
        style={styles.search}
        placeholder="Search name, roll, class, teacher..."
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openStudent(item)} activeOpacity={0.8}>
            <View style={[styles.avatar, { backgroundColor: colors.primary + '18' }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>{item.full_name?.[0]?.toUpperCase() || '?'}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.full_name}</Text>
              <Text style={styles.sub}>Roll: {item.roll_number || 'N/A'} · Class {item.class_name || '—'}{item.section ? `-${item.section}` : ''}</Text>
              {item.father_name ? <Text style={styles.sub}>Father: {item.father_name}</Text> : null}
              {item.teacher_name ? <Text style={styles.sub}>Teacher: {item.teacher_name}</Text> : <Text style={styles.subMuted}>No teacher assigned yet</Text>}
            </View>
            <View style={[styles.statusDot, { backgroundColor: item.is_active === false ? colors.error : colors.success }]} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No students found</Text>}
      />

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selected?.full_name || 'Edit Student'}</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.editHint}>Update profile details, class placement, and teacher assignment from one place.</Text>
              {[
                ['Full Name *', 'full_name', 'default'],
                ['Father Name', 'father_name', 'default'],
                ['Roll Number', 'roll_number', 'default'],
                ['Phone', 'phone', 'phone-pad'],
                ['Email', 'email', 'email-address'],
              ].map(([label, key, keyboardType]) => (
                <View key={key}>
                  <Text style={styles.formLabel}>{label}</Text>
                  <TextInput
                    style={styles.formInput}
                    value={selected?.[key] ? String(selected[key]) : ''}
                    onChangeText={(value) => setSelected(prev => ({ ...prev, [key]: value }))}
                    placeholder={label.replace(' *', '')}
                    placeholderTextColor={colors.textMuted}
                    keyboardType={keyboardType}
                    autoCapitalize={key === 'email' ? 'none' : 'words'}
                  />
                </View>
              ))}

              <SelectField
                label="Class"
                value={selected?.class_name}
                onChange={(value) => setSelected(prev => ({ ...prev, class_name: value }))}
                options={classDropdown}
                placeholder="Select class"
              />
              <SelectField
                label="Section"
                value={selected?.section}
                onChange={(value) => setSelected(prev => ({ ...prev, section: value }))}
                options={sectionDropdown}
                placeholder="Select section"
              />
              <SelectField
                label="Assign Teacher"
                value={selected?.teacher_id}
                onChange={(value) => setTeacherOnForm(value, setSelected)}
                options={teacherDropdown}
                placeholder="Select teacher"
              />

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.editBtn} onPress={updateStudent} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.editBtnText}>Save Changes</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={deleteStudent} disabled={saving}>
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Student</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.editHint}>Add the student once, then connect them to their teacher so the portal stays meaningful.</Text>
              {[
                ['Full Name *', 'full_name', 'default'],
                ['Father Name', 'father_name', 'default'],
                ['Roll Number', 'roll_number', 'default'],
                ['Phone', 'phone', 'phone-pad'],
                ['Email', 'email', 'email-address'],
              ].map(([label, key, keyboardType]) => (
                <View key={key}>
                  <Text style={styles.formLabel}>{label}</Text>
                  <TextInput
                    style={styles.formInput}
                    value={form[key]}
                    onChangeText={(value) => setForm(prev => ({ ...prev, [key]: value }))}
                    placeholder={label.replace(' *', '')}
                    placeholderTextColor={colors.textMuted}
                    keyboardType={keyboardType}
                    autoCapitalize={key === 'email' ? 'none' : 'words'}
                  />
                </View>
              ))}

              <SelectField
                label="Class"
                value={form.class_name}
                onChange={(value) => setForm(prev => ({ ...prev, class_name: value }))}
                options={classDropdown}
                placeholder="Select class"
              />
              <SelectField
                label="Section"
                value={form.section}
                onChange={(value) => setForm(prev => ({ ...prev, section: value }))}
                options={sectionDropdown}
                placeholder="Select section"
              />
              <SelectField
                label="Assign Teacher"
                value={form.teacher_id}
                onChange={(value) => setTeacherOnForm(value, setForm)}
                options={teacherDropdown}
                placeholder="Select teacher"
              />

              <TouchableOpacity style={styles.saveBtn} onPress={addStudent} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Add Student</Text>}
              </TouchableOpacity>
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.sm },
  back: { color: colors.primary, fontSize: 16, marginRight: spacing.md },
  title: { flex: 1, color: colors.text, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  addBtn: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  helperText: { color: colors.textMuted, fontSize: 13, lineHeight: 19, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  search: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    color: colors.text,
    fontSize: 14,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  avatarText: { fontSize: 20, fontWeight: 'bold' },
  info: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  subMuted: { color: colors.warning, fontSize: 12, marginTop: 2, fontWeight: '600' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    maxHeight: '92%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: 'bold', flex: 1 },
  modalClose: { color: colors.textMuted, fontSize: 20, paddingLeft: 12 },
  editHint: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 6 },
  formLabel: { color: colors.textMuted, fontSize: 13, marginBottom: 6, marginTop: 14 },
  formInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    color: colors.text,
    fontSize: 14,
  },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: spacing.lg },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: spacing.lg },
  editBtn: { flex: 1, backgroundColor: colors.success, borderRadius: 12, padding: 14, alignItems: 'center' },
  editBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  deleteBtn: { flex: 1, backgroundColor: colors.error, borderRadius: 12, padding: 14, alignItems: 'center' },
  deleteBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
