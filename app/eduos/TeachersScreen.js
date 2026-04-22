import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import LoadingScreen from '../../components/LoadingScreen';
import ErrorScreen from '../../components/ErrorScreen';

const BASE = 'https://nyxion-eduos-production-63b9.up.railway.app/api/v1';

export default function TeachersScreen({ navigation }) {
  const [teachers, setTeachers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!search) return setFiltered(teachers);
    const q = search.toLowerCase();
    setFiltered(teachers.filter(t =>
      t.full_name?.toLowerCase().includes(q) ||
      t.subject?.toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q)
    ));
  }, [search, teachers]);

  const load = async () => {
    setError(null);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${BASE}/teachers/`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to load');
      const list = Array.isArray(data) ? data : data.teachers || data.items || [];
      setTeachers(list); setFiltered(list);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  if (loading) return <LoadingScreen message="Loading teachers..." />;
  if (error) return <ErrorScreen message={error} onRetry={load} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Teachers</Text>
        <View style={styles.countBadge}><Text style={styles.countText}>{filtered.length}</Text></View>
      </View>
      <TextInput style={styles.search} placeholder="Search name, subject..." placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} />
      <FlatList
        data={filtered} keyExtractor={i => i.id} contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.full_name?.[0]?.toUpperCase() || '?'}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.full_name}</Text>
              <Text style={styles.sub}>📖 {item.subject || 'N/A'}</Text>
              <Text style={styles.sub}>🎓 {item.qualification || 'N/A'}</Text>
              <Text style={styles.sub}>✉️ {item.email || 'N/A'}</Text>
              {item.salary ? <Text style={styles.sub}>💰 Rs. {item.salary}</Text> : null}
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No teachers found</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.sm },
  back: { color: colors.primary, fontSize: 16, marginRight: spacing.md },
  title: { flex: 1, color: colors.text, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  countBadge: { backgroundColor: colors.accent + '33', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  countText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  search: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text, fontSize: 14 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  card: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.accent + '33', alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  avatarText: { color: colors.accent, fontSize: 20, fontWeight: 'bold' },
  info: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
});
