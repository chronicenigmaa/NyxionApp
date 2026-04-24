import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Modal, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import LoadingScreen from '../../components/LoadingScreen';
import ErrorScreen from '../../components/ErrorScreen';

const BASE = 'https://nyxion-eduos-production-63b9.up.railway.app/api/v1';

export default function FeesScreen({ navigation }) {
  const [fees, setFees] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ student_name: '', roll_number: '', month: '', year: '', amount: '', due_date: '', remarks: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setError(null);
    try {
      const token = await AsyncStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const [feesRes, summaryRes] = await Promise.all([
        fetch(`${BASE}/fees/`, { headers }),
        fetch(`${BASE}/fees/summary`, { headers }),
      ]);
      const feesData = await feesRes.json();
      const summaryData = await summaryRes.json();
      if (!feesRes.ok) throw new Error(feesData.detail || 'Failed');
      setFees(Array.isArray(feesData) ? feesData : []);
      setSummary(summaryData);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const markAsPaid = async (fee) => {
    setUpdating(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${BASE}/fees/${fee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paid_amount: fee.amount, status: 'paid', remarks: 'Marked as paid via app' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to update');
      Alert.alert('✅ Updated', 'Fee marked as paid');
      setSelected(null);
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setUpdating(false); }
  };

  const addFee = async () => {
    if (!form.student_name || !form.amount) return Alert.alert('Required', 'Student name and amount are required');
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${BASE}/fees/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          student_name: form.student_name,
          roll_number: form.roll_number,
          month: form.month,
          year: form.year,
          amount: Number(form.amount),
          due_date: form.due_date,
          remarks: form.remarks,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to create fee');
      Alert.alert('✅ Added', 'Fee record created successfully');
      setShowAdd(false);
      setForm({ student_name: '', roll_number: '', month: '', year: '', amount: '', due_date: '', remarks: '' });
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const deleteFee = async () => {
    if (!selected) return;
    Alert.alert('Confirm Delete', `Delete fee for ${selected.student_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setSaving(true);
        try {
          const token = await AsyncStorage.getItem('token');
          const res = await fetch(`${BASE}/fees/${selected.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) throw new Error('Failed to delete fee');
          Alert.alert('Deleted', 'Fee record removed');
          setSelected(null);
          load();
        } catch (e) { Alert.alert('Error', e.message); }
        finally { setSaving(false); }
      } },
    ]);
  };

  if (loading) return <LoadingScreen message="Loading fees..." />;
  if (error) return <ErrorScreen message={error} onRetry={load} />;

  const displayed = filter === 'all' ? fees : fees.filter(f => f.status === filter);
  const statusColor = s => s === 'paid' ? colors.success : s === 'overdue' ? colors.error : '#FF9800';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Fees</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {summary && (
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderColor: colors.success + '55' }]}>
            <Text style={[styles.summaryVal, { color: colors.success }]}>{summary.paid}</Text>
            <Text style={styles.summaryLbl}>Paid</Text>
            <Text style={styles.summaryAmt}>Rs. {summary.collected?.toLocaleString()}</Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: '#FF980055' }]}>
            <Text style={[styles.summaryVal, { color: '#FF9800' }]}>{summary.pending}</Text>
            <Text style={styles.summaryLbl}>Pending</Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: colors.error + '55' }]}>
            <Text style={[styles.summaryVal, { color: colors.error }]}>{summary.overdue}</Text>
            <Text style={styles.summaryLbl}>Overdue</Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: colors.primary + '55' }]}>
            <Text style={[styles.summaryVal, { color: colors.primary }]}>{summary.total}</Text>
            <Text style={styles.summaryLbl}>Total</Text>
          </View>
        </View>
      )}

      <View style={styles.filterRow}>
        {['all', 'paid', 'pending', 'overdue'].map(f => (
          <TouchableOpacity key={f} style={[styles.filterBtn, filter === f && styles.filterBtnActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={displayed}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.8}>
            <View style={styles.info}>
              <Text style={styles.studentName}>{item.student_name}</Text>
              <Text style={styles.sub}>Roll: {item.roll_number}</Text>
              <Text style={styles.sub}>{item.month} {item.year} · Rs. {item.amount?.toLocaleString()}</Text>
              {item.paid_amount > 0 && item.status !== 'paid' && (
                <Text style={styles.partial}>Partial: Rs. {item.paid_amount?.toLocaleString()}</Text>
              )}
            </View>
            <View style={[styles.badge, { backgroundColor: statusColor(item.status) + '22' }]}>
              <Text style={{ color: statusColor(item.status), fontSize: 12, fontWeight: '700' }}>
                {item.status?.toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No fee records found</Text>}
      />

      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Fee</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {[
                ['Student Name *', 'student_name'],
                ['Roll Number', 'roll_number'],
                ['Month', 'month'],
                ['Year', 'year'],
                ['Amount *', 'amount'],
                ['Due Date', 'due_date'],
                ['Remarks', 'remarks'],
              ].map(([label, key]) => (
                <View key={key}>
                  <Text style={styles.formLabel}>{label}</Text>
                  <TextInput
                    style={styles.formInput}
                    value={form[key]}
                    onChangeText={v => setForm(prev => ({ ...prev, [key]: v }))}
                    placeholder={label.replace(' *', '')}
                    placeholderTextColor={colors.textMuted}
                    keyboardType={key === 'amount' ? 'numeric' : 'default'}
                    autoCapitalize={key === 'student_name' ? 'words' : 'none'}
                  />
                </View>
              ))}
              <TouchableOpacity style={styles.saveBtn} onPress={addFee} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Create Fee'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selected?.student_name}</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {[
                ['Roll Number', selected?.roll_number],
                ['Month', `${selected?.month} ${selected?.year}`],
                ['Amount', `Rs. ${selected?.amount?.toLocaleString()}`],
                ['Paid', `Rs. ${selected?.paid_amount?.toLocaleString() ?? 0}`],
                ['Status', selected?.status?.toUpperCase()],
                ['Due Date', selected?.due_date?.split('T')[0]],
                ['Remarks', selected?.remarks],
              ].filter(([, v]) => v).map(([label, value]) => (
                <View key={label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue}>{value}</Text>
                </View>
              ))}
              {selected?.status !== 'paid' && (
                <TouchableOpacity
                  style={styles.payBtn}
                  onPress={() => markAsPaid(selected)}
                  disabled={updating}
                >
                  {updating
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.payBtnText}>✅ Mark as Paid</Text>}
                </TouchableOpacity>
              )}
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
  summaryRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: 8, marginBottom: spacing.sm },
  summaryCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: spacing.sm, alignItems: 'center', borderWidth: 1 },
  summaryVal: { fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  summaryLbl: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  summaryAmt: { color: colors.textMuted, fontSize: 9, marginTop: 1 },
  filterRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: 6, marginBottom: spacing.sm, flexWrap: 'wrap' },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  info: { flex: 1 },
  studentName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  partial: { color: '#FF9800', fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: 'bold', flex: 1 },
  modalClose: { color: colors.textMuted, fontSize: 20, paddingLeft: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { color: colors.textMuted, fontSize: 14 },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  payBtn: { backgroundColor: colors.success, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xl },
  payBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  addBtn: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  formLabel: { color: colors.textMuted, fontSize: 13, marginBottom: 6, marginTop: 14 },
  formInput: { backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text, fontSize: 14 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: spacing.lg },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
