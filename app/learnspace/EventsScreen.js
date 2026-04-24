import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, RefreshControl, Modal, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import LoadingScreen from '../../components/LoadingScreen';
import ErrorScreen from '../../components/ErrorScreen';
import ScreenWrapper from '../../components/ScreenWrapper';

const BASE = 'https://nyxion-learnspace-production.up.railway.app/api/v1';

export default function EventsScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setError(null);
    try {
      const token = await AsyncStorage.getItem('learn_token');
      const res = await fetch(`${BASE}/events/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed');
      setEvents(Array.isArray(data) ? data : data.events || data.items || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  if (loading) return <LoadingScreen message="Loading events..." />;
  if (error) return <ErrorScreen message={error} onRetry={load} />;

  return (
    <ScreenWrapper style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Events</Text>
        <View style={styles.countBadge}><Text style={styles.countText}>{events.length}</Text></View>
      </View>

      <FlatList
        data={events}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor="#9C27B0" />
        }
        renderItem={({ item }) => {
          const date = item.start_date ? new Date(item.start_date) : null;
          return (
            <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.8}>
              <View style={styles.datePill}>
                <Text style={styles.dateDay}>{date ? date.getDate() : '—'}</Text>
                <Text style={styles.dateMon}>{date ? date.toLocaleString('default', { month: 'short' }) : '—'}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{item.title}</Text>
                {item.location && <Text style={styles.sub}>📍 {item.location}</Text>}
                {item.description && (
                  <Text style={styles.desc} numberOfLines={1}>{item.description}</Text>
                )}
                <Text style={styles.tapHint}>Tap for details →</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📅</Text>
            <Text style={styles.emptyText}>No events found</Text>
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
            <ScrollView>
              {[
                ['Start Date', selected?.start_date?.split('T')[0]],
                ['End Date', selected?.end_date?.split('T')[0]],
                ['Location', selected?.location],
                ['Organizer', selected?.organizer],
              ].map(([label, value]) => value ? (
                <View key={label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue}>{value}</Text>
                </View>
              ) : null)}
              {selected?.description && (
                <View style={styles.descBox}>
                  <Text style={styles.descLabel}>About this Event</Text>
                  <Text style={styles.descText}>{selected.description}</Text>
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
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.sm },
  back: { color: colors.accent, fontSize: 16, marginRight: spacing.md },
  title: { flex: 1, color: colors.text, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  countBadge: { backgroundColor: '#9C27B033', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  countText: { color: '#9C27B0', fontSize: 13, fontWeight: '600' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  card: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  datePill: { width: 48, alignItems: 'center', marginRight: spacing.md, backgroundColor: '#9C27B022', borderRadius: 10, padding: 8, justifyContent: 'center' },
  dateDay: { color: '#9C27B0', fontSize: 22, fontWeight: 'bold' },
  dateMon: { color: '#9C27B0', fontSize: 11, fontWeight: '600' },
  info: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  sub: { color: colors.textMuted, fontSize: 12, marginBottom: 2 },
  desc: { color: colors.textMuted, fontSize: 12, marginBottom: 4 },
  tapHint: { color: colors.primary, fontSize: 11, marginTop: 4 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: colors.textMuted, fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: 'bold', flex: 1 },
  modalClose: { color: colors.textMuted, fontSize: 20, paddingLeft: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { color: colors.textMuted, fontSize: 14 },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  descBox: { backgroundColor: '#9C27B011', borderRadius: 12, padding: spacing.md, marginTop: spacing.md },
  descLabel: { color: '#9C27B0', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  descText: { color: colors.text, fontSize: 14, lineHeight: 22 },
});