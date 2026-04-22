import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import LoadingScreen from '../../components/LoadingScreen';
import ErrorScreen from '../../components/ErrorScreen';

const BASE = 'https://nyxion-eduos-production-63b9.up.railway.app/api/v1';

export default function NoticesScreen({ navigation }) {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setError(null);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${BASE}/communication/notices`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed');
      setNotices(Array.isArray(data) ? data : data.notices || data.items || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  if (loading) return <LoadingScreen message="Loading notices..." />;
  if (error) return <ErrorScreen message={error} onRetry={load} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Notices</Text>
        <View style={styles.countBadge}><Text style={styles.countText}>{notices.length}</Text></View>
      </View>
      <FlatList
        data={notices} keyExtractor={i => i.id} contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.name}>{item.title}</Text>
              <Text style={styles.date}>{item.created_at?.split('T')[0]}</Text>
            </View>
            {item.message && <Text style={styles.message}>{item.message}</Text>}
            {item.target_audience && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.target_audience}</Text>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No notices found</Text>}
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
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  date: { color: colors.textMuted, fontSize: 12 },
  message: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 8 },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.primary + '33', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  badgeText: { color: colors.primary, fontSize: 11, fontWeight: '600' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
});
