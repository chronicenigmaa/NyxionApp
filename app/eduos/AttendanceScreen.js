import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import LoadingScreen from '../../components/LoadingScreen';
import ErrorScreen from '../../components/ErrorScreen';

const BASE = 'https://nyxion-eduos-production-63b9.up.railway.app/api/v1';

export default function AttendanceScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [isTeacher, setIsTeacher] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setError(null);
    try {
      const rawUser = await AsyncStorage.getItem('eduos_user');
      const currentUser = rawUser ? JSON.parse(rawUser) : null;
      const teacherUser = currentUser?.role === 'teacher';
      setIsTeacher(teacherUser);
      if (teacherUser) {
        setData(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${BASE}/attendance/report`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Failed to load');
      setData(json);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  if (loading) return <LoadingScreen message="Loading attendance..." />;
  if (error) return <ErrorScreen message={error} onRetry={load} />;
  if (isTeacher) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Attendance</Text>
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🚫</Text>
          <Text style={styles.emptyText}>Teacher attendance marking is handled in Learnspace, not EduOS.</Text>
        </View>
      </View>
    );
  }

  const records = data?.records || [];
  const statusColor = s => s === 'present' ? colors.success : s === 'absent' ? colors.error : s === 'late' ? '#FF9800' : colors.textMuted;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Attendance</Text>
        {data?.date && <Text style={styles.dateLabel}>{data.date}</Text>}
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderColor: colors.success + '55' }]}>
          <Text style={[styles.statVal, { color: colors.success }]}>{data?.present ?? 0}</Text>
          <Text style={styles.statLbl}>Present</Text>
        </View>
        <View style={[styles.statCard, { borderColor: colors.error + '55' }]}>
          <Text style={[styles.statVal, { color: colors.error }]}>{data?.absent ?? 0}</Text>
          <Text style={styles.statLbl}>Absent</Text>
        </View>
        <View style={[styles.statCard, { borderColor: '#FF980055' }]}>
          <Text style={[styles.statVal, { color: '#FF9800' }]}>{data?.late ?? 0}</Text>
          <Text style={styles.statLbl}>Late</Text>
        </View>
        <View style={[styles.statCard, { borderColor: colors.primary + '55' }]}>
          <Text style={[styles.statVal, { color: colors.primary }]}>{data?.total ?? 0}</Text>
          <Text style={styles.statLbl}>Total</Text>
        </View>
      </View>

      <FlatList
        data={records}
        keyExtractor={i => i.student_id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={[styles.statusBar, { backgroundColor: statusColor(item.status) }]} />
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.student_name?.[0]?.toUpperCase() || '?'}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.student_name}</Text>
              <Text style={styles.sub}>Roll: {item.roll_number} · Class {item.class_name}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: statusColor(item.status) + '22' }]}>
              <Text style={{ color: statusColor(item.status), fontSize: 12, fontWeight: '700' }}>
                {item.status === 'not_marked' ? 'N/A' : item.status?.toUpperCase()}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyText}>No attendance records for today</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.sm },
  back: { color: colors.primary, fontSize: 16, marginRight: spacing.md },
  title: { flex: 1, color: colors.text, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  dateLabel: { color: colors.textMuted, fontSize: 12 },
  statsRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: 8, marginBottom: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: spacing.sm, alignItems: 'center', borderWidth: 1 },
  statVal: { fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  statLbl: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  statusBar: { width: 4, alignSelf: 'stretch' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '33', alignItems: 'center', justifyContent: 'center', margin: spacing.sm },
  avatarText: { color: colors.primary, fontSize: 16, fontWeight: 'bold' },
  info: { flex: 1, paddingVertical: spacing.sm },
  name: { color: colors.text, fontSize: 14, fontWeight: '600' },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginRight: spacing.sm },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
});
