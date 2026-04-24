import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import LoadingScreen from '../../components/LoadingScreen';
import ErrorScreen from '../../components/ErrorScreen';

const BASE = 'https://nyxion-learnspace-production.up.railway.app/api/v1';

export default function LearnAttendanceScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setError(null);
    try {
      const token = await AsyncStorage.getItem('learn_token');
      const res = await fetch(`${BASE}/attendance/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Failed to load attendance');
      setData(json);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  if (loading) return <LoadingScreen message="Loading attendance..." />;
  if (error) return <ErrorScreen message={error} onRetry={load} />;

  const records = data?.records || [];
  const pct = data?.percentage ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Attendance</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderColor: (pct >= 75 ? colors.success : colors.error) + '55' }]}>
          <Text style={[styles.statVal, { color: pct >= 75 ? colors.success : colors.error }]}>{pct}%</Text>
          <Text style={styles.statLbl}>Rate</Text>
        </View>
        <View style={[styles.statCard, { borderColor: colors.success + '55' }]}>
          <Text style={[styles.statVal, { color: colors.success }]}>{data?.present ?? 0}</Text>
          <Text style={styles.statLbl}>Present</Text>
        </View>
        <View style={[styles.statCard, { borderColor: colors.error + '55' }]}>
          <Text style={[styles.statVal, { color: colors.error }]}>{data?.absent ?? 0}</Text>
          <Text style={styles.statLbl}>Absent</Text>
        </View>
        <View style={[styles.statCard, { borderColor: colors.primary + '55' }]}>
          <Text style={[styles.statVal, { color: colors.primary }]}>{data?.total ?? 0}</Text>
          <Text style={styles.statLbl}>Total</Text>
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
              <Text style={styles.date}>{item.date}</Text>
              {item.subject && <Text style={styles.subject}>{item.subject}</Text>}
            </View>
            <View style={[styles.badge, { backgroundColor: item.is_present ? colors.success + '22' : colors.error + '22' }]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  back: { color: colors.accent, fontSize: 16, marginRight: spacing.md },
  title: { flex: 1, color: colors.text, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: 8, marginBottom: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: spacing.sm, alignItems: 'center', borderWidth: 1 },
  statVal: { fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  statLbl: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  statusBar: { width: 4, alignSelf: 'stretch' },
  info: { flex: 1, padding: spacing.md },
  date: { color: colors.text, fontSize: 14, fontWeight: '600' },
  subject: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginRight: spacing.md },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 24 },
});
