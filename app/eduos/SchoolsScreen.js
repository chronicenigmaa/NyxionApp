import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, Modal, ScrollView, TextInput,
  Alert, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import LoadingScreen from '../../components/LoadingScreen';
import ErrorScreen from '../../components/ErrorScreen';
import ScreenWrapper from '../../components/ScreenWrapper';

const BASE = 'https://nyxion-eduos-production-63b9.up.railway.app/api/v1';

export default function SchoolsScreen({ navigation }) {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', code: '', address: '', phone: '', email: '', package: 'starter',
  });
  const [editing, setEditing] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setError(null);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${BASE}/schools`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed');
      setSchools(Array.isArray(data) ? data : data.schools || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const addSchool = async () => {
    if (!form.name || !form.code) return Alert.alert('Required', 'Name and code are required');
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${BASE}/schools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to add school');
      Alert.alert('✅ Added', `${form.name} added successfully`);
      setShowAdd(false);
      setForm({ name: '', code: '', address: '', phone: '', email: '', package: 'starter' });
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const updateSchool = async () => {
    if (!selected || !selected.name || !selected.code) return Alert.alert('Required', 'Name and code are required');
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${BASE}/schools/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: selected.name,
          code: selected.code,
          address: selected.address,
          phone: selected.phone,
          email: selected.email,
          package: selected.package,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to update school');
      Alert.alert('✅ Updated', `${selected.name} updated successfully`);
      setEditing(false);
      setSelected(null);
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const deleteSchool = async () => {
    if (!selected) return;
    Alert.alert('Confirm Delete', `Delete ${selected.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setSaving(true);
        try {
          const token = await AsyncStorage.getItem('token');
          const res = await fetch(`${BASE}/schools/${selected.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) throw new Error('Failed to delete school');
          Alert.alert('Deleted', `${selected.name} has been removed.`);
          setSelected(null);
          load();
        } catch (e) { Alert.alert('Error', e.message); }
        finally { setSaving(false); }
      } },
    ]);
  };

  if (loading) return <LoadingScreen message="Loading schools..." />;
  if (error) return <ErrorScreen message={error} onRetry={load} />;

  const packageColor = p => p === 'growth' ? colors.success : p === 'enterprise' ? colors.accent : colors.primary;

  return (
    <ScreenWrapper>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Schools</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={schools}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.8}>
            <View style={styles.schoolIcon}>
              <Text style={styles.schoolIconText}>{item.name?.[0]?.toUpperCase()}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.sub}>Code: {item.code}</Text>
              {item.address && <Text style={styles.sub}>📍 {item.address}</Text>}
            </View>
            <View style={[styles.packageBadge, { backgroundColor: packageColor(item.package) + '22' }]}>
              <Text style={[styles.packageText, { color: packageColor(item.package) }]}>
                {item.package?.toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No schools found</Text>}
      />

      {/* View School Modal */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => { setSelected(null); setEditing(false); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? `Edit ${selected?.name}` : selected?.name}</Text>
              <TouchableOpacity onPress={() => { setSelected(null); setEditing(false); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {editing ? (
                <>
                  {[
                    ['School Name *', 'name', 'default'],
                    ['School Code *', 'code', 'default'],
                    ['Address', 'address', 'default'],
                    ['Phone', 'phone', 'phone-pad'],
                    ['Email', 'email', 'email-address'],
                  ].map(([label, key, kb]) => (
                    <View key={key}>
                      <Text style={styles.formLabel}>{label}</Text>
                      <TextInput
                        style={styles.formInput}
                        value={selected?.[key] || ''}
                        onChangeText={v => setSelected(prev => ({ ...prev, [key]: v }))}
                        placeholder={label.replace(' *', '')}
                        placeholderTextColor={colors.textMuted}
                        keyboardType={kb}
                        autoCapitalize={key === 'email' ? 'none' : 'words'}
                      />
                    </View>
                  ))}
                  <Text style={styles.formLabel}>Package</Text>
                  <View style={styles.packageRow}>
                    {['starter', 'growth', 'enterprise'].map(p => (
                      <TouchableOpacity
                        key={p}
                        style={[styles.packageOption, selected?.package === p && styles.packageOptionActive]}
                        onPress={() => setSelected(prev => ({ ...prev, package: p }))}
                      >
                        <Text style={[styles.packageOptionText, selected?.package === p && styles.packageOptionTextActive]}>
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity style={styles.saveBtn} onPress={updateSchool} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>✅ Save Changes</Text>}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {[
                    ['Code', selected?.code],
                    ['Package', selected?.package?.toUpperCase()],
                    ['Address', selected?.address],
                    ['Phone', selected?.phone],
                    ['Email', selected?.email],
                    ['Status', selected?.is_active ? '✅ Active' : '❌ Inactive'],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <View key={label} style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{label}</Text>
                      <Text style={styles.detailValue}>{value}</Text>
                    </View>
                  ))}
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => setEditing(true)}>
                      <Text style={styles.actionBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={deleteSchool}>
                      <Text style={[styles.actionBtnText, styles.deleteBtnText]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add School Modal */}
      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add School</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {[
                ['School Name *', 'name', 'default'],
                ['School Code *', 'code', 'default'],
                ['Address', 'address', 'default'],
                ['Phone', 'phone', 'phone-pad'],
                ['Email', 'email', 'email-address'],
              ].map(([label, key, kb]) => (
                <View key={key}>
                  <Text style={styles.formLabel}>{label}</Text>
                  <TextInput
                    style={styles.formInput}
                    value={form[key]}
                    onChangeText={v => setForm(p => ({ ...p, [key]: v }))}
                    placeholder={label.replace(' *', '')}
                    placeholderTextColor={colors.textMuted}
                    keyboardType={kb}
                    autoCapitalize={key === 'email' ? 'none' : 'words'}
                  />
                </View>
              ))}
              <Text style={styles.formLabel}>Package</Text>
              <View style={styles.packageRow}>
                {['starter', 'growth', 'enterprise'].map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.packageOption, form.package === p && styles.packageOptionActive]}
                    onPress={() => setForm(prev => ({ ...prev, package: p }))}
                  >
                    <Text style={[styles.packageOptionText, form.package === p && styles.packageOptionTextActive]}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.saveBtn} onPress={addSchool} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>✅ Add School</Text>}
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  headerTitle: { flex: 1, color: colors.text, fontSize: fonts.sizes.lg, fontWeight: 'bold', textAlign: 'center' },
  addBtn: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  schoolIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary + '33', alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  schoolIconText: { color: colors.primary, fontSize: 20, fontWeight: 'bold' },
  info: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  packageBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  packageText: { fontSize: 11, fontWeight: '700' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: 'bold', flex: 1 },
  modalClose: { color: colors.textMuted, fontSize: 20, paddingLeft: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { color: colors.textMuted, fontSize: 14 },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  formLabel: { color: colors.textMuted, fontSize: 13, marginBottom: 6, marginTop: 14 },
  formInput: { backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text, fontSize: 14 },
  packageRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  packageOption: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  packageOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  packageOptionText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  packageOptionTextActive: { color: '#fff' },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: spacing.lg },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg },
  actionBtn: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginRight: 10 },
  actionBtnText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  deleteBtn: { backgroundColor: colors.danger || '#E63946', borderColor: colors.danger || '#E63946', marginRight: 0, marginLeft: 10 },
  deleteBtnText: { color: '#fff' },
});
