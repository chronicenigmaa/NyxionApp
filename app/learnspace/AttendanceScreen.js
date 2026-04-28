import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator, ScrollView, Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import LoadingScreen from '../../components/LoadingScreen';
import ErrorScreen from '../../components/ErrorScreen';
import ScreenWrapper from '../../components/ScreenWrapper';
import SelectField from '../../components/SelectField';
import { getRealAssignedStudentsForTeacher, getAssignedStudentsForTeacher } from '../../services/demoData';

const BASE = 'https://nyxion-learnspace-production.up.railway.app/api/v1';
const EDUOS_BASE = 'https://nyxion-eduos-production-63b9.up.railway.app/api/v1';

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({ label: String(i + 1), value: String(i + 1).padStart(2, '0') }));
const MONTH_OPTIONS = [
  { label: 'January', value: '01' }, { label: 'February', value: '02' }, { label: 'March', value: '03' },
  { label: 'April', value: '04' }, { label: 'May', value: '05' }, { label: 'June', value: '06' },
  { label: 'July', value: '07' }, { label: 'August', value: '08' }, { label: 'September', value: '09' },
  { label: 'October', value: '10' }, { label: 'November', value: '11' }, { label: 'December', value: '12' },
];
const YEAR_OPTIONS = ['2025', '2026', '2027', '2028'].map(v => ({ label: v, value: v }));

function isoToday() {
  return new Date().toISOString().split('T')[0];
}

function parseDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  return { day: d, month: m, year: y };
}

export default function LearnAttendanceScreen({ navigation, route }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [me, setMe] = useState(null);
  const teacherMode = route?.params?.teacherMode;

  // Student view
  const [data, setData] = useState(null);

  // Teacher — mark mode
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');

  // Teacher — view mode
  const [tab, setTab] = useState('mark');       // 'mark' | 'view'
  const [viewRecords, setViewRecords] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);

  // Shared date for teacher
  const [selectedDate, setSelectedDate] = useState(isoToday());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [datePickerValue, setDatePickerValue] = useState(parseDate(isoToday()) || { day: '01', month: '01', year: '2026' });

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (isTeacher && tab === 'view') {
      fetchViewAttendance();
    }
  }, [tab, selectedDate, isTeacher]);

  const load = async () => {
    setError(null);
    try {
      const token = await AsyncStorage.getItem('learn_token');
      const meRes = await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      const meData = await meRes.json();
      const isTeacherUser = meData?.role?.toLowerCase() === 'teacher';
      setIsTeacher(isTeacherUser);
      setMe(meData);

      if (isTeacherUser) {
        await loadStudents(token, meData);
        return;
      }

      const res = await fetch(`${BASE}/attendance/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Failed to load attendance');
      setData(json);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const normalizeStudent = (s) => ({
    ...s,
    id: s.id ?? s.student_id ?? s.roll_number ?? s.email ?? String(Math.random()),
    full_name: s.full_name ?? s.name ?? s.student_name ?? s.username ?? 'Student',
    roll_number: s.roll_number ?? s.roll ?? 'N/A',
  });

  const filterToTeacher = (students, teacher) =>
    students.filter(s => {
      // Any mismatch on available fields → exclude immediately
      if (s.teacher_id && teacher?.id && String(s.teacher_id) !== String(teacher.id)) return false;
      if (s.class_name && teacher?.class_name && s.class_name !== teacher.class_name) return false;
      if (s.section && teacher?.section && s.section !== teacher.section) return false;
      // Require at least one field to positively confirm the student belongs to this teacher
      if (teacher?.id && s.teacher_id && String(s.teacher_id) === String(teacher.id)) return true;
      if (teacher?.class_name && s.class_name && s.class_name === teacher.class_name) return true;
      return false;
    });

  const loadStudents = async (tokenArg, meData) => {
    setStudentsLoading(true);
    try {
      const token = tokenArg || await AsyncStorage.getItem('learn_token');
      const eduToken = await AsyncStorage.getItem('token');
      const authMe = meData || me;
      let list = [];

      // 1. Explicitly saved local assignments — most authoritative, no guessing
      if (authMe) {
        list = await getRealAssignedStudentsForTeacher(authMe);
      }

      // 2. API with teacher-scoped query params (strict filter, no fallback to all)
      if (!list.length) {
        const teacherParams = [
          authMe?.id ? `teacher_id=${authMe.id}` : null,
          authMe?.class_name ? `class_name=${authMe.class_name}` : null,
          authMe?.section ? `section=${authMe.section}` : null,
        ].filter(Boolean).join('&');

        for (const url of [
          teacherParams ? `${BASE}/users/?role=student&${teacherParams}` : null,
          `${BASE}/users/students`,
          `${BASE}/students/`,
          `${BASE}/users/?role=student`,
        ].filter(Boolean)) {
          try {
            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) {
              const json = await res.json();
              const found = Array.isArray(json) ? json : json.items || json.students || json.users || [];
              const filtered = filterToTeacher(found, authMe);
              if (filtered.length) { list = filtered; break; }
            }
          } catch {}
        }
      }

      // 3. EduOS students filtered strictly to this teacher
      if (!list.length && eduToken && authMe) {
        try {
          const res = await fetch(`${EDUOS_BASE}/students/`, { headers: { Authorization: `Bearer ${eduToken}` } });
          if (res.ok) {
            const json = await res.json();
            const all = Array.isArray(json) ? json : json.items || json.students || [];
            list = filterToTeacher(all, authMe);
          }
        } catch {}
      }

      // 4. Demo fallback — only when nothing else worked
      if (!list.length && authMe) {
        list = await getAssignedStudentsForTeacher(authMe);
      }

      const normalized = list.map(normalizeStudent);
      setStudents(normalized);
      const initial = {};
      normalized.forEach(s => { initial[String(s.id)] = true; });
      setAttendance(initial);
    } catch {
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  };

  const fetchViewAttendance = async () => {
    setViewLoading(true);
    try {
      const token = await AsyncStorage.getItem('learn_token');
      let records = [];
      for (const path of [
        `/attendance/?date=${selectedDate}`,
        `/attendance/report?date=${selectedDate}`,
        `/attendance/${selectedDate}`,
      ]) {
        try {
          const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const json = await res.json();
            records = Array.isArray(json) ? json : json.records || json.items || [];
            break;
          }
        } catch {}
      }
      setViewRecords(records);
    } catch {}
    finally { setViewLoading(false); }
  };

  const openDatePicker = () => {
    const parts = parseDate(selectedDate);
    if (parts) setDatePickerValue(parts);
    setDatePickerOpen(true);
  };

  const confirmDate = () => {
    const date = `${datePickerValue.year}-${datePickerValue.month}-${datePickerValue.day}`;
    setSelectedDate(date);
    setDatePickerOpen(false);
  };

  const toggleAttendance = (studentId) => {
    setAttendance(prev => ({ ...prev, [String(studentId)]: !prev[String(studentId)] }));
  };

  const markAll = (present) => {
    setAttendance(prev => {
      const next = { ...prev };
      // Only mark/unmark students currently visible (respects active filter)
      const visible = students.filter(s => {
        if (filterClass && s.class_name && s.class_name !== filterClass) return false;
        if (filterSection && s.section && s.section !== filterSection) return false;
        return true;
      });
      visible.forEach(s => { next[String(s.id)] = present; });
      return next;
    });
  };

  const submitAttendance = async () => {
    const visible = students.filter(s => {
      if (filterClass && s.class_name && s.class_name !== filterClass) return false;
      if (filterSection && s.section && s.section !== filterSection) return false;
      return true;
    });
    if (!visible.length) return Alert.alert('No Students', 'No students found to mark attendance for.');
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('learn_token');
      const records = visible.map(s => ({
        student_id: s.id,
        is_present: attendance[String(s.id)] !== false,
        date: selectedDate,
      }));

      let success = false;
      let lastError = 'Attendance submission failed. Please try again.';
      for (const endpoint of ['/attendance/mark', '/attendance/bulk', '/attendance/']) {
        try {
          const res = await fetch(`${BASE}${endpoint}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ records, date: selectedDate }),
          });
          if (res.ok) { success = true; break; }
          const err = await res.json().catch(() => ({}));
          lastError = err.detail || `HTTP ${res.status}`;
        } catch (e) { lastError = e.message; }
      }

      if (!success) throw new Error(lastError);
      const presentCount = records.filter(r => r.is_present).length;
      Alert.alert('Submitted', `${presentCount} present, ${records.length - presentCount} absent on ${selectedDate}.`);
      if (tab === 'view') fetchViewAttendance();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSubmitting(false); }
  };

  if (loading) return <LoadingScreen message="Loading attendance..." />;
  if (error) return <ErrorScreen message={error} onRetry={load} />;

  // ── TEACHER MODE ──────────────────────────────────────────────
  if (isTeacher) {
    const filteredStudents = students.filter(s => {
      if (filterClass && s.class_name && s.class_name !== filterClass) return false;
      if (filterSection && s.section && s.section !== filterSection) return false;
      return true;
    });
    const presentCount = filteredStudents.filter(s => attendance[String(s.id)] !== false).length;
    const availableClasses = [...new Set(students.map(s => s.class_name).filter(Boolean))].sort();
    const availableSections = [...new Set(students.map(s => s.section).filter(Boolean))].sort();

    return (
      <ScreenWrapper>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Attendance</Text>
        </View>

        {/* Date row */}
        <TouchableOpacity style={styles.dateBanner} onPress={openDatePicker} activeOpacity={0.7}>
          <Text style={styles.dateLabel}>Date</Text>
          <Text style={styles.dateValue}>{selectedDate}</Text>
          <Text style={styles.dateEdit}>Change ▾</Text>
        </TouchableOpacity>

        {/* Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'mark' && styles.tabBtnActive]}
            onPress={() => setTab('mark')}
          >
            <Text style={[styles.tabText, tab === 'mark' && styles.tabTextActive]}>Mark Attendance</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'view' && styles.tabBtnActive]}
            onPress={() => setTab('view')}
          >
            <Text style={[styles.tabText, tab === 'view' && styles.tabTextActive]}>View Records</Text>
          </TouchableOpacity>
        </View>

        {/* Filter bar */}
        {tab === 'mark' && (availableClasses.length > 1 || availableSections.length > 1) && (
          <View style={styles.filterRow}>
            {availableClasses.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                <TouchableOpacity
                  style={[styles.filterChip, !filterClass && styles.filterChipActive]}
                  onPress={() => setFilterClass('')}
                >
                  <Text style={[styles.filterChipText, !filterClass && styles.filterChipTextActive]}>All Classes</Text>
                </TouchableOpacity>
                {availableClasses.map(cls => (
                  <TouchableOpacity
                    key={cls}
                    style={[styles.filterChip, filterClass === cls && styles.filterChipActive]}
                    onPress={() => setFilterClass(prev => prev === cls ? '' : cls)}
                  >
                    <Text style={[styles.filterChipText, filterClass === cls && styles.filterChipTextActive]}>Class {cls}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {availableSections.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                <TouchableOpacity
                  style={[styles.filterChip, !filterSection && styles.filterChipActive]}
                  onPress={() => setFilterSection('')}
                >
                  <Text style={[styles.filterChipText, !filterSection && styles.filterChipTextActive]}>All Sections</Text>
                </TouchableOpacity>
                {availableSections.map(sec => (
                  <TouchableOpacity
                    key={sec}
                    style={[styles.filterChip, filterSection === sec && styles.filterChipActive]}
                    onPress={() => setFilterSection(prev => prev === sec ? '' : sec)}
                  >
                    <Text style={[styles.filterChipText, filterSection === sec && styles.filterChipTextActive]}>Section {sec}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {tab === 'mark' ? (
          <>
            {/* Stats + bulk buttons */}
            <View style={styles.statsRow}>
              <View style={[styles.miniStat, { borderColor: colors.success + '55' }]}>
                <Text style={[styles.miniVal, { color: colors.success }]}>{presentCount}</Text>
                <Text style={styles.miniLbl}>Present</Text>
              </View>
              <View style={[styles.miniStat, { borderColor: colors.error + '55' }]}>
                <Text style={[styles.miniVal, { color: colors.error }]}>{filteredStudents.length - presentCount}</Text>
                <Text style={styles.miniLbl}>Absent</Text>
              </View>
              <View style={[styles.miniStat, { borderColor: colors.primary + '55' }]}>
                <Text style={[styles.miniVal, { color: colors.primary }]}>{filteredStudents.length}</Text>
                <Text style={styles.miniLbl}>Total</Text>
              </View>
            </View>

            <View style={styles.bulkRow}>
              <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: colors.success + '15', borderColor: colors.success + '40' }]} onPress={() => markAll(true)}>
                <Text style={[styles.bulkBtnText, { color: colors.success }]}>All Present</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: colors.error + '15', borderColor: colors.error + '40' }]} onPress={() => markAll(false)}>
                <Text style={[styles.bulkBtnText, { color: colors.error }]}>All Absent</Text>
              </TouchableOpacity>
            </View>

            {studentsLoading ? (
              <View style={styles.centerBox}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={styles.loaderText}>Loading students...</Text>
              </View>
            ) : (
              <FlatList
                data={filteredStudents}
                keyExtractor={item => String(item.id)}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadStudents(null, me).finally(() => setRefreshing(false)); }} tintColor={colors.primary} />}
                renderItem={({ item }) => {
                  const present = attendance[String(item.id)] !== false;
                  return (
                    <TouchableOpacity style={styles.card} onPress={() => toggleAttendance(item.id)} activeOpacity={0.8}>
                      <View style={[styles.statusBar, { backgroundColor: present ? colors.success : colors.error }]} />
                      <View style={[styles.avatar, { backgroundColor: (present ? colors.success : colors.error) + '15' }]}>
                        <Text style={[styles.avatarText, { color: present ? colors.success : colors.error }]}>
                          {item.full_name?.[0]?.toUpperCase() || '?'}
                        </Text>
                      </View>
                      <View style={styles.info}>
                        <Text style={styles.studentName}>{item.full_name}</Text>
                        <Text style={styles.sub}>Roll: {item.roll_number || 'N/A'}{item.class_name ? ` · Class ${item.class_name}` : ''}</Text>
                      </View>
                      <View style={[styles.toggleBtn, { backgroundColor: present ? colors.success : colors.error }]}>
                        <Text style={styles.toggleText}>{present ? 'P' : 'A'}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Text style={styles.emptyEmoji}>👩‍🏫</Text>
                    <Text style={styles.emptyText}>No students found{'\n'}Students assigned to you will appear here</Text>
                  </View>
                }
              />
            )}

            {filteredStudents.length > 0 && (
              <TouchableOpacity style={styles.submitBtn} onPress={submitAttendance} disabled={submitting}>
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.submitBtnText}>Submit Attendance for {selectedDate}</Text>}
              </TouchableOpacity>
            )}
          </>
        ) : (
          // View mode
          viewLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.loaderText}>Loading records...</Text>
            </View>
          ) : (
            <FlatList
              data={viewRecords}
              keyExtractor={(item, i) => `${item.student_id || item.id || i}`}
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={viewLoading} onRefresh={fetchViewAttendance} tintColor={colors.primary} />}
              renderItem={({ item }) => {
                const present = item.is_present ?? item.status === 'present';
                return (
                  <View style={styles.card}>
                    <View style={[styles.statusBar, { backgroundColor: present ? colors.success : colors.error }]} />
                    <View style={styles.info}>
                      <Text style={styles.studentName}>{item.student_name || item.full_name || 'Student'}</Text>
                      <Text style={styles.sub}>Roll: {item.roll_number || 'N/A'}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: (present ? colors.success : colors.error) + '22' }]}>
                      <Text style={{ color: present ? colors.success : colors.error, fontSize: 12, fontWeight: '700' }}>
                        {present ? 'PRESENT' : 'ABSENT'}
                      </Text>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyEmoji}>📋</Text>
                  <Text style={styles.emptyText}>No records for {selectedDate}{'\n'}Mark attendance first or select a different date</Text>
                </View>
              }
            />
          )
        )}

        {/* Date Picker Modal */}
        <Modal visible={datePickerOpen} animationType="slide" transparent onRequestClose={() => setDatePickerOpen(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Date</Text>
                <TouchableOpacity onPress={() => setDatePickerOpen(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
                <SelectField label="Day" value={datePickerValue.day} onChange={v => setDatePickerValue(p => ({ ...p, day: v }))} options={DAY_OPTIONS} placeholder="Day" />
                <SelectField label="Month" value={datePickerValue.month} onChange={v => setDatePickerValue(p => ({ ...p, month: v }))} options={MONTH_OPTIONS} placeholder="Month" />
                <SelectField label="Year" value={datePickerValue.year} onChange={v => setDatePickerValue(p => ({ ...p, year: v }))} options={YEAR_OPTIONS} placeholder="Year" />
                <TouchableOpacity style={styles.saveBtn} onPress={confirmDate}>
                  <Text style={styles.saveBtnText}>Confirm Date</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </ScreenWrapper>
    );
  }

  // ── STUDENT MODE ──────────────────────────────────────────────
  const records = data?.records || [];
  const pct = data?.percentage ?? 0;

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Attendance</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.miniStat, { borderColor: (pct >= 75 ? colors.success : colors.error) + '55' }]}>
          <Text style={[styles.miniVal, { color: pct >= 75 ? colors.success : colors.error }]}>{pct}%</Text>
          <Text style={styles.miniLbl}>Rate</Text>
        </View>
        <View style={[styles.miniStat, { borderColor: colors.success + '55' }]}>
          <Text style={[styles.miniVal, { color: colors.success }]}>{data?.present ?? 0}</Text>
          <Text style={styles.miniLbl}>Present</Text>
        </View>
        <View style={[styles.miniStat, { borderColor: colors.error + '55' }]}>
          <Text style={[styles.miniVal, { color: colors.error }]}>{data?.absent ?? 0}</Text>
          <Text style={styles.miniLbl}>Absent</Text>
        </View>
        <View style={[styles.miniStat, { borderColor: colors.primary + '55' }]}>
          <Text style={[styles.miniVal, { color: colors.primary }]}>{data?.total ?? 0}</Text>
          <Text style={styles.miniLbl}>Total</Text>
        </View>
      </View>

      <FlatList
        data={records}
        keyExtractor={(item, idx) => `${item.date}-${idx}`}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={[styles.statusBar, { backgroundColor: item.is_present ? colors.success : colors.error }]} />
            <View style={styles.info}>
              <Text style={styles.studentName}>{item.date}</Text>
              {item.subject ? <Text style={styles.sub}>{item.subject}</Text> : null}
            </View>
            <View style={[styles.badge, { backgroundColor: (item.is_present ? colors.success : colors.error) + '22' }]}>
              <Text style={{ color: item.is_present ? colors.success : colors.error, fontSize: 12, fontWeight: '700' }}>
                {item.is_present ? 'PRESENT' : 'ABSENT'}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyText}>No attendance records yet{'\n'}Your teacher hasn't marked attendance</Text>
          </View>
        }
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { color: colors.accent, fontSize: 16, marginRight: spacing.md },
  title: { flex: 1, color: colors.text, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  dateBanner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  dateLabel: { color: colors.textMuted, fontSize: 13, marginRight: 8 },
  dateValue: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  dateEdit: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  tabRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: 8 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center' },
  tabBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  statsRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: 8, paddingVertical: spacing.sm },
  miniStat: { flex: 1, backgroundColor: colors.surface, borderRadius: 10, padding: spacing.sm, alignItems: 'center', borderWidth: 1 },
  miniVal: { fontSize: 20, fontWeight: 'bold' },
  miniLbl: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  bulkRow: { flexDirection: 'row', gap: 10, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  bulkBtn: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
  bulkBtnText: { fontSize: 13, fontWeight: '700' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  statusBar: { width: 4, alignSelf: 'stretch' },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', margin: spacing.sm },
  avatarText: { fontSize: 16, fontWeight: 'bold' },
  info: { flex: 1, paddingVertical: spacing.sm },
  studentName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginRight: spacing.md },
  filterRow: { paddingHorizontal: spacing.lg, paddingVertical: 6, gap: 6 },
  filterScroll: { flexGrow: 0 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginRight: 6 },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  toggleBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', margin: spacing.sm },
  toggleText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  submitBtn: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg, backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  loaderText: { color: colors.textMuted, fontSize: 14, marginTop: 12 },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: spacing.lg },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 24 },
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: 'bold', flex: 1 },
  modalClose: { color: colors.textMuted, fontSize: 20, paddingLeft: 12 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: spacing.lg },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
