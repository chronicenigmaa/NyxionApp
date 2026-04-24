import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Modal, ScrollView, TextInput, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import LoadingScreen from '../../components/LoadingScreen';
import ErrorScreen from '../../components/ErrorScreen';
import ScreenWrapper from '../../components/ScreenWrapper';
import { learn } from '../../services/api';

const BASE = 'https://nyxion-learnspace-production.up.railway.app/api/v1';

export default function ExamsScreen({ navigation, route }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [me, setMe] = useState(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newExam, setNewExam] = useState({ title: '', subject: '', class_name: '', duration_minutes: '', total_marks: '', scheduled_at: '' });
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

      const res = await fetch(`${BASE}/exams/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed');
      setExams(Array.isArray(data) ? data : []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const createExam = async () => {
    if (!newExam.title || !newExam.class_name) return Alert.alert('Required', 'Title and class are required');
    setLoading(true);
    try {
      await learn.post('/exams', {
        title: newExam.title,
        subject: newExam.subject,
        class_name: newExam.class_name,
        duration_minutes: Number(newExam.duration_minutes),
        total_marks: Number(newExam.total_marks),
        scheduled_at: newExam.scheduled_at,
      });
      Alert.alert('✅ Created', 'Exam created successfully');
      setShowCreate(false);
      setNewExam({ title: '', subject: '', class_name: '', duration_minutes: '', total_marks: '', scheduled_at: '' });
      load();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingScreen message="Loading exams..." />;
  if (error) return <ErrorScreen message={error} onRetry={load} />;

  const statusColor = s => s === 'live' ? colors.success : s === 'ended' ? colors.error : colors.accent;
  const statusLabel = s => s === 'live' ? '🟢 LIVE' : s === 'ended' ? '🔴 ENDED' : '🕐 SCHEDULED';

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isTeacher ? 'Teacher Exams' : 'Exams'}</Text>
        {canCreate ? (
          <TouchableOpacity style={styles.headerAction} onPress={() => setShowCreate(true)}>
            <Text style={styles.headerActionText}>+ Create</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.countBadge}><Text style={styles.countText}>{exams.length}</Text></View>
        )}
      </View>

      <FlatList
        data={exams}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.error} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.8}>
            <View style={styles.cardTop}>
              <Text style={styles.name}>{item.title}</Text>
              <View style={[styles.badge, { backgroundColor: statusColor(item.status) + '22' }]}>
                <Text style={{ color: statusColor(item.status), fontSize: 11, fontWeight: '700' }}>
                  {statusLabel(item.status)}
                </Text>
              </View>
            </View>
            {item.subject && <Text style={styles.subject}>{item.subject}</Text>}
            {item.class_name && <Text style={styles.classTxt}>Class: {item.class_name}</Text>}
            <View style={styles.metaRow}>
              <Text style={styles.meta}>⏱ {item.duration_minutes} mins</Text>
              <Text style={styles.meta}>📊 {item.total_marks} marks</Text>
              <Text style={styles.meta}>❓ {item.questions?.length || 0} questions</Text>
            </View>
            {item.scheduled_at && (
              <Text style={styles.scheduled}>📅 {item.scheduled_at?.split('T')[0]} at {item.scheduled_at?.split('T')[1]?.slice(0,5)}</Text>
            )}
            <Text style={styles.tapHint}>Tap for details →</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyText}>No exams found{'\n'}Exams created by your teacher will appear here</Text>
          </View>
        }
      />

      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Exam</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {[
                ['Title *', 'title'],
                ['Subject', 'subject'],
                ['Class *', 'class_name'],
                ['Duration (minutes)', 'duration_minutes'],
                ['Total Marks', 'total_marks'],
                ['Date & Time', 'scheduled_at'],
              ].map(([label, key]) => (
                <View key={key}>
                  <Text style={styles.formLabel}>{label}</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newExam[key]}
                    onChangeText={v => setNewExam(prev => ({ ...prev, [key]: v }))}
                    placeholder={label.replace(' *', '')}
                    placeholderTextColor={colors.textMuted}
                    keyboardType={key === 'duration_minutes' || key === 'total_marks' ? 'numeric' : 'default'}
                    autoCapitalize="words"
                  />
                </View>
              ))}
              <TouchableOpacity style={styles.saveBtn} onPress={createExam}>
                <Text style={styles.saveBtnText}>Create Exam</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selected?.title}</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {[
                ['Subject', selected?.subject],
                ['Class', selected?.class_name],
                ['Duration', selected?.duration_minutes ? `${selected.duration_minutes} minutes` : null],
                ['Total Marks', selected?.total_marks],
                ['Questions', selected?.questions?.length],
                ['Scheduled', selected?.scheduled_at?.replace('T', ' at ').slice(0, 19)],
                ['Status', selected?.status?.toUpperCase()],
              ].filter(([, v]) => v !== null && v !== undefined).map(([label, value]) => (
                <View key={label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue}>{String(value)}</Text>
                </View>
              ))}
              <View style={styles.rulesBox}>
                <Text style={styles.rulesTitle}>📋 Exam Rules</Text>
                {selected?.restrict_tab_switch && <Text style={styles.rule}>• Tab switching is monitored</Text>}
                {selected?.restrict_copy_paste && <Text style={styles.rule}>• Copy/paste is disabled</Text>}
                {selected?.fullscreen_required && <Text style={styles.rule}>• Fullscreen required</Text>}
                {selected?.shuffle_questions && <Text style={styles.rule}>• Questions are shuffled</Text>}
                {selected?.max_tab_warnings > 0 && <Text style={styles.rule}>• Max {selected.max_tab_warnings} tab switch warnings</Text>}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  back: { color: colors.accent, fontSize: 16, marginRight: spacing.md },
  title: { flex: 1, color: colors.text, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  headerAction: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.accent, borderRadius: 20 },
  headerActionText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  countBadge: { backgroundColor: colors.error + '33', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  countText: { color: colors.error, fontSize: 13, fontWeight: '600' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  subject: { color: colors.accent, fontSize: 12, fontWeight: '600', marginBottom: 2 },
  classTxt: { color: colors.textMuted, fontSize: 12, marginBottom: 6 },
  metaRow: { flexDirection: 'row', gap: 12, marginBottom: 6, flexWrap: 'wrap' },
  meta: { color: colors.textMuted, fontSize: 12 },
  scheduled: { color: colors.primary, fontSize: 12, marginBottom: 6 },
  tapHint: { color: colors.primary, fontSize: 11, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 24 },
  formLabel: { color: colors.textMuted, fontSize: 13, marginBottom: 6, marginTop: spacing.md },
  formInput: { backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text, fontSize: 14 },
  saveBtn: { backgroundColor: colors.accent, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: spacing.lg },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: 'bold', flex: 1 },
  modalClose: { color: colors.textMuted, fontSize: 20, paddingLeft: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { color: colors.textMuted, fontSize: 14 },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  rulesBox: { backgroundColor: colors.error + '11', borderRadius: 12, padding: spacing.md, marginTop: spacing.md },
  rulesTitle: { color: colors.error, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  rule: { color: colors.textMuted, fontSize: 13, marginBottom: 4 },
});
