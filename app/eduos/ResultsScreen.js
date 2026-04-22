import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import LoadingScreen from '../../components/LoadingScreen';
import ErrorScreen from '../../components/ErrorScreen';

const BASE = 'https://nyxion-eduos-production-63b9.up.railway.app/api/v1';

export default function ResultsScreen({ navigation }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setError(null);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${BASE}/results/`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed');
      setResults(Array.isArray(data) ? data : data.results || data.items || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  if (loading) return <LoadingScreen message="Loading results..." />;
  if (error) return <ErrorScreen message={error} onRetry={load} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Results</Text>
        <View style={styles.countBadge}><Text style={styles.countText}>{results.length}</Text></View>
      </View>
      <FlatList
        data={results}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.info}>
              <Text style={styles.name}>{item.student?.full_name || 'Student'}</Text>
              <Text style={styles.sub}>{item.subject} · {item.exam_type}</Text>
              <Text style={styles.sub}>Marks: {item.obtained_marks}/{item.total_marks}</Text>
              {item.remarks && <Text style={styles.sub}>{item.remarks}</Text>}
            </View>
            <View style={[styles.gradeBox, {
              backgroundColor: item.grade === 'A' ? colors.success + '22' :
                item.grade === 'B' ? colors.primary + '22' :
                item.grade === 'C' ? '#FF980022' : colors.error + '22'
            }]}>
              <Text style={[styles.grade, {
                color: item.grade === 'A' ? colors.success :
                  item.grade === 'B' ? colors.primary :
                  item.grade === 'C' ? '#FF9800' : colors.error
              }]}>
                {item.grade || '—'}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No results found</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.sm },
  back: { color: colors.primary, fontSize: 16, marginRight: spacing.md },
  title: { flex: 1, color: colors.text, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  countBadge: { backgroundColor: colors.primary + '33', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  countText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  info: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  gradeBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  grade: { fontSize: 20, fontWeight: 'bold' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
});
