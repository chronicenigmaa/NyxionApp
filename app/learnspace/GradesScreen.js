import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, Modal, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import LoadingScreen from '../../components/LoadingScreen';
import ErrorScreen from '../../components/ErrorScreen';
import ScreenWrapper from '../../components/ScreenWrapper';

const BASE = 'https://nyxion-learnspace-production.up.railway.app/api/v1';

export default function GradesScreen({ navigation }) {
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setError(null);
    try {
      const token = await AsyncStorage.getItem('learn_token');
      const res = await fetch(`${BASE}/grades/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed');
      setGrades(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) return <LoadingScreen message="Loading grades..." />;
  if (error) return <ErrorScreen message={error} onRetry={load} />;

  const avg = grades.length
    ? (grades.reduce((s, g) => s + (g.percentage || 0), 0) / grades.length).toFixed(1)
    : null;

  const gradeColor = (pct) => {
    if (pct == null) return colors.textMuted;
    if (pct >= 90) return colors.success;
    if (pct >= 75) return colors.accent;
    if (pct >= 60) return '#FF9800';
    return colors.error;
  };

  return (
    <ScreenWrapper>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Grades</Text>
        <View style={{ width: 60 }} />
      </View>

      {avg && (
        <View style={styles.avgCard}>
          <Text style={[styles.avgVal, { color: gradeColor(parseFloat(avg)) }]}>{avg}%</Text>
          <Text style={styles.avgLabel}>Average · {grades.length} graded</Text>
        </View>
      )}

      <FlatList
        data={grades}
        keyExtractor={i => i.assignment_id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.8}>
            <View style={styles.info}>
              <Text style={styles.name}>{item.assignment_title}</Text>
              {item.subject && <Text style={styles.subject}>{item.subject}</Text>}
              <Text style={styles.date}>{item.graded_at?.split('T')[0]}</Text>
            </View>
            <View style={styles.scoreBox}>
              <Text style={[styles.pct, { color: gradeColor(item.percentage) }]}>{item.percentage}%</Text>
              <Text style={styles.marks}>{item.marks_obtained}/{item.max_marks}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyText}>No grades yet{"\n"}Grades appear after your teacher marks your work</Text>
          </View>
        }
      />

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selected?.assignment_title}</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {[
                ['Subject', selected?.subject],
                ['Marks', `${selected?.marks_obtained} / ${selected?.max_marks}`],
                ['Percentage', `${selected?.percentage}%`],
                ['Graded On', selected?.graded_at?.split('T')[0]],
              ].filter(([, v]) => v).map(([label, value]) => (
                <View key={label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue}>{value}</Text>
                </View>
              ))}
              {selected?.feedback && (
                <View style={styles.feedbackBox}>
                  <Text style={styles.feedbackLabel}>💬 Teacher Feedback</Text>
                  <Text style={styles.feedbackText}>"{selected.feedback}"</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { color: colors.accent, fontSize: 16, fontWeight: '600', width: 60 },
  headerTitle: { flex: 1, color: colors.text, fontSize: fonts.sizes.lg, fontWeight: 'bold', textAlign: 'center' },
  avgCard: { marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  avgVal: { fontSize: 52, fontWeight: 'bold' },
  avgLabel: { color: colors.textMuted, fontSize: 14, marginTop: 4 },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  info: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  subject: { color: colors.accent, fontSize: 12, marginTop: 2 },
  date: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  scoreBox: { alignItems: 'flex-end' },
  pct: { fontSize: 24, fontWeight: 'bold' },
  marks: { color: colors.textMuted, fontSize: 11 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 24 },
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: 'bold', flex: 1 },
  modalClose: { color: colors.textMuted, fontSize: 20, paddingLeft: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { color: colors.textMuted, fontSize: 14 },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  feedbackBox: { backgroundColor: colors.accent + '11', borderRadius: 12, padding: spacing.md, marginTop: spacing.md },
  feedbackLabel: { color: colors.accent, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  feedbackText: { color: colors.text, fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
});
