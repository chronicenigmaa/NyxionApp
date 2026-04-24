import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Modal, ScrollView, TextInput, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import LoadingScreen from '../../components/LoadingScreen';
import ErrorScreen from '../../components/ErrorScreen';
import ScreenWrapper from '../../components/ScreenWrapper';
import SelectField from '../../components/SelectField';

const BASE = 'https://nyxion-eduos-production-63b9.up.railway.app/api/v1';
const AUDIENCE_OPTIONS = [
  { label: 'Everyone', value: 'all' },
  { label: 'Students', value: 'students' },
  { label: 'Teachers', value: 'teachers' },
  { label: 'Parents', value: 'parents' },
];
const EMPTY_NOTICE = { title: '', message: '', target_audience: 'all' };

export default function NoticesScreen({ navigation }) {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_NOTICE);
  const [saving, setSaving] = useState(false);

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

  const saveNotice = async () => {
    if (!form.title || !form.message) return Alert.alert('Required', 'Title and message are required');
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${BASE}/communication/notices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to create notice');
      Alert.alert('Added', 'Notice published successfully');
      setShowAdd(false);
      setForm(EMPTY_NOTICE);
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const updateNotice = async () => {
    if (!selected?.title || !selected?.message) return Alert.alert('Required', 'Title and message are required');
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('token');
      let res = await fetch(`${BASE}/communication/notices/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: selected.title,
          message: selected.message,
          target_audience: selected.target_audience || 'all',
        }),
      });
      if (res.status === 405) {
        res = await fetch(`${BASE}/communication/notices/${selected.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title: selected.title,
            message: selected.message,
            target_audience: selected.target_audience || 'all',
          }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to update notice');
      Alert.alert('Updated', 'Notice updated successfully');
      setSelected(null);
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const deleteNotice = async () => {
    if (!selected) return;
    Alert.alert('Confirm Delete', `Delete "${selected.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setSaving(true);
        try {
          const token = await AsyncStorage.getItem('token');
          const res = await fetch(`${BASE}/communication/notices/${selected.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.detail || 'Failed to delete notice');
          }
          Alert.alert('Deleted', 'Notice removed');
          setSelected(null);
          load();
        } catch (e) { Alert.alert('Error', e.message); }
        finally { setSaving(false); }
      } },
    ]);
  };

  if (loading) return <LoadingScreen message="Loading notices..." />;
  if (error) return <ErrorScreen message={error} onRetry={load} />;

  return (
    <ScreenWrapper style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Notices</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}><Text style={styles.addBtnText}>+ Add</Text></TouchableOpacity>
      </View>
      <FlatList
        data={notices}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.85}>
            <View style={styles.cardHeader}>
              <Text style={styles.name}>{item.title}</Text>
              <Text style={styles.date}>{item.created_at?.split('T')[0]}</Text>
            </View>
            {item.message ? <Text style={styles.message}>{item.message}</Text> : null}
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.target_audience || 'all'}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No notices found</Text>}
      />

      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Publish Notice</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.formLabel}>Title *</Text>
              <TextInput style={styles.formInput} value={form.title} onChangeText={(value) => setForm((prev) => ({ ...prev, title: value }))} placeholder="Notice title" placeholderTextColor={colors.textMuted} />
              <SelectField label="Audience" value={form.target_audience} onChange={(value) => setForm((prev) => ({ ...prev, target_audience: value }))} options={AUDIENCE_OPTIONS} placeholder="Select audience" />
              <Text style={styles.formLabel}>Message *</Text>
              <TextInput style={[styles.formInput, styles.multiline]} value={form.message} onChangeText={(value) => setForm((prev) => ({ ...prev, message: value }))} placeholder="Write your notice" placeholderTextColor={colors.textMuted} multiline />
              <TouchableOpacity style={styles.saveBtn} onPress={saveNotice} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Publish Notice'}</Text>
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
              <TouchableOpacity onPress={() => setSelected(null)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.formLabel}>Title *</Text>
              <TextInput style={styles.formInput} value={selected?.title || ''} onChangeText={(value) => setSelected((prev) => ({ ...prev, title: value }))} placeholder="Notice title" placeholderTextColor={colors.textMuted} />
              <SelectField label="Audience" value={selected?.target_audience} onChange={(value) => setSelected((prev) => ({ ...prev, target_audience: value }))} options={AUDIENCE_OPTIONS} placeholder="Select audience" />
              <Text style={styles.formLabel}>Message *</Text>
              <TextInput style={[styles.formInput, styles.multiline]} value={selected?.message || ''} onChangeText={(value) => setSelected((prev) => ({ ...prev, message: value }))} placeholder="Write your notice" placeholderTextColor={colors.textMuted} multiline />
              <TouchableOpacity style={styles.saveBtn} onPress={updateNotice} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Update Notice'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.error, marginTop: spacing.sm }]} onPress={deleteNotice} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Deleting...' : 'Delete Notice'}</Text>
              </TouchableOpacity>
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
  back: { color: colors.primary, fontSize: 16, marginRight: spacing.md },
  title: { flex: 1, color: colors.text, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  addBtn: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  date: { color: colors.textMuted, fontSize: 12 },
  message: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 8 },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.primary + '22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '86%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: 'bold', flex: 1 },
  modalClose: { color: colors.textMuted, fontSize: 20, paddingLeft: 12 },
  formLabel: { color: colors.textMuted, fontSize: 13, marginBottom: 6, marginTop: 14 },
  formInput: { backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text, fontSize: 14 },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: spacing.lg },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
