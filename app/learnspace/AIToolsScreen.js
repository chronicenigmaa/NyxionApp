import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { learn } from '../../services/api';
import { colors, spacing, fonts } from '../../constants/theme';

const TEACHER_TOOLS = [
  { key: 'exam',      label: 'Exam Generator',    icon: 'document-text-outline',  color: '#6366f1' },
  { key: 'homework',  label: 'Homework Generator', icon: 'pencil-outline',         color: '#8b5cf6' },
  { key: 'lesson',    label: 'Lesson Planner',     icon: 'calendar-outline',       color: '#0ea5e9' },
  { key: 'plagiarism',label: 'Plagiarism Check',   icon: 'search-outline',         color: '#f59e0b' },
  { key: 'feedback',  label: 'Feedback Writer',    icon: 'chatbubble-outline',     color: '#10b981' },
  { key: 'rubric',    label: 'Rubric Generator',   icon: 'list-outline',           color: '#ec4899' },
];

const STUDENT_TOOLS = [
  { key: 'summarise', label: 'Notes Summariser',   icon: 'reader-outline',         color: '#6366f1' },
  { key: 'flashcards',label: 'Flashcards',         icon: 'layers-outline',         color: '#10b981' },
  { key: 'studyplan', label: 'Study Plan',         icon: 'time-outline',           color: '#f59e0b' },
  { key: 'chatbot',   label: 'Ask AI',             icon: 'sparkles-outline',       color: '#8b5cf6' },
];

export default function LearnAIToolsScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [form, setForm] = useState({
    subject: '', class_name: '', topic: '', num_questions: '10',
    difficulty: 'medium', question_type: 'mixed',
    assignment_title: '', submission_text: '', marks_obtained: '', max_marks: '',
    description: '', text: '', num_cards: '10',
    upcoming_exams: '', upcoming_assignments: '', days_available: '7',
    chatMessage: '',
  });

  React.useEffect(() => {
    AsyncStorage.getItem('learn_user').then(raw => {
      if (raw) try { setUser(JSON.parse(raw)); } catch {}
    });
  }, []);

  const isTeacher = user?.role === 'teacher' || user?.role === 'school_admin' || user?.role === 'super_admin';
  const tools = isTeacher ? [...TEACHER_TOOLS, ...STUDENT_TOOLS] : STUDENT_TOOLS;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function run() {
    setLoading(true);
    setResult('');
    try {
      let endpoint = '';
      let payload = {};

      if (activeTool === 'exam') {
        endpoint = '/ai/exam-generator';
        payload = { subject: form.subject, class_name: form.class_name, topic: form.topic, num_questions: parseInt(form.num_questions) || 10, difficulty: form.difficulty, question_type: form.question_type };
      } else if (activeTool === 'homework') {
        endpoint = '/ai/homework-generator';
        payload = { subject: form.subject, class_name: form.class_name, topic: form.topic, num_questions: parseInt(form.num_questions) || 5, difficulty: form.difficulty };
      } else if (activeTool === 'lesson') {
        endpoint = '/ai/lesson-planner';
        payload = { subject: form.subject, class_name: form.class_name, topic: form.topic, duration_minutes: 45 };
      } else if (activeTool === 'plagiarism') {
        endpoint = '/ai/plagiarism-check';
        payload = { text: form.submission_text, assignment_title: form.assignment_title };
      } else if (activeTool === 'feedback') {
        endpoint = '/ai/feedback-writer';
        payload = { subject: form.subject, submission_text: form.submission_text, marks_obtained: parseFloat(form.marks_obtained) || 0, max_marks: parseFloat(form.max_marks) || 100, assignment_title: form.assignment_title };
      } else if (activeTool === 'rubric') {
        endpoint = '/ai/rubric-generator';
        payload = { assignment_title: form.assignment_title, subject: form.subject, max_marks: parseInt(form.max_marks) || 100, description: form.description };
      } else if (activeTool === 'summarise') {
        endpoint = '/ai/summarise';
        payload = { text: form.text, subject: form.subject };
      } else if (activeTool === 'flashcards') {
        endpoint = '/ai/flashcards';
        payload = { text: form.text, subject: form.subject, num_cards: parseInt(form.num_cards) || 10 };
      } else if (activeTool === 'studyplan') {
        endpoint = '/ai/study-plan';
        payload = {
          upcoming_exams: form.upcoming_exams.split(',').map(s => s.trim()).filter(Boolean),
          upcoming_assignments: form.upcoming_assignments.split(',').map(s => s.trim()).filter(Boolean),
          days_available: parseInt(form.days_available) || 7,
        };
      } else if (activeTool === 'chatbot') {
        endpoint = '/ai/chatbot';
        payload = { message: form.chatMessage, school_context: `User: ${user?.name}, Role: ${user?.role}, Class: ${user?.class_name || 'N/A'}` };
      }

      const data = await learn.post(endpoint, payload);
      setResult(data.response || data.flashcards || data.study_plan || 'Done.');
    } catch (e) {
      Alert.alert('Error', e.message || 'AI request failed');
    } finally {
      setLoading(false);
    }
  }

  function renderForm() {
    switch (activeTool) {
      case 'exam':
      case 'homework':
      case 'lesson':
        return (
          <>
            <Field label="Subject" value={form.subject} onChange={v => set('subject', v)} placeholder="e.g. Mathematics" />
            <Field label="Class" value={form.class_name} onChange={v => set('class_name', v)} placeholder="e.g. Grade 8" />
            <Field label="Topic" value={form.topic} onChange={v => set('topic', v)} placeholder="e.g. Quadratic Equations" />
            {activeTool !== 'lesson' && (
              <>
                <Field label="Number of Questions" value={form.num_questions} onChange={v => set('num_questions', v)} placeholder="10" keyboardType="numeric" />
                <PickerField label="Difficulty" value={form.difficulty} options={['easy','medium','hard']} onChange={v => set('difficulty', v)} />
              </>
            )}
            {activeTool === 'exam' && (
              <PickerField label="Question Type" value={form.question_type} options={['mixed','mcq','short_answer']} onChange={v => set('question_type', v)} />
            )}
          </>
        );
      case 'plagiarism':
        return (
          <>
            <Field label="Assignment Title" value={form.assignment_title} onChange={v => set('assignment_title', v)} placeholder="e.g. Essay on Climate" />
            <Field label="Student Submission" value={form.submission_text} onChange={v => set('submission_text', v)} placeholder="Paste submission text here..." multiline />
          </>
        );
      case 'feedback':
        return (
          <>
            <Field label="Subject" value={form.subject} onChange={v => set('subject', v)} placeholder="e.g. English" />
            <Field label="Assignment Title" value={form.assignment_title} onChange={v => set('assignment_title', v)} placeholder="Optional" />
            <Field label="Marks Obtained" value={form.marks_obtained} onChange={v => set('marks_obtained', v)} placeholder="e.g. 72" keyboardType="numeric" />
            <Field label="Max Marks" value={form.max_marks} onChange={v => set('max_marks', v)} placeholder="e.g. 100" keyboardType="numeric" />
            <Field label="Submission Text" value={form.submission_text} onChange={v => set('submission_text', v)} placeholder="Paste submission..." multiline />
          </>
        );
      case 'rubric':
        return (
          <>
            <Field label="Assignment Title" value={form.assignment_title} onChange={v => set('assignment_title', v)} placeholder="e.g. Lab Report" />
            <Field label="Subject" value={form.subject} onChange={v => set('subject', v)} placeholder="e.g. Chemistry" />
            <Field label="Total Marks" value={form.max_marks} onChange={v => set('max_marks', v)} placeholder="e.g. 50" keyboardType="numeric" />
            <Field label="Description (optional)" value={form.description} onChange={v => set('description', v)} placeholder="Brief description..." />
          </>
        );
      case 'summarise':
        return (
          <>
            <Field label="Subject (optional)" value={form.subject} onChange={v => set('subject', v)} placeholder="e.g. Biology" />
            <Field label="Your Notes" value={form.text} onChange={v => set('text', v)} placeholder="Paste your notes here..." multiline />
          </>
        );
      case 'flashcards':
        return (
          <>
            <Field label="Subject (optional)" value={form.subject} onChange={v => set('subject', v)} placeholder="e.g. Biology" />
            <Field label="Number of Cards" value={form.num_cards} onChange={v => set('num_cards', v)} placeholder="10" keyboardType="numeric" />
            <Field label="Your Notes" value={form.text} onChange={v => set('text', v)} placeholder="Paste your notes here..." multiline />
          </>
        );
      case 'studyplan':
        return (
          <>
            <Field label="Upcoming Exams (comma separated)" value={form.upcoming_exams} onChange={v => set('upcoming_exams', v)} placeholder="e.g. Math, Physics, Biology" />
            <Field label="Upcoming Assignments (comma separated)" value={form.upcoming_assignments} onChange={v => set('upcoming_assignments', v)} placeholder="e.g. Essay, Lab Report" />
            <Field label="Days Available" value={form.days_available} onChange={v => set('days_available', v)} placeholder="7" keyboardType="numeric" />
          </>
        );
      case 'chatbot':
        return (
          <Field label="Your Question" value={form.chatMessage} onChange={v => set('chatMessage', v)} placeholder="Ask anything about your studies..." multiline />
        );
      default:
        return null;
    }
  }

  if (activeTool) {
    const tool = tools.find(t => t.key === activeTool);
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => { setActiveTool(null); setResult(''); }}>
              <Text style={styles.back}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{tool?.label}</Text>
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
              {renderForm()}
              <TouchableOpacity style={[styles.btn, { backgroundColor: tool?.color || colors.primary }]} onPress={run} disabled={loading}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Generate</Text>
                }
              </TouchableOpacity>
            </View>
            {result ? (
              <View style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultTitle}>Result</Text>
                  <TouchableOpacity onPress={() => setResult('')}>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>Clear</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.resultText}>{result}</Text>
              </View>
            ) : null}
            <View style={{ height: spacing.xxl }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>AI Tools</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {isTeacher && (
          <>
            <Text style={styles.sectionLabel}>Teacher Tools</Text>
            <View style={styles.grid}>
              {TEACHER_TOOLS.map(tool => (
                <TouchableOpacity key={tool.key} style={styles.toolCard} onPress={() => { setActiveTool(tool.key); setResult(''); }} activeOpacity={0.8}>
                  <View style={[styles.toolIcon, { backgroundColor: tool.color + '20' }]}>
                    <Ionicons name={tool.icon} size={22} color={tool.color} />
                  </View>
                  <Text style={styles.toolLabel}>{tool.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        <Text style={styles.sectionLabel}>Study Tools</Text>
        <View style={styles.grid}>
          {STUDENT_TOOLS.map(tool => (
            <TouchableOpacity key={tool.key} style={styles.toolCard} onPress={() => { setActiveTool(tool.key); setResult(''); }} activeOpacity={0.8}>
              <View style={[styles.toolIcon, { backgroundColor: tool.color + '20' }]}>
                <Ionicons name={tool.icon} size={22} color={tool.color} />
              </View>
              <Text style={styles.toolLabel}>{tool.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, placeholder, multiline, keyboardType }) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        keyboardType={keyboardType || 'default'}
      />
    </>
  );
}

function PickerField({ label, value, options, onChange }) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pickerRow}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt}
            style={[styles.pickerBtn, value === opt && styles.pickerBtnActive]}
            onPress={() => onChange(opt)}
          >
            <Text style={[styles.pickerBtnText, value === opt && styles.pickerBtnTextActive]}>
              {opt.charAt(0).toUpperCase() + opt.slice(1).replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { color: colors.primary, fontSize: 16, marginRight: spacing.md },
  title: { flex: 1, color: colors.text, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  content: { padding: spacing.lg },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm, marginTop: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.sm },
  toolCard: { backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, borderWidth: 1, borderColor: colors.border, width: '47%', alignItems: 'flex-start' },
  toolIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  toolLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text, fontSize: 14, minHeight: 44 },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  pickerRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  pickerBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  pickerBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pickerBtnText: { fontSize: 13, color: colors.textMuted },
  pickerBtnTextActive: { color: '#fff', fontWeight: '600' },
  btn: { borderRadius: 12, padding: 14, alignItems: 'center', marginTop: spacing.md },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  resultCard: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  resultTitle: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  resultText: { color: colors.text, fontSize: 13, lineHeight: 21 },
});