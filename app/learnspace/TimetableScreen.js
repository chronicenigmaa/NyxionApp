import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, TextInput, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { learn } from '../../services/api';
import { colors, spacing, fonts, STATUSBAR_HEIGHT } from '../../constants/theme';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIODS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
const DAY_COLORS = {
  Monday: '#6366f1', Tuesday: '#8b5cf6', Wednesday: '#0ea5e9',
  Thursday: '#10b981', Friday: '#f59e0b', Saturday: '#ec4899',
};

export default function TimetableScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [form, setForm] = useState({ day: 'Monday', period: '1st', subject: '', teacher_name: '', class_name: '', start_time: '08:00', end_time: '08:45' });
  const [ai, setAi] = useState({ subject: '', class_name: '', topic: '', loading: false, result: '' });
  const [chatMessages, setChatMessages] = useState([{ role: 'assistant', content: 'Hi! Ask me anything about your timetable or lessons.' }]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem('learn_user').then(raw => {
      if (raw) try { setUser(JSON.parse(raw)); } catch {}
    });
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await learn.get('/timetable/');
      setEntries(Array.isArray(data) ? data : []);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to load timetable');
    } finally {
      setLoading(false);
    }
  }

  const isTeacher = user?.role === 'teacher' || user?.role === 'school_admin' || user?.role === 'super_admin';
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleAdd() {
    if (!form.subject || !form.class_name) { Alert.alert('Error', 'Subject and class are required'); return; }
    try {
      await learn.post('/timetable/', form);
      setShowAdd(false);
      setForm({ day: 'Monday', period: '1st', subject: '', teacher_name: '', class_name: '', start_time: '08:00', end_time: '08:45' });
      load();
    } catch (e) { Alert.alert('Error', e.message || 'Failed to add entry'); }
  }

  async function handleDelete(id) {
    Alert.alert('Delete', 'Remove this timetable entry?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await learn.delete(`/timetable/${id}`); load(); }
        catch (e) { Alert.alert('Error', e.message); }
      }},
    ]);
  }

  async function generateLessonPlan() {
    if (!ai.subject || !ai.class_name || !ai.topic) { Alert.alert('Error', 'Fill in all fields'); return; }
    setAi(a => ({ ...a, loading: true, result: '' }));
    try {
      const data = await learn.post('/ai/lesson-planner', { subject: ai.subject, class_name: ai.class_name, topic: ai.topic, duration_minutes: 45 });
      setAi(a => ({ ...a, loading: false, result: data.response }));
    } catch (e) {
      Alert.alert('Error', e.message || 'AI error');
      setAi(a => ({ ...a, loading: false }));
    }
  }

  async function sendChat() {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput('');
    setChatMessages(m => [...m, { role: 'user', content: msg }]);
    setChatLoading(true);
    try {
      const context = `User: ${user?.name}, Role: ${user?.role}, Class: ${user?.class_name || 'N/A'}. Timetable: ${entries.map(e => `${e.day} ${e.period} period: ${e.subject} (${e.class_name}, ${e.start_time || ''}–${e.end_time || ''})`).join('; ')}`;
      const data = await learn.post('/ai/chatbot', { message: msg, school_context: context });
      setChatMessages(m => [...m, { role: 'assistant', content: data.response }]);
    } catch {
      setChatMessages(m => [...m, { role: 'assistant', content: 'Sorry, something went wrong.' }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  const grouped = {};
  DAYS.forEach(d => { grouped[d] = entries.filter(e => e.day === d).sort((a, b) => a.period.localeCompare(b.period)); });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Timetable</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.chatBtn} onPress={() => setShowChat(true)}>
            <Ionicons name="chatbubble-outline" size={16} color="#10b981" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.aiBtn} onPress={() => setShowAI(true)}>
            <Ionicons name="sparkles-outline" size={16} color="#8b5cf6" />
          </TouchableOpacity>
          {isTeacher && (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {DAYS.map(day => (
            <View key={day} style={styles.dayBlock}>
              <View style={[styles.dayHeader, { borderLeftColor: DAY_COLORS[day] }]}>
                <Text style={[styles.dayLabel, { color: DAY_COLORS[day] }]}>{day}</Text>
                <Text style={styles.dayCount}>{grouped[day].length} periods</Text>
              </View>
              {grouped[day].length === 0 ? (
                <Text style={styles.emptyDay}>No classes scheduled</Text>
              ) : (
                grouped[day].map(entry => (
                  <View key={entry.id} style={styles.entryRow}>
                    <View style={[styles.periodBadge, { backgroundColor: DAY_COLORS[day] + '20' }]}>
                      <Text style={[styles.periodText, { color: DAY_COLORS[day] }]}>
                        {entry.period.replace('th','').replace('st','').replace('nd','').replace('rd','')}
                      </Text>
                    </View>
                    <View style={styles.entryInfo}>
                      <Text style={styles.entrySubject}>{entry.subject}</Text>
                      <Text style={styles.entryMeta}>{entry.class_name}{entry.teacher_name ? ` · ${entry.teacher_name}` : ''}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      {entry.start_time && (
                        <Text style={styles.timeText}>{entry.start_time}–{entry.end_time}</Text>
                      )}
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        <TouchableOpacity onPress={() => { setAi(a => ({ ...a, subject: entry.subject, class_name: entry.class_name })); setShowAI(true); }}>
                          <Ionicons name="sparkles-outline" size={14} color="#8b5cf6" />
                        </TouchableOpacity>
                        {isTeacher && (
                          <TouchableOpacity onPress={() => handleDelete(entry.id)}>
                            <Ionicons name="trash-outline" size={14} color={colors.error} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          ))}
          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      )}

      {/* Add Entry Modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Timetable Entry</Text>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.label}>Day</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {DAYS.map(d => (
                  <TouchableOpacity key={d} style={[styles.chip, form.day === d && styles.chipActive]} onPress={() => set('day', d)}>
                    <Text style={[styles.chipText, form.day === d && styles.chipTextActive]}>{d.slice(0,3)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <Text style={styles.label}>Period</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {PERIODS.map(p => (
                  <TouchableOpacity key={p} style={[styles.chip, form.period === p && styles.chipActive]} onPress={() => set('period', p)}>
                    <Text style={[styles.chipText, form.period === p && styles.chipTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            {[
              { label: 'Subject', key: 'subject', placeholder: 'e.g. Mathematics' },
              { label: 'Class', key: 'class_name', placeholder: 'e.g. Grade 8' },
              { label: 'Teacher Name', key: 'teacher_name', placeholder: 'e.g. Mr. Ahmed' },
              { label: 'Start Time', key: 'start_time', placeholder: '08:00' },
              { label: 'End Time', key: 'end_time', placeholder: '08:45' },
            ].map(f => (
              <View key={f.key}>
                <Text style={styles.label}>{f.label}</Text>
                <TextInput style={styles.input} value={form[f.key]} onChangeText={v => set(f.key, v)} placeholder={f.placeholder} placeholderTextColor={colors.textMuted} />
              </View>
            ))}
            <TouchableOpacity style={styles.btn} onPress={handleAdd}>
              <Text style={styles.btnText}>Save Entry</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* AI Lesson Planner Modal */}
      <Modal visible={showAI} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="sparkles-outline" size={18} color="#8b5cf6" />
              <Text style={styles.modalTitle}>AI Lesson Planner</Text>
            </View>
            <TouchableOpacity onPress={() => setShowAI(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {[
              { label: 'Subject', key: 'subject', placeholder: 'e.g. Biology' },
              { label: 'Class', key: 'class_name', placeholder: 'e.g. Grade 9' },
              { label: 'Topic', key: 'topic', placeholder: 'e.g. Photosynthesis' },
            ].map(f => (
              <View key={f.key}>
                <Text style={styles.label}>{f.label}</Text>
                <TextInput style={styles.input} value={ai[f.key]} onChangeText={v => setAi(a => ({ ...a, [f.key]: v }))} placeholder={f.placeholder} placeholderTextColor={colors.textMuted} />
              </View>
            ))}
            <TouchableOpacity style={[styles.btn, { backgroundColor: '#8b5cf6' }]} onPress={generateLessonPlan} disabled={ai.loading}>
              {ai.loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Generate Lesson Plan</Text>}
            </TouchableOpacity>
            {ai.result ? (
              <View style={[styles.resultCard, { marginTop: spacing.md }]}>
                <Text style={styles.resultTitle}>Lesson Plan</Text>
                <Text style={styles.resultText}>{ai.result}</Text>
              </View>
            ) : null}
            <View style={{ height: spacing.xxl }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Chatbot Modal */}
      <Modal visible={showChat} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="chatbubble-outline" size={18} color="#10b981" />
              <Text style={styles.modalTitle}>Nyxion AI</Text>
            </View>
            <TouchableOpacity onPress={() => setShowChat(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView
            ref={chatScrollRef}
            contentContainerStyle={{ padding: spacing.md, gap: 10 }}
            onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
          >
            {chatMessages.map((m, i) => (
              <View key={i} style={{ alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <View style={{
                  maxWidth: '85%', borderRadius: 14, padding: 12,
                  backgroundColor: m.role === 'user' ? colors.primary : colors.surface,
                  borderWidth: m.role === 'assistant' ? 1 : 0,
                  borderColor: colors.border,
                }}>
                  <Text style={{ color: m.role === 'user' ? '#fff' : colors.text, fontSize: 13, lineHeight: 19 }}>
                    {m.content}
                  </Text>
                </View>
              </View>
            ))}
            {chatLoading && (
              <View style={{ alignItems: 'flex-start' }}>
                <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.border }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              </View>
            )}
          </ScrollView>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={{ flexDirection: 'row', gap: 8, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Ask about your timetable..."
                placeholderTextColor={colors.textMuted}
                onSubmitEditing={sendChat}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={{ backgroundColor: colors.primary, borderRadius: 10, width: 44, alignItems: 'center', justifyContent: 'center' }}
                onPress={sendChat}
                disabled={chatLoading}
              >
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, paddingTop: STATUSBAR_HEIGHT + spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },  back: { color: colors.primary, fontSize: 16, marginRight: spacing.md },
  title: { flex: 1, color: colors.text, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  chatBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#10b981' + '40', backgroundColor: '#10b981' + '10' },
  aiBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#8b5cf6' + '40', backgroundColor: '#8b5cf6' + '10' },
  addBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg },
  dayBlock: { marginBottom: spacing.lg },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 3, paddingLeft: spacing.sm, marginBottom: spacing.sm },
  dayLabel: { fontSize: 14, fontWeight: '700' },
  dayCount: { fontSize: 12, color: colors.textMuted },
  emptyDay: { color: colors.textMuted, fontSize: 13, paddingLeft: spacing.sm, paddingBottom: spacing.sm },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: colors.border },
  periodBadge: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  periodText: { fontSize: 12, fontWeight: '700' },
  entryInfo: { flex: 1 },
  entrySubject: { color: colors.text, fontSize: 14, fontWeight: '600' },
  entryMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  timeText: { color: colors.textMuted, fontSize: 11 },
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: fonts.sizes.md, fontWeight: '700', color: colors.text },
  modalContent: { padding: spacing.lg },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text, fontSize: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textMuted },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  btn: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: spacing.md },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  resultCard: { backgroundColor: colors.surface, borderRadius: 14, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  resultTitle: { color: colors.primary, fontSize: 14, fontWeight: '700', marginBottom: spacing.sm },
  resultText: { color: colors.text, fontSize: 13, lineHeight: 21 },
});