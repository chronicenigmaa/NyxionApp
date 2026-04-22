import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Modal, ScrollView, Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import LoadingScreen from '../../components/LoadingScreen';
import ErrorScreen from '../../components/ErrorScreen';
import ScreenHeader from '../../components/ScreenHeader';

const BASE = 'https://nyxion-learnspace-production.up.railway.app/api/v1';
const BASE_URL = 'https://nyxion-learnspace-production.up.railway.app';

export default function NotesScreen({ navigation }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setError(null);
    try {
      const token = await AsyncStorage.getItem('learn_token');
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
      // Fetch the file as blob then open
      const url = `${BASE_URL}/api/v1/notes/${noteId}/files/${file.id}/download`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      // Get content type and try to open
      const contentType = res.headers.get('content-type') || 'application/octet-stream';
      // For mobile, best we can do is open the URL with token in header via fetch
      // Since we can't pass headers to browser, alert the user with file info
      Alert.alert(
        '📎 File Ready',
        `File: ${file.name}\nSize: ${(file.size / 1024).toFixed(1)} KB\n\nNote: To download files, please use the web app at nyxion-learnspace.vercel.app`,
        [
          { text: 'Open Web App', onPress: () => Linking.openURL('https://nyxion-learnspace.vercel.app') },
          { text: 'OK' },
        ]
      );
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setDownloading(null);
    }
  };

  if (loading) return <LoadingScreen message="Loading notes..." />;
  if (error) return <ErrorScreen message={error} onRetry={load} />;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Notes" onBack={() => navigation.goBack()} />

      <FlatList
        data={notes}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#FF9800" />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.8}>
            <View style={styles.cardTop}>
              <Text style={styles.name}>{item.title}</Text>
              <Text style={styles.date}>{item.created_at?.split('T')[0]}</Text>
            </View>
            {item.subject && <Text style={styles.subject}>{item.subject}</Text>}
            {item.description && <Text style={styles.preview} numberOfLines={2}>{item.description}</Text>}
            <View style={styles.cardFooter}>
              {item.files?.length > 0
                ? <Text style={styles.files}>📎 {item.files.length} file{item.files.length > 1 ? 's' : ''}</Text>
                : <Text style={styles.noFiles}>No attachments</Text>}
              <Text style={styles.tapHint}>Tap to read →</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📓</Text>
            <Text style={styles.emptyText}>No notes yet{'\n'}Notes shared by your teacher appear here</Text>
          </View>
        }
      />

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selected?.title}</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.metaRow}>
                {selected?.subject && <View style={styles.subjectTag}><Text style={styles.subjectTagText}>{selected.subject}</Text></View>}
                {selected?.class_name && <View style={styles.classTag}><Text style={styles.classTagText}>Class {selected.class_name}</Text></View>}
              </View>
              {selected?.teacher_name && <Text style={styles.teacherName}>👨‍🏫 {selected.teacher_name}</Text>}
              <Text style={styles.postedDate}>{selected?.created_at?.split('T')[0]}</Text>
              {selected?.description && (
                <>
                  <Text style={styles.sectionLabel}>Description</Text>
                  <Text style={styles.noteContent}>{selected.description}</Text>
                </>
              )}
              {selected?.files?.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>📎 Attachments ({selected.files.length})</Text>
                  {selected.files.map((file) => (
                    <TouchableOpacity
                      key={file.id}
                      style={styles.fileRow}
                      onPress={() => downloadFile(selected.id, file)}
                    >
                      <View style={styles.fileInfo}>
                        <Text style={styles.fileIcon}>
                          {file.name?.endsWith('.pdf') ? '📄' :
                           file.name?.match(/\.(jpg|jpeg|png|gif)$/i) ? '🖼️' :
                           file.name?.match(/\.(doc|docx)$/i) ? '📝' : '📎'}
                        </Text>
                        <View>
                          <Text style={styles.fileName}>{file.name}</Text>
                          {file.size && <Text style={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB</Text>}
                        </View>
                      </View>
                      <Text style={styles.downloadBtn}>
                        {downloading === file.id ? '⏳' : '⬇️'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, paddingTop: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  date: { color: colors.textMuted, fontSize: 12 },
  subject: { color: '#FF9800', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  preview: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  files: { color: '#FF9800', fontSize: 12 },
  noFiles: { color: colors.textMuted, fontSize: 12 },
  tapHint: { color: colors.primary, fontSize: 11 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 24 },
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: 'bold', flex: 1 },
  modalClose: { color: colors.textMuted, fontSize: 20, paddingLeft: 12 },
  metaRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.sm, flexWrap: 'wrap' },
  subjectTag: { backgroundColor: '#FF980022', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  subjectTagText: { color: '#FF9800', fontSize: 12, fontWeight: '600' },
  classTag: { backgroundColor: colors.primary + '22', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  classTagText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  teacherName: { color: colors.textMuted, fontSize: 13, marginBottom: 2 },
  postedDate: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.md },
  sectionLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.md, marginBottom: spacing.sm },
  noteContent: { color: colors.text, fontSize: 15, lineHeight: 24, marginBottom: spacing.md },
  fileRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.background, borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  fileInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  fileIcon: { fontSize: 24, marginRight: spacing.sm },
  fileName: { color: colors.text, fontSize: 13, fontWeight: '600', maxWidth: 200 },
  fileSize: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  downloadBtn: { color: colors.accent, fontSize: 18 },
});
