import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput, RefreshControl, Modal, ScrollView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import LoadingScreen from '../../components/LoadingScreen';
import ErrorScreen from '../../components/ErrorScreen';
import ScreenWrapper from '../../components/ScreenWrapper';
import SelectField from '../../components/SelectField';

const BASE = 'https://nyxion-eduos-production-63b9.up.railway.app/api/v1';

export default function TeachersScreen({ navigation }) {
  const [teachers, setTeachers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', subject: '', qualification: '', class_name: '', section: '', salary: '', password: '' });
  const subjectOptions = ['Math', 'Science', 'English', 'Urdu', 'History', 'Computer'];
  const classOptions = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const sectionOptions = ['A', 'B', 'C', 'D', 'E'];
  const subjectDropdown = subjectOptions.map(option => ({ label: option, value: option }));
  const classDropdown = classOptions.map(option => ({ label: `Class ${option}`, value: option }));
  const sectionDropdown = sectionOptions.map(option => ({ label: `Section ${option}`, value: option }));

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

  const submitTeacher = async () => {
    if (!form.full_name || !form.email) return Alert.alert('Required', 'Name and email are required');
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      const res = await fetch(`${BASE}/teachers/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to add teacher');
      Alert.alert('✅ Added', `${form.full_name} added successfully`);
      setShowAdd(false);
      setForm({ full_name: '', email: '', subject: '', qualification: '', class_name: '', section: '', salary: '', password: '' });
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const updateTeacher = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const payload = {
        full_name: selected.full_name,
        email: selected.email,
        subject: selected.subject,
        qualification: selected.qualification,
        class_name: selected.class_name,
        section: selected.section,
        salary: selected.salary,
      };
      if (selected.password) payload.password = selected.password;
      const res = await fetch(`${BASE}/teachers/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to update teacher');
      Alert.alert('✅ Updated', `${selected.full_name} updated successfully`);
      setSelected(null);
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const deleteTeacher = async () => {
    if (!selected) return;
    Alert.alert('Confirm Delete', `Delete ${selected.full_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setSaving(true);
        try {
          const token = await AsyncStorage.getItem('token');
          const res = await fetch(`${BASE}/teachers/${selected.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.detail || 'Failed to delete teacher');
          }
          Alert.alert('Deleted', `${selected.full_name} has been removed.`);
          setSelected(null);
          load();
        } catch (e) { Alert.alert('Error', e.message); }
        finally { setSaving(false); }
      } },
    ]);
  };

  if (loading) return <LoadingScreen message="Loading teachers..." />;
  if (error) return <ErrorScreen message={error} onRetry={load} />;

  return (
    <ScreenWrapper style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Teachers</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>
      <TextInput style={styles.search} placeholder="Search name, subject..." placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} />
      <FlatList
        data={filtered} keyExtractor={i => i.id} contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.8}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.full_name?.[0]?.toUpperCase() || '?'}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.full_name}</Text>
              <Text style={styles.sub}>📖 {item.subject || 'N/A'}</Text>
              <Text style={styles.sub}>🎓 {item.qualification || 'N/A'}</Text>
              <Text style={styles.sub}>✉️ {item.email || 'N/A'}</Text>
              {(item.class_name || item.section) && <Text style={styles.sub}>Class: {item.class_name || '—'}{item.section ? ` - ${item.section}` : ''}</Text>}
              {item.salary ? <Text style={styles.sub}>💰 Rs. {item.salary}</Text> : null}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No teachers found</Text>}
      />

      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Teacher</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {[
                ['Full Name *', 'full_name'],
                ['Email *', 'email'],
                ['Password', 'password'],
                ['Subject', 'subject'],
                ['Qualification', 'qualification'],
                ['Class', 'class_name'],
                ['Section', 'section'],
                ['Salary', 'salary'],
              ].map(([label, key]) => (
                <View key={key}>
                  <Text style={styles.formLabel}>{label}</Text>
                  {key === 'subject' ? (
                    <SelectField
                      label=""
                      value={form.subject}
                      onChange={v => setForm(p => ({ ...p, subject: v }))}
                      options={subjectDropdown}
                      placeholder="Select subject"
                    />
                  ) : key === 'class_name' ? (
                    <SelectField
                      label=""
                      value={form.class_name}
                      onChange={v => setForm(p => ({ ...p, class_name: v }))}
                      options={classDropdown}
                      placeholder="Select class"
                    />
                  ) : key === 'section' ? (
                    <SelectField
                      label=""
                      value={form.section}
                      onChange={v => setForm(p => ({ ...p, section: v }))}
                      options={sectionDropdown}
                      placeholder="Select section"
                    />
                  ) : (
                    <TextInput
                      style={styles.formInput}
                      value={form[key]}
                      onChangeText={v => setForm(p => ({ ...p, [key]: v }))}
                      placeholder={label.replace(' *', '')}
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize={key === 'email' || key === 'password' ? 'none' : 'words'}
                      keyboardType={key === 'email' ? 'email-address' : key === 'salary' ? 'numeric' : 'default'}
                      secureTextEntry={key === 'password'}
                    />
                  )}
                </View>
              ))}
              <TouchableOpacity style={styles.saveBtn} onPress={submitTeacher} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Teacher'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selected?.full_name}</Text>
              <TouchableOpacity onPress={() => setSelected(null)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {[
                ['Name *', 'full_name', 'default'],
                ['Email *', 'email', 'email-address'],
                ['Password', 'password', 'default'],
                ['Subject', 'subject', 'default'],
                ['Qualification', 'qualification', 'default'],
                ['Class', 'class_name', 'default'],
                ['Section', 'section', 'default'],
                ['Salary', 'salary', 'numeric'],
              ].map(([label, key, keyboardType]) => (
                <View key={key}>
                  <Text style={styles.formLabel}>{label}</Text>
                  {key === 'subject' ? (
                    <SelectField
                      label=""
                      value={selected?.subject}
                      onChange={v => setSelected(prev => ({ ...prev, subject: v }))}
                      options={subjectDropdown}
                      placeholder="Select subject"
                    />
                  ) : key === 'class_name' ? (
                    <SelectField
                      label=""
                      value={selected?.class_name}
                      onChange={v => setSelected(prev => ({ ...prev, class_name: v }))}
                      options={classDropdown}
                      placeholder="Select class"
                    />
                  ) : key === 'section' ? (
                    <SelectField
                      label=""
                      value={selected?.section}
                      onChange={v => setSelected(prev => ({ ...prev, section: v }))}
                      options={sectionDropdown}
                      placeholder="Select section"
                    />
                  ) : (
                    <TextInput
                      style={styles.formInput}
                      value={selected?.[key] ? String(selected?.[key]) : ''}
                      onChangeText={v => setSelected(prev => ({ ...prev, [key]: v }))}
                      placeholder={label.replace(' *', '')}
                      placeholderTextColor={colors.textMuted}
                      keyboardType={keyboardType}
                      autoCapitalize={key === 'email' || key === 'password' ? 'none' : 'words'}
                      secureTextEntry={key === 'password'}
                    />
                  )}
                </View>
              ))}
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.editBtn} onPress={updateTeacher} disabled={saving}>
                  <Text style={styles.editBtnText}>{saving ? 'Saving…' : 'Update'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={deleteTeacher} disabled={saving}>
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
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
  addBtn: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: 'bold', flex: 1 },
  modalClose: { color: colors.textMuted, fontSize: 20, paddingLeft: 12 },
  formLabel: { color: colors.textMuted, fontSize: 13, marginBottom: 6, marginTop: 14 },
  formInput: { backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text, fontSize: 14 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: spacing.lg },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { color: colors.textMuted, fontSize: 14 },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'right' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: spacing.lg },
  editBtn: { flex: 1, backgroundColor: colors.success, borderRadius: 12, padding: 14, alignItems: 'center' },
  editBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  deleteBtn: { flex: 1, backgroundColor: colors.error, borderRadius: 12, padding: 14, alignItems: 'center' },
  deleteBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
