import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput, RefreshControl, Modal, ScrollView, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import LoadingScreen from '../../components/LoadingScreen';
import ErrorScreen from '../../components/ErrorScreen';

const BASE = 'https://nyxion-eduos-production-63b9.up.railway.app/api/v1';

export default function StudentsScreen({ navigation }) {
  const [students, setStudents] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: '', father_name: '', roll_number: '', class_name: '', section: '', phone: '', email: '' });

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!search) return setFiltered(students);
    const q = search.toLowerCase();
    setFiltered(students.filter(s =>
      s.full_name?.toLowerCase().includes(q) ||
      s.roll_number?.toLowerCase().includes(q) ||
      s.class_name?.toLowerCase().includes(q)
    ));
  }, [search, students]);

  const load = async () => {
    setError(null);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${BASE}/students/`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed');
      const list = Array.isArray(data) ? data : [];
      setStudents(list); setFiltered(list);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const addStudent = async () => {
    if (!form.full_name) return Alert.alert('Required', 'Full name is required');
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${BASE}/students/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to add student');
      Alert.alert('✅ Added', `${form.full_name} added successfully`);
      setShowAdd(false);
      setForm({ full_name: '', father_name: '', roll_number: '', class_name: '', section: '', phone: '', email: '' });
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <LoadingScreen message="Loading students..." />;
  if (error) return <ErrorScreen message={error} onRetry={load} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Students</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <TextInput style={styles.search} placeholder="Search name, roll, class..." placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} />

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.8}>
            <View style={[styles.avatar, { backgroundColor: colors.primary + '33' }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>{item.full_name?.[0]?.toUpperCase() || '?'}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.full_name}</Text>
              <Text style={styles.sub}>Roll: {item.roll_number} · Class {item.class_name}{item.section ? `-${item.section}` : ''}</Text>
              {item.father_name && <Text style={styles.sub}>Father: {item.father_name}</Text>}
            </View>
            <View style={[styles.statusDot, { backgroundColor: item.is_active ? colors.success : colors.error }]} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No students found</Text>}
      />

      {/* View Detail Modal */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selected?.full_name}</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {[
                ['Roll Number', selected?.roll_number],
                ['Class', `${selected?.class_name}${selected?.section ? `-${selected.section}` : ''}`],
                ['Father', selected?.father_name],
                ['Phone', selected?.phone],
                ['Email', selected?.email],
                ['Address', selected?.address],
                ['Status', selected?.is_active ? 'Active' : 'Inactive'],
              ].filter(([, v]) => v).map(([label, value]) => (
                <View key={label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue}>{value}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Student Modal */}
      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Student</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {[
                ['Full Name *', 'full_name', false],
                ['Father Name', 'father_name', false],
                ['Roll Number', 'roll_number', false],
                ['Class', 'class_name', false],
                ['Section', 'section', false],
                ['Phone', 'phone', false],
                ['Email', 'email', false],
              ].map(([label, key]) => (
                <View key={key}>
                  <Text style={styles.formLabel}>{label}</Text>
                  <TextInput
                    style={styles.formInput}
                    value={form[key]}
                    onChangeText={v => setForm(p => ({ ...p, [key]: v }))}
                    placeholder={label.replace(' *', '')}
                    placeholderTextColor={colors.textMuted}
                    keyboardType={key === 'email' ? 'email-address' : key === 'phone' ? 'phone-pad' : 'default'}
                    autoCapitalize={key === 'email' ? 'none' : 'words'}
                  />
                </View>
              ))}
              <TouchableOpacity style={styles.saveBtn} onPress={addStudent} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>✅ Add Student</Text>}
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.sm },
  back: { color: colors.primary, fontSize: 16, marginRight: spacing.md },
  title: { flex: 1, color: colors.text, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  addBtn: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  search: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text, fontSize: 14 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  avatarText: { fontSize: 20, fontWeight: 'bold' },
  info: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: 'bold', flex: 1 },
  modalClose: { color: colors.textMuted, fontSize: 20, paddingLeft: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { color: colors.textMuted, fontSize: 14 },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'right' },
  formLabel: { color: colors.textMuted, fontSize: 13, marginBottom: 6, marginTop: 14 },
  formInput: { backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text, fontSize: 14 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: spacing.lg },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
