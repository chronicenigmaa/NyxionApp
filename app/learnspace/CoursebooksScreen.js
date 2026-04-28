import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, TextInput, Alert, Modal, Linking, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { learn, LEARN_BASE } from '../../services/api';
import { colors, spacing, fonts, STATUSBAR_HEIGHT } from '../../constants/theme';
const SUBJECT_COLORS = ['#6366f1','#8b5cf6','#0ea5e9','#10b981','#f59e0b','#ec4899','#ef4444','#14b8a6'];

export default function CoursebooksScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [form, setForm] = useState({ title: '', subject: '', class_name: '', description: '' });
  const [ai, setAi] = useState({ subject: '', class_name: '', topic: '', loading: false, result: '' });
  const [chatMessages, setChatMessages] = useState([{ role: 'assistant', content: 'Hi! Ask me anything about your coursebooks or lessons.' }]);
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
      const data = await learn.get('/coursebooks/');
      setBooks(Array.isArray(data) ? data : []);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to load coursebooks');
    } finally {
      setLoading(false);
    }
  }

  const isTeacher = user?.role === 'teacher' || user?.role === 'school_admin' || user?.role === 'super_admin';
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const subjects = [...new Set(books.map(b => b.subject).filter(Boolean))];
  const filtered = filter ? books.filter(b => b.subject === filter) : books;

  async function handleAdd() {
    if (!form.title || !form.subject || !form.class_name) {
      Alert.alert('Error', 'Title, subject, and class are required'); return;
    }
    try {
      await learn.post('/coursebooks/', form);
      setShowAdd(false);
      setForm({ title: '', subject: '', class_name: '', description: '' });
      load();
    } catch (e) { Alert.alert('Error', e.message || 'Failed to add'); }
  }

  async function handleDelete(id) {
    Alert.alert('Delete', 'Remove this coursebook?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await learn.delete(`/coursebooks/${id}`); load(); }
        catch (e) { Alert.alert('Error', e.message); }
      }},
    ]);
  }

  async function handleDownload(book) {
    if (!book.file_path) { Alert.alert('No File', 'No file attached to this coursebook.'); return; }
    const url = `${LEARN_BASE.replace('/api/v1', '')}${book.file_path}`;
    try { await Linking.openURL(url); }
    catch { Alert.alert('Error', 'Could not open file'); }
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
      const context = `User: ${user?.name}, Role: ${user?.role}, Class: ${user?.class_name || 'N/A'}. Available coursebooks: ${books.map(b => `"${b.title}" (${b.subject}, ${b.class_name})`).join('; ')}`;
      const data = await learn.post('/ai/chatbot', { message: msg, school_context: context });
      setChatMessages(m => [...m, { role: 'assistant', content: data.response }]);
    } catch {
      setChatMessages(m => [...m, { role: 'assistant', content: 'Sorry, something went wrong.' }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  function getSubjectColor(subject) {
    const idx = subjects.indexOf(subject);
    return SUBJECT_COLORS[idx % SUBJECT_COLORS.length] || colors.primary;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Coursebooks</Text>
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

      {subjects.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterContent}>
          <TouchableOpacity style={[styles.filterChip, !filter && styles.filterChipActive]} onPress={() => setFilter('')}>
            <Text style={[styles.filterChipText, !filter && styles.filterChipTextActive]}>All</Text>
          </TouchableOpacity>
          {subjects.map(s => (
            <TouchableOpacity key={s} style={[styles.filterChip, filter === s && styles.filterChipActive]} onPress={() => setFilter(s)}>
              <Text style={[styles.filterChipText, filter === s && styles.filterChipTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="book-outline" size={40} color={colors.border} />
          <Text style={styles.emptyText}>No coursebooks found</Text>
          {isTeacher && <TouchableOpacity style={[styles.btn, { marginTop: spacing.md }]} onPress={() => setShowAdd(true)}><Text style={styles.btnText}>Add one</Text></TouchableOpacity>}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {filtered.map(book => {
            const color = getSubjectColor(book.subject);
            return (
              <View key={book.id} style={styles.bookCard}>
                <View style={[styles.bookIcon, { backgroundColor: color + '20' }]}>
                  <Ionicons name="book-outline" size={22} color={color} />
                </View>
                <View style={styles.bookInfo}>
                  <Text style={styles.bookTitle}>{book.title}</Text>
                  <Text style={styles.bookMeta}>{book.subject} · {book.class_name}</Text>
                  {book.description ? <Text style={styles.bookDesc} numberOfLines={2}>{book.description}</Text> : null}
                  <View style={styles.bookActions}>
                    {book.file_path && (
                      <TouchableOpacity style={styles.actionBtn} onPress={() => handleDownload(book)}>
                        <Ionicons name="download-outline" size={13} color={colors.primary} />
                        <Text style={styles.actionText}>Download</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.actionBtn, { borderColor: '#8b5cf6' + '40' }]} onPress={() => { setAi(a => ({ ...a, subject: book.subject, class_name: book.class_name })); setShowAI(true); }}>
                      <Ionicons name="sparkles-outline" size={13} color="#8b5cf6" />
                      <Text style={[styles.actionText, { color: '#8b5cf6' }]}>Plan Lesson</Text>
                    </TouchableOpacity>
                    {isTeacher && (
                      <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.error + '40' }]} onPress={() => handleDelete(book.id)}>
                        <Ionicons name="trash-outline" size={13} color={colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      )}

      {/* Add Modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Coursebook</Text>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {[
              { label: 'Title', key: 'title', placeholder: 'e.g. Physics Textbook Grade 10' },
              { label: 'Subject', key: 'subject', placeholder: 'e.g. Physics' },
              { label: 'Class', key: 'class_name', placeholder: 'e.g. Grade 10' },
              { label: 'Description (optional)', key: 'description', placeholder: 'Brief description...' },
            ].map(f => (
              <View key={f.key}>
                <Text style={styles.label}>{f.label}</Text>
                <TextInput style={styles.input} value={form[f.key]} onChangeText={v => setForm(fm => ({ ...fm, [f.key]: v }))} placeholder={f.placeholder} placeholderTextColor={colors.textMuted} />
              </View>
            ))}
            <TouchableOpacity style={styles.btn} onPress={handleAdd}>
              <Text style={styles.btnText}>Save Coursebook</Text>
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
                placeholder="Ask about your coursebooks..."
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
header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: STATUSBAR_HEIGHT + spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },  back: { color: colors.primary, fontSize: 16, marginRight: spacing.md },
  title: { flex: 1, color: colors.text, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  chatBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#10b981' + '40', backgroundColor: '#10b981' + '10' },
  aiBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#8b5cf6' + '40', backgroundColor: '#8b5cf6' + '10' },
  addBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  filterBar: { maxHeight: 50, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: 8, flexDirection: 'row' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 13, color: colors.textMuted },
  filterChipTextActive: { color: '#fff', fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  emptyText: { color: colors.textMuted, fontSize: 14, marginTop: spacing.md },
  content: { padding: spacing.lg },
  bookCard: { flexDirection: 'row', gap: 12, backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  bookIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bookInfo: { flex: 1 },
  bookTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  bookMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  bookDesc: { color: colors.textMuted, fontSize: 12, marginTop: 4, lineHeight: 17 },
  bookActions: { flexDirection: 'row', gap: 6, marginTop: spacing.sm, flexWrap: 'wrap' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: colors.primary + '40' },
  actionText: { fontSize: 12, color: colors.primary, fontWeight: '500' },
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: fonts.sizes.md, fontWeight: '700', color: colors.text },
  modalContent: { padding: spacing.lg },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text, fontSize: 14 },
  btn: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: spacing.md },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  resultCard: { backgroundColor: colors.surface, borderRadius: 14, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  resultTitle: { color: '#8b5cf6', fontSize: 14, fontWeight: '700', marginBottom: spacing.sm },
  resultText: { color: colors.text, fontSize: 13, lineHeight: 21 },
});