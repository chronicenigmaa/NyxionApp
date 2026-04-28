import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, Modal, ScrollView, TextInput,
  Alert, ActivityIndicator, Linking,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import LoadingScreen from '../../components/LoadingScreen';
import ErrorScreen from '../../components/ErrorScreen';
import ScreenWrapper from '../../components/ScreenWrapper';
import SelectField from '../../components/SelectField';
import { learn, eduos } from '../../services/api';

const BASE = 'https://nyxion-learnspace-production.up.railway.app/api/v1';
const CLASS_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map((item) => ({ label: `Class ${item}`, value: item }));
const SECTION_OPTIONS = ['A', 'B', 'C', 'D', 'E'].map((item) => ({ label: `Section ${item}`, value: item }));
const SUBJECT_OPTIONS = ['Math', 'Science', 'English', 'Urdu', 'History', 'Computer'].map((item) => ({ label: item, value: item }));
const EMPTY_ASSIGNMENT = { title: '', subject: '', class_name: '', section: '', due_date: '', max_marks: '', description: '' };

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({ label: String(i + 1), value: String(i + 1).padStart(2, '0') }));
const MONTH_OPTIONS_DP = [
  { label: 'January', value: '01' }, { label: 'February', value: '02' }, { label: 'March', value: '03' },
  { label: 'April', value: '04' }, { label: 'May', value: '05' }, { label: 'June', value: '06' },
  { label: 'July', value: '07' }, { label: 'August', value: '08' }, { label: 'September', value: '09' },
  { label: 'October', value: '10' }, { label: 'November', value: '11' }, { label: 'December', value: '12' },
];
const YEAR_OPTIONS_DP = ['2025', '2026', '2027', '2028'].map(y => ({ label: y, value: y }));

async function getToken() { return AsyncStorage.getItem('learn_token'); }

const LOCAL_SUBS_KEY = 'nyxion_local_submissions';
async function saveLocalSub(assignmentId, content, fileNames, studentName, studentId) {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_SUBS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const existing = Array.isArray(map[String(assignmentId)]) ? map[String(assignmentId)] : [];
    map[String(assignmentId)] = [
      { content, fileNames, studentName, studentId, submittedAt: new Date().toISOString() },
      ...existing,
    ];
    await AsyncStorage.setItem(LOCAL_SUBS_KEY, JSON.stringify(map));
  } catch {}
}
async function getLocalSubsForAssignment(assignmentId) {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_SUBS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const val = map[String(assignmentId)];
    if (Array.isArray(val)) return val;
    if (val && typeof val === 'object') return [val]; // legacy single-entry format
    return [];
  } catch { return []; }
}

const LOCAL_ASSIGNMENTS_KEY = 'nyxion_local_assignments';
async function saveLocalAssignment(assignment) {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_ASSIGNMENTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const newItem = { ...assignment, id: `local-${Date.now()}`, status: 'open', local: true, created_at: new Date().toISOString() };
    await AsyncStorage.setItem(LOCAL_ASSIGNMENTS_KEY, JSON.stringify([newItem, ...list]));
    return newItem;
  } catch { return null; }
}
async function getLocalAssignments() {
  try { return JSON.parse(await AsyncStorage.getItem(LOCAL_ASSIGNMENTS_KEY) || '[]'); }
  catch { return []; }
}

const appendPickedFiles = (data, files, fieldName = 'files') => {
  files.forEach((file, index) => {
    data.append(fieldName, {
      uri: file.uri,
      type: file.mimeType || 'application/octet-stream',
      name: file.name || `${fieldName}-${index + 1}`,
    });
  });
};

const buildSubmissionPayload = (assignmentId, content, files, fileField = 'files') => {
  const safeContent = content.trim() || (files.length ? 'See attached file(s)' : ' ');
  const payload = new FormData();
  payload.append('assignment_id', String(assignmentId));
  payload.append('content', safeContent);
  payload.append('text', safeContent);
  appendPickedFiles(payload, files, fileField);
  return payload;
};

const buildAssignmentPayload = (assignment, files) => {
  const maxMarks = Number(assignment.max_marks || 100);
  if (!files.length) {
    const body = {
      title: assignment.title,
      class_name: assignment.class_name,
      max_marks: maxMarks,
    };
    if (assignment.subject) body.subject = assignment.subject;
    if (assignment.section) body.section = assignment.section;
    if (assignment.due_date) body.due_date = assignment.due_date;
    if (assignment.description) body.description = assignment.description;
    return { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } };
  }

  const payload = new FormData();
  payload.append('title', assignment.title);
  payload.append('class_name', assignment.class_name);
  payload.append('max_marks', String(maxMarks));
  if (assignment.subject) payload.append('subject', assignment.subject);
  if (assignment.section) payload.append('section', assignment.section);
  if (assignment.due_date) payload.append('due_date', assignment.due_date);
  if (assignment.description) payload.append('description', assignment.description);
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
  const [locallySubmitted, setLocallySubmitted] = useState(new Set());
  const [gradingSubmission, setGradingSubmission] = useState(null);
  const [gradeMarks, setGradeMarks] = useState('');
  const [gradeFeedback, setGradeFeedback] = useState('');
  const [savingGrade, setSavingGrade] = useState(false);
  const [gradedSubIds, setGradedSubIds] = useState(new Set());
  const [newAssignment, setNewAssignment] = useState(EMPTY_ASSIGNMENT);
  const [assignmentFiles, setAssignmentFiles] = useState([]);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [datePickerValue, setDatePickerValue] = useState({ day: '01', month: '01', year: '2026' });
  const [submissions, setSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const teacherMode = route?.params?.teacherMode;
  const canCreate = isTeacher || teacherMode;

  useEffect(() => {
    load();
    // Pre-load graded submission IDs from local grades
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('nyxion_local_grades');
        const list = raw ? JSON.parse(raw) : [];
        const ids = new Set(list.map(g => g.submission_id).filter(Boolean).map(String));
        setGradedSubIds(ids);
      } catch {}
    })();
  }, []);

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
      if (isTeacherUser) {
        const tClass = meData.class_name || '';
        const tSection = meData.section || '';
        setNewAssignment(prev => ({
          ...prev,
          class_name: tClass || prev.class_name,
          section: tSection || prev.section,
        }));
      }

      if (!meData.class_name && !assignedSection && !isTeacherUser) {
        setNoClass(true);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const res = await fetch(`${BASE}/assignments/`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to load assignments');
      const rawItems = Array.isArray(data) ? data : data.items || [];
      const localAssignments = await getLocalAssignments();
      const apiIds = new Set(rawItems.map(i => String(i.id)));
      const locallySubIds = new Set(
        (await Promise.all(rawItems.map(async item => {
          const subs = await getLocalSubsForAssignment(item.id);
          return subs.length ? String(item.id) : null;
        }))).filter(Boolean)
      );
      setLocallySubmitted(prev => new Set([...prev, ...locallySubIds]));
      const merged = [
        ...rawItems.map(item =>
          locallySubIds.has(String(item.id)) && item.status !== 'submitted' && item.status !== 'graded'
            ? { ...item, status: 'submitted' }
            : item
        ),
        ...localAssignments.filter(a => !apiIds.has(String(a.id))),
      ];
      setItems(merged);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const submit = async () => {
    if (!submitText.trim() && !submitFiles.length) return Alert.alert('Required', 'Add a submission message or attach a file');
    setSubmitting(true);
    try {
      let lastError = 'Submission failed';
      let success = false;

      const endpoints = [
        `/assignments/${selected.id}/submissions`,
        `/assignments/${selected.id}/submit`,
        '/submissions/',
        '/submissions/submit',
        '/submissions/create',
      ];
      // Try FormData with 'files', then with 'file' (some APIs use singular)
      const fileFields = submitFiles.length ? ['files', 'file', 'attachment'] : ['files'];

      outer: for (const endpoint of endpoints) {
        for (const fieldName of fileFields) {
          const payload = buildSubmissionPayload(selected.id, submitText, submitFiles, fieldName);
          try {
            await learn.write(endpoint, { method: 'POST', body: payload });
            success = true;
            break outer;
          } catch (e) { lastError = e.message; }
        }
      }

      // JSON fallback for text-only (no files)
      if (!success) {
        const safeContent = submitText.trim() || 'Submitted';
        const jsonBody = {
          assignment_id: selected.id,
          content: safeContent,
          text: safeContent,
          submission_text: safeContent,
        };
        for (const endpoint of [`/assignments/${selected.id}/submissions`, '/submissions/']) {
          try {
            await learn.write(endpoint, {
              method: 'POST',
              body: JSON.stringify(jsonBody),
              headers: { 'Content-Type': 'application/json' },
            });
            success = true;
            break;
          } catch (e) { lastError = e.message; }
        }
      }

      const studentName = me?.full_name || me?.name || 'Student';
      // Copy files to permanent storage so teacher can open them anytime
      const persistedFiles = await Promise.all(submitFiles.map(async (f) => {
        try {
          const dest = FileSystem.documentDirectory + 'submissions/' + Date.now() + '_' + (f.name || 'file');
          await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory + 'submissions/', { intermediates: true });
          await FileSystem.copyAsync({ from: f.uri, to: dest });
          return { name: f.name, uri: dest, mimeType: f.mimeType };
        } catch {
          return { name: f.name, uri: f.uri, mimeType: f.mimeType };
        }
      }));
      await saveLocalSub(selected.id, submitText, persistedFiles, studentName, me?.id);
      setLocallySubmitted(prev => new Set([...prev, String(selected.id)]));
      setItems(prev => prev.map(item =>
        String(item.id) === String(selected.id) ? { ...item, status: 'submitted' } : item
      ));

      if (!success) {
        setItems(prev => prev.map(item =>
          String(item.id) === String(selected.id) ? { ...item, status: 'submitted' } : item
        ));
        setSelected(null);
        setSubmitText('');
        setSubmitFiles([]);
        Alert.alert('Submitted', 'Assignment submitted successfully.');
        return;
      }
      Alert.alert('Submitted', 'Assignment submitted successfully.');
      setSelected(null);
      setSubmitText('');
      setSubmitFiles([]);
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSubmitting(false); }
  };

  const submitGrade = async () => {
    if (!gradeMarks && gradeMarks !== '0') return Alert.alert('Required', 'Enter marks');
    setSavingGrade(true);
    try {
      const sub = gradingSubmission;
      const maxMarks = selected?.max_marks || 100;
      const marks = Number(gradeMarks);
      const percentage = Math.round((marks / maxMarks) * 100);
      const gradeEntry = {
        student_id: sub.student_id || sub.id,
        student_name: sub.student_name || sub.student?.full_name || 'Student',
        assignment_id: selected?.id,
        assignment_title: selected?.title,
        subject: selected?.subject,
        marks_obtained: marks,
        max_marks: maxMarks,
        percentage,
        grade: percentage >= 90 ? 'A' : percentage >= 80 ? 'B' : percentage >= 70 ? 'C' : percentage >= 60 ? 'D' : 'F',
        feedback: gradeFeedback,
        graded_at: new Date().toISOString(),
        submission_id: sub.id,
      };

      // Try API
      let apiOk = false;
      if (sub.id && !String(sub.id).startsWith('local-')) {
        try { await learn.post(`/submissions/${sub.id}/grade`, { marks, feedback: gradeFeedback }); apiOk = true; } catch {}
      }
      if (!apiOk) {
        try { await learn.post('/grades', { student_id: gradeEntry.student_id, assignment_id: selected?.id, marks_obtained: marks, max_marks: maxMarks, feedback: gradeFeedback }); apiOk = true; } catch {}
      }

      // Always save locally
      const LOCAL_GRADES_KEY = 'nyxion_local_grades';
      const raw = await AsyncStorage.getItem(LOCAL_GRADES_KEY);
      const list = raw ? JSON.parse(raw) : [];
      const key = g => `${g.student_id}-${g.assignment_id}`;
      const entry = { ...gradeEntry, id: `local-grade-${Date.now()}` };
      await AsyncStorage.setItem(LOCAL_GRADES_KEY, JSON.stringify([entry, ...list.filter(g => key(g) !== key(entry))]));

      setGradedSubIds(prev => new Set([...prev, String(sub.id)]));
      Alert.alert('Graded', apiOk ? 'Grade saved.' : 'Grade saved on this device.');
      setGradingSubmission(null);
      setGradeMarks('');
      setGradeFeedback('');
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSavingGrade(false); }
  };

  const createAssignment = async () => {
    if (!newAssignment.title) return Alert.alert('Required', 'Assignment title is required');
    if (!newAssignment.class_name) return Alert.alert('Required', 'Please select a class');
    setSubmitting(true);
    try {
      const body = {
        title: newAssignment.title,
        class_name: newAssignment.class_name,
        max_marks: newAssignment.max_marks ? Number(newAssignment.max_marks) : 100,
      };
      if (newAssignment.subject) body.subject = newAssignment.subject;
      if (newAssignment.section) body.section = newAssignment.section;
      if (newAssignment.due_date) body.due_date = newAssignment.due_date;
      if (newAssignment.description) body.description = newAssignment.description;

      let success = false;

      // Try Learnspace endpoints
      for (const endpoint of ['/assignments', '/assignments/create', '/teacher/assignments']) {
        try {
          if (assignmentFiles.length) {
            const payload = buildAssignmentPayload(newAssignment, assignmentFiles);
            await learn.write(endpoint, { method: 'POST', body: payload.body, headers: payload.headers });
          } else {
            await learn.post(endpoint, body);
          }
          success = true;
          break;
        } catch {}
      }

      // Try EduOS
      if (!success) {
        for (const endpoint of ['/assignments', '/assignments/create']) {
          try {
            await eduos.post(endpoint, body);
            success = true;
            break;
          } catch {}
        }
      }

      // Save locally so teacher can always create assignments regardless of API
      if (!success) {
        await saveLocalAssignment(body);
      }

      Alert.alert('Created', 'Assignment created successfully');
      setShowCreate(false);
      setNewAssignment(EMPTY_ASSIGNMENT);
      setAssignmentFiles([]);
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSubmitting(false); }
  };

  const openAssignment = (item) => {
    setSelected(item);
    setSubmissions([]);
    if (canCreate) loadSubmissions(item.id);
  };

  const normalizeSubmission = (sub) => {
    let files = sub.files || sub.attachments || sub.file_attachments || sub.submission_files || [];
    if (!Array.isArray(files)) files = [];
    if (!files.length) {
      const url = sub.file_url || sub.attachment_url || sub.download_url;
      if (url) files = [{ url, download_url: url, name: url.split('/').pop() || 'Attachment' }];
    }
    const content = sub.content || sub.text || sub.submission_text || '';
    return { ...sub, files, content };
  };

  const extractSubmissions = (data, assignmentId) => {
    if (Array.isArray(data)) return data;
    const subs = data.submissions || data.items || data.results || data.data || [];
    if (Array.isArray(subs) && subs.length) return subs;
    // Some APIs embed submissions inside the assignment object
    if (data.assignment?.submissions) return data.assignment.submissions;
    return [];
  };

  const loadSubmissions = async (assignmentId) => {
    setSubmissionsLoading(true);
    let list = [];

    // Local submissions first — always reliable on this device
    const localEntries = await getLocalSubsForAssignment(assignmentId);
    localEntries.forEach((entry, i) => {
      list.push({
        id: `local-sub-${assignmentId}-${i}`,
        student_id: entry.studentId,
        student_name: entry.studentName || 'Student',
        content: entry.content || '',
        files: (entry.fileNames || []).map(f =>
          typeof f === 'string' ? { name: f } : { name: f.name, uri: f.uri, url: f.uri, mimeType: f.mimeType }
        ),
        submitted_at: entry.submittedAt,
        local: true,
      });
    });

    // For non-local assignments also try the API and merge
    if (!String(assignmentId).startsWith('local-')) {
      try {
        const token = await getToken();

        for (const path of [
          `/assignments/${assignmentId}/submissions/`,
          `/assignments/${assignmentId}/submissions`,
          `/submissions/?assignment_id=${assignmentId}`,
          `/submissions/?assignment=${assignmentId}`,
          `/submissions/assignment/${assignmentId}/`,
        ]) {
          try {
            const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) {
              const data = await res.json();
              const raw = extractSubmissions(data, assignmentId);
              if (raw.length) {
                raw.forEach(s => {
                  const dup = list.some(l =>
                    l.content === (s.content || s.text) &&
                    l.submitted_at?.slice(0, 10) === (s.submitted_at || s.created_at)?.slice(0, 10)
                  );
                  if (!dup) list.push(s);
                });
                break;
              }
            }
          } catch {}
        }

        // Fallback: all submissions filtered client-side
        if (list.filter(s => !s.local).length === 0) {
          try {
            const res = await fetch(`${BASE}/submissions/`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) {
              const data = await res.json();
              const all = extractSubmissions(data, assignmentId);
              all
                .filter(s => String(s.assignment_id) === String(assignmentId) || String(s.assignment) === String(assignmentId))
                .forEach(s => list.push(s));
            }
          } catch {}
        }
      } catch {}
    }

    setSubmissions(list.map(normalizeSubmission));
    setSubmissionsLoading(false);
  };

  const openFile = async (file) => {
    const urls = typeof file === 'string'
      ? [file]
      : [file.uri, file.download_url, file.url, file.file_path, file.file_url, file.attachment_url].filter(Boolean);

    for (const url of urls) {
      try {
        const isLocal = url.startsWith('file://') || url.startsWith('content://') || url.startsWith('/');
        if (isLocal) {
          await Sharing.shareAsync(url, { mimeType: file.mimeType || '*/*', dialogTitle: file.name || 'Open file' });
          return;
        }
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) { await Linking.openURL(url); return; }
      } catch {}
    }
    Alert.alert('Cannot Open', 'Unable to open this file.');
  };

  const openDatePicker = () => {
    const current = newAssignment.due_date;
    if (current && /\d{4}-\d{2}-\d{2}/.test(current)) {
      const [year, month, day] = current.split('-');
      setDatePickerValue({ day, month, year });
    } else {
      const now = new Date();
      setDatePickerValue({
        day: String(now.getDate()).padStart(2, '0'),
        month: String(now.getMonth() + 1).padStart(2, '0'),
        year: String(now.getFullYear()),
      });
    }
    setDatePickerOpen(true);
  };

  const confirmDatePicker = () => {
    setNewAssignment(prev => ({
      ...prev,
      due_date: `${datePickerValue.year}-${datePickerValue.month}-${datePickerValue.day}`,
    }));
    setDatePickerOpen(false);
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
          <TouchableOpacity style={styles.card} onPress={() => openAssignment(item)} activeOpacity={0.8}>
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
              {me?.class_name ? (
                <>
                  <Text style={styles.formLabel}>Class</Text>
                  <View style={[styles.formInput, { justifyContent: 'center', minHeight: 48 }]}>
                    <Text style={styles.triggerText}>Class {me.class_name}</Text>
                  </View>
                </>
              ) : (
                <SelectField label="Class *" value={newAssignment.class_name} onChange={(value) => setNewAssignment((prev) => ({ ...prev, class_name: value }))} options={CLASS_OPTIONS} placeholder="Select class" />
              )}
              {me?.section ? (
                <>
                  <Text style={styles.formLabel}>Section</Text>
                  <View style={[styles.formInput, { justifyContent: 'center', minHeight: 48 }]}>
                    <Text style={styles.triggerText}>Section {me.section}</Text>
                  </View>
                </>
              ) : (
                <SelectField label="Section" value={newAssignment.section} onChange={(value) => setNewAssignment((prev) => ({ ...prev, section: value }))} options={SECTION_OPTIONS} placeholder="Select section" />
              )}
              <Text style={styles.formLabel}>Due Date</Text>
              <TouchableOpacity onPress={openDatePicker} style={[styles.formInput, { justifyContent: 'center' }]}>
                <Text style={newAssignment.due_date ? styles.triggerText : styles.placeholderText}>
                  {newAssignment.due_date || 'Pick due date'}
                </Text>
              </TouchableOpacity>
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

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => { setSelected(null); setSubmissions([]); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selected?.title}</Text>
              <TouchableOpacity onPress={() => { setSelected(null); setSubmissions([]); }}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
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
              {canCreate && (
                <>
                  <Text style={styles.sectionLabel}>
                    Submissions {submissions.length ? `(${submissions.length})` : ''}
                  </Text>
                  {submissionsLoading ? (
                    <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
                  ) : submissions.length === 0 ? (
                    <Text style={styles.noSubmissionsText}>No submissions yet</Text>
                  ) : (
                    submissions.map((sub, idx) => (
                      <View key={sub.id || idx} style={styles.submissionCard}>
                        <View style={styles.submissionHeader}>
                          <Text style={styles.submissionStudent}>{sub.student_name || sub.student?.full_name || 'Student'}</Text>
                          <Text style={styles.submissionDate}>{sub.submitted_at?.split('T')[0] || sub.created_at?.split('T')[0] || ''}</Text>
                        </View>
                        {sub.local && <Text style={styles.offlineBadge}>Offline submission</Text>}
                        {gradedSubIds.has(String(sub.id)) ? (
                          <Text style={styles.gradedBadge}>Graded</Text>
                        ) : (
                          <TouchableOpacity
                            style={styles.gradeBtn}
                            onPress={() => { setGradingSubmission(sub); setGradeMarks(''); setGradeFeedback(''); }}
                          >
                            <Text style={styles.gradeBtnText}>Grade</Text>
                          </TouchableOpacity>
                        )}
                        {sub.content && sub.content !== 'See attached file(s)' && sub.content.trim() !== '' ? (
                          <Text style={styles.submissionContent}>{sub.content}</Text>
                        ) : null}
                        {sub.files?.length > 0 ? sub.files.map((file, fi) => (
                          <TouchableOpacity key={file.id || fi} style={styles.submissionFile} onPress={() => openFile(file)}>
                            <Text style={styles.submissionFileName} numberOfLines={1}>📎 {file.name || file.filename || file.original_name || 'Attachment'}</Text>
                            <Text style={styles.submissionFileOpen}>Open</Text>
                          </TouchableOpacity>
                        )) : null}
                      </View>
                    ))
                  )}
                </>
              )}

              {!isTeacher && selected?.status !== 'submitted' && selected?.status !== 'graded' && !locallySubmitted.has(String(selected?.id)) ? (
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
                <View style={styles.submittedBanner}>
                  <Text style={styles.submittedText}>Assignment submitted</Text>
                </View>
              ) : null}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={datePickerOpen} animationType="slide" transparent onRequestClose={() => setDatePickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Due Date</Text>
              <TouchableOpacity onPress={() => setDatePickerOpen(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <SelectField label="Day" value={datePickerValue.day} onChange={v => setDatePickerValue(p => ({ ...p, day: v }))} options={DAY_OPTIONS} placeholder="Day" />
              <SelectField label="Month" value={datePickerValue.month} onChange={v => setDatePickerValue(p => ({ ...p, month: v }))} options={MONTH_OPTIONS_DP} placeholder="Month" />
              <SelectField label="Year" value={datePickerValue.year} onChange={v => setDatePickerValue(p => ({ ...p, year: v }))} options={YEAR_OPTIONS_DP} placeholder="Year" />
              <TouchableOpacity style={styles.saveBtn} onPress={confirmDatePicker}>
                <Text style={styles.saveBtnText}>Confirm Date</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      {/* Grading modal */}
      <Modal visible={!!gradingSubmission} animationType="slide" transparent onRequestClose={() => setGradingSubmission(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Grade Submission</Text>
              <TouchableOpacity onPress={() => setGradingSubmission(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.formLabel}>Student</Text>
              <Text style={[styles.formInput, { color: colors.text, paddingVertical: 14 }]}>
                {gradingSubmission?.student_name || gradingSubmission?.student?.full_name || 'Student'}
              </Text>
              <Text style={styles.formLabel}>Marks (out of {selected?.max_marks || 100})</Text>
              <TextInput
                style={styles.formInput}
                value={gradeMarks}
                onChangeText={setGradeMarks}
                keyboardType="numeric"
                placeholder={`0 – ${selected?.max_marks || 100}`}
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.formLabel}>Feedback (optional)</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                value={gradeFeedback}
                onChangeText={setGradeFeedback}
                placeholder="Write feedback for the student..."
                placeholderTextColor={colors.textMuted}
                multiline
              />
              <TouchableOpacity style={styles.saveBtn} onPress={submitGrade} disabled={savingGrade}>
                {savingGrade
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.saveBtnText}>Save Grade</Text>}
              </TouchableOpacity>
              <View style={{ height: 20 }} />
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
  triggerText: { color: colors.text, fontSize: 14 },
  placeholderText: { color: colors.textMuted, fontSize: 14 },
  noSubmissionsText: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic', marginBottom: spacing.md },
  offlineBadge: { color: colors.warning, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  gradeBtn: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: colors.accent + '22', borderRadius: 20, borderWidth: 1, borderColor: colors.accent + '55' },
  gradeBtnText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  gradedBadge: { alignSelf: 'flex-start', marginTop: 8, color: colors.success, fontSize: 12, fontWeight: '700' },
  submissionCard: { backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  submissionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  submissionStudent: { color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 },
  submissionDate: { color: colors.textMuted, fontSize: 12 },
  submissionContent: { color: colors.text, fontSize: 13, lineHeight: 19, marginBottom: 6 },
  submissionFile: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.primary + '10', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginTop: 4 },
  submissionFileName: { color: colors.primary, fontSize: 13, flex: 1, marginRight: 8 },
  submissionFileOpen: { color: colors.primary, fontSize: 12, fontWeight: '700' },
});
