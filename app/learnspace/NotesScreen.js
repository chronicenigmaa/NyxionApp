import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, Modal, ScrollView, TextInput, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { colors, spacing, fonts } from '../../constants/theme';
import LoadingScreen from '../../components/LoadingScreen';
import ErrorScreen from '../../components/ErrorScreen';
import ScreenHeader from '../../components/ScreenHeader';

const BASE = 'https://nyxion-learnspace-production.up.railway.app/api/v1';
const BASE_URL = 'https://nyxion-learnspace-production.up.railway.app';

function fileIcon(name) {
  if (name?.endsWith('.pdf')) return 'document-outline';
  if (name?.match(/\.(jpg|jpeg|png|gif)$/i)) return 'image-outline';
  if (name?.match(/\.(doc|docx)$/i)) return 'document-text-outline';
  return 'attach-outline';
}

export default function NotesScreen({ navigation, route }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [me, setMe] = useState(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', subject: '', class_name: '', description: '' });
  const teacherMode = route?.params?.teacherMode;
  const canCreate = isTeacher || teacherMode;

  useEffect(() => { load(); }, []);

  const load = async () => {
    setError(null);
    try {
      const token = await AsyncStorage.getItem('learn_token');
      const meRes = await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      const meData = await meRes.json();
      if (!meRes.ok) throw new Error(meData.detail || 'Failed to load profile');
      setMe(meData);
      setIsTeacher(meData.role?.toLowerCase() === 'teacher' || teacherMode);

      const res = await fetch(`${BASE}/notes/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to load notes');
      setNotes(Array.isArray(data) ? data : []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const downloadFile = async (noteId, file) => {
    try {
      setDownloading(file.id);
      const token = await AsyncStorage.getItem('learn_token');

      const candidateUrls = [
        file.download_url,
        file.url,
        `${BASE_URL}/api/v1/notes/${noteId}/files/${file.id}/download`,
        `${BASE_URL}/api/v1/notes/${noteId}/files/${file.id}`,
      ].filter(Boolean);

      let downloadUrl = null;
      let lastError = 'Unable to download file.';
      for (const url of candidateUrls) {
        try {
          const res = await fetch(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            lastError = err.detail || `HTTP ${res.status}`;
            continue;
          }
          downloadUrl = res.url || url;
          break;
        } catch (innerError) {
          lastError = innerError.message;
        }
      }

      if (!downloadUrl) throw new Error(lastError);

      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const localUri = FileSystem.documentDirectory + sanitizedName;

      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        localUri,
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );

      const { uri } = await downloadResumable.downloadAsync();

      if (await Linking.canOpenURL(uri)) {
        await Linking.openURL(uri);
        Alert.alert('Download Complete', `File saved and opened: ${file.name}`);
      } else {
        Alert.alert('Download Complete', `File saved to: ${uri}`);
      }
    } catch (e) {
      Alert.alert('Download Failed', e.message);
    } finally {
      setDownloading(null);
    }
  };

  const createNote = async () => {
    if (!newNote.title || !newNote.class_name) return Alert.alert('Required', 'Title and class are required');
    setSavingNote(true);
    try {
      const token = await AsyncStorage.getItem('learn_token');
      const res = await fetch(`${BASE}/notes/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: newNote.title,
          subject: newNote.subject,
          class_name: newNote.class_name,
          description: newNote.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to publish note');
      Alert.alert('✅ Published', 'Note posted successfully');
      setShowCreate(false);
      setNewNote({ title: '', subject: '', class_name: '', description: '' });
      load();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) return <LoadingScreen message="Loading notes..." />;
  if (error) return <ErrorScreen message={error} onRetry={load} />;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="Notes" onBack={() => navigation.goBack()} rightLabel={canCreate ? '+ Publish' : null} onRight={() => canCreate && setShowCreate(true)} rightColor={colors.primary} />

      <FlatList
        data={notes}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.8}>
            <View style={styles.cardTop}>
              <Text style={styles.name}>{item.title}</Text>
              <Text style={styles.date}>{item.created_at?.split('T')[0]}</Text>
            </View>
            {item.subject && (
              <View style={styles.subjectPill}>
                <Text style={styles.subjectPillText}>{item.subject}</Text>
              </View>
            )}
            {item.description && <Text style={styles.preview} numberOfLines={2}>{item.description}</Text>}
            <View style={styles.cardFooter}>
              {item.files?.length > 0 ? (
                <View style={styles.attachmentRow}>
                  <Ionicons name="attach-outline" size={14} color={colors.primary} />
                  <Text style={styles.files}>{item.files.length} attachment{item.files.length > 1 ? 's' : ''}</Text>
                </View>
              ) : (
                <Text style={styles.noFiles}>No attachments</Text>
              )}
              <Text style={styles.tapHint}>View</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="journal-outline" size={48} color={colors.border} />
            <Text style={styles.emptyText}>No notes yet</Text>
            <Text style={styles.emptySubtext}>Notes shared by your teacher will appear here</Text>
          </View>
        }
      />

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selected?.title}</Text>
              <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.metaRow}>
                {selected?.subject && (
                  <View style={styles.subjectTag}>
                    <Text style={styles.subjectTagText}>{selected.subject}</Text>
                  </View>
                )}
                {selected?.class_name && (
                  <View style={styles.classTag}>
                    <Text style={styles.classTagText}>Class {selected.class_name}</Text>
                  </View>
                )}
              </View>
              {selected?.teacher_name && (
                <View style={styles.teacherRow}>
                  <Ionicons name="person-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.teacherName}>{selected.teacher_name}</Text>
                </View>
              )}
              <Text style={styles.postedDate}>{selected?.created_at?.split('T')[0]}</Text>
              {selected?.description && (
                <>
                  <Text style={styles.sectionLabel}>Description</Text>
                  <Text style={styles.noteContent}>{selected.description}</Text>
                </>
              )}
              {selected?.files?.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>Attachments ({selected.files.length})</Text>
                  {selected.files.map((file) => (
                    <TouchableOpacity
                      key={file.id}
                      style={styles.fileRow}
                      onPress={() => downloadFile(selected.id, file)}
                    >
                      <View style={styles.fileInfo}>
                        <View style={styles.fileIconBox}>
                          <Ionicons name={fileIcon(file.name)} size={20} color={colors.primary} />
                        </View>
                        <View>
                          <Text style={styles.fileName}>{file.name}</Text>
                          {file.size && <Text style={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB</Text>}
                        </View>
                      </View>
                      {downloading === file.id
                        ? <Ionicons name="hourglass-outline" size={18} color={colors.textMuted} />
                        : <Ionicons name="download-outline" size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Publish Note</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {[
                ['Title *', 'title'],
                ['Subject', 'subject'],
                ['Class *', 'class_name'],
              ].map(([label, key]) => (
                <View key={key}>
                  <Text style={styles.formLabel}>{label}</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newNote[key]}
                    onChangeText={v => setNewNote(prev => ({ ...prev, [key]: v }))}
                    placeholder={label.replace(' *', '')}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize={key === 'class_name' ? 'words' : 'sentences'}
                  />
                </View>
              ))}
              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                style={[styles.formInput, { minHeight: 120, textAlignVertical: 'top' }]}
                value={newNote.description}
                onChangeText={v => setNewNote(prev => ({ ...prev, description: v }))}
                placeholder="Enter note details"
                placeholderTextColor={colors.textMuted}
                multiline
              />
              <TouchableOpacity style={styles.saveBtn} onPress={createNote} disabled={savingNote}>
                <Text style={styles.saveBtnText}>{savingNote ? 'Publishing...' : 'Publish Note'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, paddingTop: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, alignItems: 'flex-start' },
  name: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  date: { color: colors.textMuted, fontSize: 12 },
  subjectPill: { alignSelf: 'flex-start', backgroundColor: colors.primary + '15', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, marginBottom: 6 },
  subjectPillText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  preview: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  attachmentRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  files: { color: colors.primary, fontSize: 12, fontWeight: '500' },
  noFiles: { color: colors.textMuted, fontSize: 12 },
  tapHint: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  emptySubtext: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    maxHeight: '92%',
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700', flex: 1, marginRight: 12 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  formLabel: { color: colors.textMuted, fontSize: 13, marginBottom: 6, marginTop: spacing.md },
  formInput: { backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text, fontSize: 14 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: spacing.lg },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  metaRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.sm, flexWrap: 'wrap' },
  subjectTag: { backgroundColor: colors.primary + '15', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  subjectTagText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  classTag: { backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  classTagText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  teacherRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  teacherName: { color: colors.textMuted, fontSize: 13 },
  postedDate: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.md },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  noteContent: { color: colors.text, fontSize: 15, lineHeight: 24, marginBottom: spacing.md },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fileInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  fileIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' },
  fileName: { color: colors.text, fontSize: 13, fontWeight: '600', maxWidth: 200 },
  fileSize: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});
