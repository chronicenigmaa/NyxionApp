import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import LoadingScreen from '../../components/LoadingScreen';
import ErrorScreen from '../../components/ErrorScreen';

const BASE = 'https://nyxion-eduos-production-63b9.up.railway.app/api/v1';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function TimetableScreen({ navigation }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [day, setDay] = useState('Monday');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setError(null);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${BASE}/timetable/`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed');
      setEntries(Array.isArray(data) ? data : data.entries || data.items || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (loading) return <LoadingScreen message="Loading timetable..." />;
  if (error) return <ErrorScreen message={error} onRetry={load} />;

  const filtered = entries.filter(e => e.day === day || e.day_of_week === day);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Timetable</Text>
      </View>
      <View style={styles.dayScroll}>
        {DAYS.map(d => (
          <TouchableOpacity key={d} style={[styles.dayBtn, day === d && styles.dayBtnActive]} onPress={() => setDay(d)}>
            <Text style={[styles.dayText, day === d && styles.dayTextActive]}>{d.slice(0, 3)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={filtered} keyExtractor={i => i.id} contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.timeBox}>
              <Text style={styles.time}>{item.start_time}</Text>
              <Text style={styles.timeSub}>{item.end_time}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.subject?.name || item.subject_name}</Text>
              <Text style={styles.sub}>Class {item.class_name}{item.section ? `-${item.section}` : ''}</Text>
              {item.teacher?.full_name && <Text style={styles.sub}>👨‍🏫 {item.teacher.full_name}</Text>}
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No classes on {day}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.sm },
  back: { color: colors.primary, fontSize: 16, marginRight: spacing.md },
  title: { flex: 1, color: colors.text, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  dayScroll: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: 8, marginBottom: spacing.sm },
  dayBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  dayBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  dayTextActive: { color: '#fff' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  card: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  timeBox: { width: 60, marginRight: spacing.md },
  time: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  timeSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  info: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
});
