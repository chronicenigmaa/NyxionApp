import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import LoadingScreen from '../../components/LoadingScreen';
import ErrorScreen from '../../components/ErrorScreen';

const BASE = 'https://nyxion-eduos-production-63b9.up.railway.app/api/v1';

export default function AcademicsScreen({ navigation }) {
  const [subjects, setSubjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [tab, setTab] = useState('subjects');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setError(null);
    try {
      const token = await AsyncStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const [subjRes, sectRes] = await Promise.all([
        fetch(`${BASE}/academics/subjects`, { headers }),
        fetch(`${BASE}/academics/sections`, { headers }),
      ]);
      const subjData = await subjRes.json();
      const sectData = await sectRes.json();
      setSubjects(Array.isArray(subjData) ? subjData : subjData.subjects || subjData.items || []);
      setSections(Array.isArray(sectData) ? sectData : sectData.sections || sectData.items || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (loading) return <LoadingScreen message="Loading academics..." />;
  if (error) return <ErrorScreen message={error} onRetry={load} />;

  const data = tab === 'subjects' ? subjects : sections;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Academics</Text>
      </View>
      <View style={styles.tabs}>
        {['subjects', 'sections'].map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={data} keyExtractor={i => i.id} contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            {item.class_name && <Text style={styles.sub}>Class {item.class_name}</Text>}
            {item.description && <Text style={styles.sub}>{item.description}</Text>}
            {item.teacher?.full_name && <Text style={styles.sub}>👨‍🏫 {item.teacher.full_name}</Text>}
            {item.class_teacher?.full_name && <Text style={styles.sub}>👨‍🏫 {item.class_teacher.full_name}</Text>}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No {tab} found</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.sm },
  back: { color: colors.primary, fontSize: 16, marginRight: spacing.md },
  title: { flex: 1, color: colors.text, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  tabs: { flexDirection: 'row', marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: 12, padding: 4, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: '#fff' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  name: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  sub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
});
