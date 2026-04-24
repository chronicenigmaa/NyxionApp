import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, Modal, ScrollView, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { colors, spacing } from '../../constants/theme';
import LoadingScreen from '../../components/LoadingScreen';
import ErrorScreen from '../../components/ErrorScreen';
import ScreenHeader from '../../components/ScreenHeader';
import SelectField from '../../components/SelectField';
import { learn } from '../../services/api';

const BASE = 'https://nyxion-learnspace-production.up.railway.app/api/v1';
const BASE_URL = 'https://nyxion-learnspace-production.up.railway.app';
const SUBJECT_OPTIONS = ['Math', 'Science', 'English', 'Urdu', 'History', 'Computer'].map((option) => ({ label: option, value: option }));
const CLASS_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map((option) => ({ label: `Class ${option}`, value: option }));
const SECTION_OPTIONS = ['A', 'B', 'C', 'D', 'E'].map((option) => ({ label: `Section ${option}`, value: option }));
const EMPTY_NOTE = { title: '', subject: '', class_name: '', section: '', description: '' };

function fileIcon(name) {
  if (name?.endsWith('.pdf')) return 'document-outline';
  if (name?.match(/\.(jpg|jpeg|png|gif)$/i)) return 'image-outline';
  if (name?.match(/\.(doc|docx)$/i)) return 'document-text-outline';
  return 'attach-outline';
}

const appendFiles = (formData, files, fieldName = 'files') => {
  files.forEach((file, index) => {
    formData.append(fieldName, {
      uri: file.uri,
      type: file.mimeType || 'application/octet-stream',
      name: file.name || `${fieldName}-${index + 1}`,
    });
  });
};

const buildNotePayload = (note, files) => {
  if (!files.length) {
    return {
      body: JSON.stringify({
        title: note.title,
        subject: note.subject,
        class_name: note.class_name,
        section: note.section,
        description: note.description,
      }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  const payload = new FormData();
  payload.append('title', note.title);
  payload.append('subject', note.subject);
  payload.append('class_name', note.class_name);
  if (note.section) payload.append('section', note.section);
  payload.append('description', note.description);
  appendFiles(payload, files, 'files');
  return { body: payload, headers: {} };
};

export default function NotesScreen({ navigation, route }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [newNote, setNewNote] = useState(EMPTY_NOTE);
  const [noteFiles, setNoteFiles] = useState([]);
  const [editingNote, setEditingNote] = useState(null);
  const [editingFiles, setEditingFiles] = useState([]);
  const teacherMode = route?.params?.teacherMode;
  const canCreate = isTeacher || teacherMode;

  useEffect(() => { load(); }, []);

  const noteClassOptions = useMemo(() => CLASS_OPTIONS, []);

  const load = async () => {
    setError(null);
    try {
      const token = await AsyncStorage.getItem('learn_token');
      const meRes = await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      const meData = await meRes.json();
      if (!meRes.ok) throw new Error(meData.detail || 'Failed to load profile');
      setIsTeacher(meData.role?.toLowerCase() === 'teacher' || teacherMode);

      const res = await fetch(`${BASE}/notes/`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to load notes');
      setNotes(Array.isArray(data) ? data : data.items || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const pickFiles = async (setter) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
      if (result.canceled) return;
      setter(result.assets || []);
    } catch (e) {
      Alert.alert('File Picker Failed', e.message);
    }
  };

  const removeSelectedFile = (setter, fileName) => setter((prev) => prev.filter((file) => file.name !== fileName));

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

      const sanitizedName = (file.name || 'note-file').replace(/[^a-zA-Z0-9._-]/g, '_');
      const localUri = FileSystem.documentDirectory + sanitizedName;
      let downloaded = false;
      let lastError = 'Unable to download file.';

      for (const url of candidateUrls) {
        try {
          const result = await FileSystem.downloadAsync(url, localUri, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          });
          if (result?.uri) {
            downloaded = true;
            break;
          }
        } catch (e) {
          lastError = e.message;
        }
      }

      if (!downloaded) throw new Error(lastError);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri);
      } else {
        Alert.alert('Download Complete', `Saved to ${localUri}`);
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
      const payload = buildNotePayload(newNote, noteFiles);
      await learn.write('/notes', { method: 'POST', body: payload.body, headers: payload.headers });
      Alert.alert('Published', 'Note posted successfully');
      setShowCreate(false);
      setNewNote(EMPTY_NOTE);
      setNoteFiles([]);
      load();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingNote(false);
    }
  };

  const openEdit = (note) => {
    setSelected(null);
    setEditingFiles([]);
    setEditingNote({
      ...note,
      section: note.section || '',
    });
  };

  const updateNote = async () => {
    if (!editingNote?.title || !editingNote?.class_name) return Alert.alert('Required', 'Title and class are required');
    setSavingNote(true);
    try {
      const payload = buildNotePayload(editingNote, editingFiles);
      await learn.write(`/notes/${editingNote.id}`, {
        method: 'PATCH',
        body: payload.body,
        headers: payload.headers,
        fallbackMethods: ['PUT'],
      });
      Alert.alert('Updated', 'Note updated successfully');
      setEditingNote(null);
      setEditingFiles([]);
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
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.8}>
            <View style={styles.cardTop}>
              <Text style={styles.name}>{item.title}</Text>
              <Text style={styles.date}>{item.created_at?.split('T')[0]}</Text>
            </View>
            {item.subject ? <View style={styles.subjectPill}><Text style={styles.subjectPillText}>{item.subject}</Text></View> : null}
            {item.description ? <Text style={styles.preview} numberOfLines={2}>{item.description}</Text> : null}
            <View style={styles.cardFooter}>
              {item.files?.length > 0 ? (
                <View style={styles.attachmentRow}>
                  <Ionicons name="attach-outline" size={14} color={colors.primary} />
                  <Text style={styles.files}>{item.files.length} attachment{item.files.length > 1 ? 's' : ''}</Text>
                </View>
              ) : <Text style={styles.noFiles}>No attachments</Text>}
              <Text style={styles.tapHint}>View</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="journal-outline" size={48} color={colors.border} /><Text style={styles.emptyText}>No notes yet</Text><Text style={styles.emptySubtext}>Notes shared by your teacher will appear here</Text></View>}
      />

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selected?.title}</Text>
              <View style={styles.modalActions}>
                {canCreate && selected ? (
                  <TouchableOpacity onPress={() => openEdit(selected)} style={styles.iconAction}>
                    <Ionicons name="create-outline" size={18} color={colors.primary} />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.metaRow}>
                {selected?.subject ? <View style={styles.subjectTag}><Text style={styles.subjectTagText}>{selected.subject}</Text></View> : null}
                {selected?.class_name ? <View style={styles.classTag}><Text style={styles.classTagText}>Class {selected.class_name}{selected?.section ? `-${selected.section}` : ''}</Text></View> : null}
              </View>
              {selected?.teacher_name ? <View style={styles.teacherRow}><Ionicons name="person-outline" size={14} color={colors.textMuted} /><Text style={styles.teacherName}>{selected.teacher_name}</Text></View> : null}
              <Text style={styles.postedDate}>{selected?.created_at?.split('T')[0]}</Text>
              {selected?.description ? (<><Text style={styles.sectionLabel}>Description</Text><Text style={styles.noteContent}>{selected.description}</Text></>) : null}
              {selected?.files?.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>Attachments ({selected.files.length})</Text>
                  {selected.files.map((file) => (
                    <TouchableOpacity key={file.id} style={styles.fileRow} onPress={() => downloadFile(selected.id, file)}>
                      <View style={styles.fileInfo}>
                        <View style={styles.fileIconBox}><Ionicons name={fileIcon(file.name)} size={20} color={colors.primary} /></View>
                        <View>
                          <Text style={styles.fileName}>{file.name}</Text>
                          {file.size ? <Text style={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB</Text> : null}
                        </View>
                      </View>
                      {downloading === file.id ? <Ionicons name="hourglass-outline" size={18} color={colors.textMuted} /> : <Ionicons name="download-outline" size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </>
              ) : null}
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
              <Text style={styles.formLabel}>Title *</Text>
              <TextInput style={styles.formInput} value={newNote.title} onChangeText={(value) => setNewNote((prev) => ({ ...prev, title: value }))} placeholder="Note title" placeholderTextColor={colors.textMuted} />
              <SelectField label="Subject" value={newNote.subject} onChange={(value) => setNewNote((prev) => ({ ...prev, subject: value }))} options={SUBJECT_OPTIONS} placeholder="Select subject" />
              <SelectField label="Class *" value={newNote.class_name} onChange={(value) => setNewNote((prev) => ({ ...prev, class_name: value }))} options={noteClassOptions} placeholder="Select class" />
              <SelectField label="Section" value={newNote.section} onChange={(value) => setNewNote((prev) => ({ ...prev, section: value }))} options={SECTION_OPTIONS} placeholder="Select section" />
              <Text style={styles.formLabel}>Description</Text>
              <TextInput style={[styles.formInput, styles.textArea]} value={newNote.description} onChangeText={(value) => setNewNote((prev) => ({ ...prev, description: value }))} placeholder="Enter note details" placeholderTextColor={colors.textMuted} multiline />
              <TouchableOpacity style={styles.filePickerBtn} onPress={() => pickFiles(setNoteFiles)}>
                <Text style={styles.filePickerText}>{noteFiles.length ? `Files Selected (${noteFiles.length})` : 'Attach Files'}</Text>
              </TouchableOpacity>
              {noteFiles.map((file) => (
                <View key={file.name} style={styles.fileChip}>
                  <Text style={styles.fileChipText}>{file.name}</Text>
                  <TouchableOpacity onPress={() => removeSelectedFile(setNoteFiles, file.name)}><Text style={styles.fileRemove}>Remove</Text></TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.saveBtn} onPress={createNote} disabled={savingNote}>
                <Text style={styles.saveBtnText}>{savingNote ? 'Publishing...' : 'Publish Note'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!editingNote} animationType="slide" transparent onRequestClose={() => setEditingNote(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Note</Text>
              <TouchableOpacity onPress={() => setEditingNote(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.formLabel}>Title *</Text>
              <TextInput style={styles.formInput} value={editingNote?.title || ''} onChangeText={(value) => setEditingNote((prev) => ({ ...prev, title: value }))} placeholder="Note title" placeholderTextColor={colors.textMuted} />
              <SelectField label="Subject" value={editingNote?.subject} onChange={(value) => setEditingNote((prev) => ({ ...prev, subject: value }))} options={SUBJECT_OPTIONS} placeholder="Select subject" />
              <SelectField label="Class *" value={editingNote?.class_name} onChange={(value) => setEditingNote((prev) => ({ ...prev, class_name: value }))} options={noteClassOptions} placeholder="Select class" />
              <SelectField label="Section" value={editingNote?.section} onChange={(value) => setEditingNote((prev) => ({ ...prev, section: value }))} options={SECTION_OPTIONS} placeholder="Select section" />
              <Text style={styles.formLabel}>Description</Text>
              <TextInput style={[styles.formInput, styles.textArea]} value={editingNote?.description || ''} onChangeText={(value) => setEditingNote((prev) => ({ ...prev, description: value }))} placeholder="Enter note details" placeholderTextColor={colors.textMuted} multiline />
              <TouchableOpacity style={styles.filePickerBtn} onPress={() => pickFiles(setEditingFiles)}>
                <Text style={styles.filePickerText}>{editingFiles.length ? `New Files Selected (${editingFiles.length})` : 'Attach More Files'}</Text>
              </TouchableOpacity>
              {editingFiles.map((file) => (
                <View key={file.name} style={styles.fileChip}>
                  <Text style={styles.fileChipText}>{file.name}</Text>
                  <TouchableOpacity onPress={() => removeSelectedFile(setEditingFiles, file.name)}><Text style={styles.fileRemove}>Remove</Text></TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.saveBtn} onPress={updateNote} disabled={savingNote}>
                <Text style={styles.saveBtnText}>{savingNote ? 'Saving...' : 'Update Note'}</Text>
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
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
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
  modalCard: { backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '92%', borderTopWidth: 1, borderColor: colors.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700', flex: 1, marginRight: 12 },
  modalActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconAction: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  formLabel: { color: colors.textMuted, fontSize: 13, marginBottom: 6, marginTop: spacing.md },
  formInput: { backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text, fontSize: 14 },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
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
  sectionLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.md, marginBottom: spacing.sm },
  noteContent: { color: colors.text, fontSize: 15, lineHeight: 24, marginBottom: spacing.md },
  fileRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  fileInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  fileIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' },
  fileName: { color: colors.text, fontSize: 13, fontWeight: '600', maxWidth: 200 },
  fileSize: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  filePickerBtn: { marginTop: spacing.md, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 12, alignItems: 'center' },
  filePickerText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  fileChip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  fileChipText: { color: colors.text, flex: 1, marginRight: 12, fontSize: 13 },
  fileRemove: { color: colors.error, fontWeight: '700', fontSize: 12 },
});
