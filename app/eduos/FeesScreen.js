import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Modal, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import LoadingScreen from '../../components/LoadingScreen';
import ErrorScreen from '../../components/ErrorScreen';
import ScreenWrapper from '../../components/ScreenWrapper';
import SelectField from '../../components/SelectField';
import { eduos } from '../../services/api';

const BASE = 'https://nyxion-eduos-production-63b9.up.railway.app/api/v1';
const MONTH_OPTIONS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
].map((month) => ({ label: month, value: month }));
const YEAR_OPTIONS = ['2024', '2025', '2026', '2027', '2028'].map((year) => ({ label: year, value: year }));
const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({ label: String(i + 1), value: String(i + 1).padStart(2, '0') }));
const DUE_MONTH_OPTIONS = [
  { label: 'Jan', value: '01' },
  { label: 'Feb', value: '02' },
  { label: 'Mar', value: '03' },
  { label: 'Apr', value: '04' },
  { label: 'May', value: '05' },
  { label: 'Jun', value: '06' },
  { label: 'Jul', value: '07' },
  { label: 'Aug', value: '08' },
  { label: 'Sep', value: '09' },
  { label: 'Oct', value: '10' },
  { label: 'Nov', value: '11' },
  { label: 'Dec', value: '12' },
];

const EMPTY_FORM = {
  student_id: '',
  student_name: '',
  roll_number: '',
  month: '',
  year: '2026',
  amount: '',
  due_date: '',
  remarks: '',
  status: 'pending',
  paid_amount: '',
};

export default function FeesScreen({ navigation }) {
  const [fees, setFees] = useState([]);
  const [students, setStudents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [feeForm, setFeeForm] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [datePicker, setDatePicker] = useState({ open: false, field: 'form' });
  const [datePickerValue, setDatePickerValue] = useState({ day: '01', month: '01', year: '2026' });

  useEffect(() => { load(); }, []);

  const studentOptions = useMemo(
    () => students.map((student) => ({
      label: `${student.full_name}${student.roll_number ? ` • ${student.roll_number}` : ''}`,
      value: String(student.id),
    })),
    [students]
  );

  const statusOptions = [
    { label: 'Pending', value: 'pending' },
    { label: 'Paid', value: 'paid' },
    { label: 'Not Paid', value: 'not_paid' },
    { label: 'Overdue', value: 'overdue' },
    { label: 'Defaulter', value: 'defaulter' },
  ];

  const load = async () => {
    setError(null);
    try {
      const token = await AsyncStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const [feesRes, summaryRes, studentsRes] = await Promise.all([
        fetch(`${BASE}/fees/`, { headers }),
        fetch(`${BASE}/fees/summary`, { headers }),
        fetch(`${BASE}/students/`, { headers }),
      ]);
      const feesData = await feesRes.json();
      const summaryData = await summaryRes.json();
      const studentsData = await studentsRes.json();
      if (!feesRes.ok) throw new Error(feesData.detail || 'Failed to load fees');
      if (!summaryRes.ok) throw new Error(summaryData.detail || 'Failed to load fee summary');
      if (!studentsRes.ok) throw new Error(studentsData.detail || 'Failed to load students');
      setFees(Array.isArray(feesData) ? feesData : feesData.items || []);
      setSummary(summaryData);
      setStudents(Array.isArray(studentsData) ? studentsData : studentsData.items || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const syncStudentFields = (studentId, setter) => {
    const student = students.find((item) => String(item.id) === String(studentId));
    setter((prev) => ({
      ...prev,
      student_id: studentId,
      student_name: student?.full_name || '',
      roll_number: student?.roll_number || '',
    }));
  };

  const parseDateParts = (value) => {
    if (!value) {
      const now = new Date();
      return {
        day: String(now.getDate()).padStart(2, '0'),
        month: String(now.getMonth() + 1).padStart(2, '0'),
        year: String(now.getFullYear()),
      };
    }
    const [year, month, day] = value.split('-');
    return {
      day: String(day || '01').padStart(2, '0'),
      month: String(month || '01').padStart(2, '0'),
      year: String(year || '2026'),
    };
  };

  const openDatePicker = (field) => {
    const currentValue = field === 'form' ? form.due_date : feeForm?.due_date;
    const dateParts = parseDateParts(currentValue);
    setDatePickerValue(dateParts);
    setDatePicker({ open: true, field });
  };

  const confirmDatePicker = () => {
    const dueDate = `${datePickerValue.year}-${datePickerValue.month}-${datePickerValue.day}`;
    if (datePicker.field === 'form') {
      setForm((prev) => ({ ...prev, due_date: dueDate }));
    } else {
      setFeeForm((prev) => ({ ...(prev || {}), due_date: dueDate }));
    }
    setDatePicker((prev) => ({ ...prev, open: false }));
  };

  const markAsPaid = async (fee) => {
    setUpdating(true);
    try {
      await eduos.patch(`/fees/${fee.id}`, { paid_amount: fee.amount, status: 'paid', remarks: 'Marked as paid via app' });
      Alert.alert('Updated', 'Fee marked as paid');
      setSelected(null);
      setFeeForm(null);
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setUpdating(false); }
  };

  const handleSelectFee = (fee) => {
    setSelected(fee);
    setFeeForm({
      student_id: String(fee.student_id || ''),
      student_name: fee.student_name || '',
      roll_number: fee.roll_number || '',
      month: fee.month || '',
      year: fee.year != null ? String(fee.year) : '',
      amount: fee.amount != null ? String(fee.amount) : '',
      paid_amount: fee.paid_amount != null ? String(fee.paid_amount) : '',
      status: fee.status || 'pending',
      due_date: fee.due_date || '',
      remarks: fee.remarks || '',
    });
  };

  const updateFee = async () => {
    if (!selected) return;
    if (!feeForm?.amount || !feeForm?.student_name) return Alert.alert('Required', 'Student and amount are required');
    setUpdating(true);
    try {
      await eduos.patch(`/fees/${selected.id}`, {
        student_id: feeForm.student_id || undefined,
        student_name: feeForm.student_name,
        roll_number: feeForm.roll_number,
        month: feeForm.month,
        year: feeForm.year ? Number(feeForm.year) : undefined,
        amount: Number(feeForm.amount),
        paid_amount: feeForm.paid_amount ? Number(feeForm.paid_amount) : 0,
        status: feeForm.status,
        due_date: feeForm.due_date,
        remarks: feeForm.remarks,
      });
      Alert.alert('Updated', 'Fee record updated successfully');
      setSelected(null);
      setFeeForm(null);
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setUpdating(false); }
  };

  const addFee = async () => {
    if (!form.student_name || !form.amount) return Alert.alert('Required', 'Student and amount are required');
    setSaving(true);
    try {
      await eduos.post('/fees', {
        student_id: form.student_id || undefined,
        student_name: form.student_name,
        roll_number: form.roll_number,
        month: form.month,
        year: form.year ? Number(form.year) : undefined,
        amount: Number(form.amount),
        paid_amount: form.paid_amount ? Number(form.paid_amount) : 0,
        status: form.status,
        due_date: form.due_date,
        remarks: form.remarks,
      });
      Alert.alert('Added', 'Fee record created successfully');
      setShowAdd(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const deleteFee = async () => {
    if (!selected?.id) return;
    Alert.alert('Confirm Delete', `Delete fee record for ${selected.student_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setUpdating(true);
          try {
            await eduos.delete(`/fees/${selected.id}`);
            Alert.alert('Deleted', 'Fee record removed successfully');
            setSelected(null);
            setFeeForm(null);
            load();
          } catch (e) { Alert.alert('Error', e.message); }
          finally { setUpdating(false); }
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen message="Loading fees..." />;
  if (error) return <ErrorScreen message={error} onRetry={load} />;

  const displayed = filter === 'all' ? fees : fees.filter(fee => fee.status === filter);
  const statusColor = (status) => status === 'paid' ? colors.success : status === 'defaulter' ? colors.error : status === 'overdue' ? colors.error : status === 'not_paid' ? colors.primary : '#FF9800';

  return (
    <ScreenWrapper style={styles.container}>
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
            <Text style={styles.summaryAmt}>Rs. {summary.collected?.toLocaleString?.() ?? summary.collected}</Text>
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
        {['all', 'paid', 'pending', 'overdue', 'not_paid', 'defaulter'].map((item) => (
          <TouchableOpacity key={item} style={[styles.filterBtn, filter === item && styles.filterBtnActive]} onPress={() => setFilter(item)}>
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>
              {item === 'not_paid' ? 'Not Paid' : item === 'defaulter' ? 'Defaulter' : item.charAt(0).toUpperCase() + item.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={displayed}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => handleSelectFee(item)} activeOpacity={0.8}>
            <View style={styles.info}>
              <Text style={styles.studentName}>{item.student_name}</Text>
              <Text style={styles.sub}>Roll: {item.roll_number || 'N/A'}</Text>
              <Text style={styles.sub}>{item.month} {item.year} · Rs. {item.amount?.toLocaleString?.() ?? item.amount}</Text>
              {item.paid_amount > 0 && item.status !== 'paid' ? <Text style={styles.partial}>Partial: Rs. {item.paid_amount?.toLocaleString?.() ?? item.paid_amount}</Text> : null}
            </View>
            <View style={[styles.badge, { backgroundColor: statusColor(item.status) + '22' }]}>
              <Text style={{ color: statusColor(item.status), fontSize: 12, fontWeight: '700' }}>{item.status?.toUpperCase()}</Text>
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
              <SelectField
                label="Student Name *"
                value={form.student_id}
                onChange={(value) => syncStudentFields(value, setForm)}
                options={studentOptions}
                placeholder="Select student"
              />
              <SelectField
                label="Roll Number"
                value={form.student_id}
                onChange={(value) => syncStudentFields(value, setForm)}
                options={studentOptions.map((option) => ({ label: option.label.split(' • ')[1] || option.label, value: option.value }))}
                placeholder="Select roll number"
              />
              <SelectField label="Month" value={form.month} onChange={(value) => setForm((prev) => ({ ...prev, month: value }))} options={MONTH_OPTIONS} placeholder="Select month" />
              <SelectField label="Year" value={form.year} onChange={(value) => setForm((prev) => ({ ...prev, year: value }))} options={YEAR_OPTIONS} placeholder="Select year" />
              <Text style={styles.formLabel}>Amount *</Text>
              <TextInput style={styles.formInput} value={form.amount} onChangeText={(value) => setForm((prev) => ({ ...prev, amount: value }))} placeholder="Amount" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
              <Text style={styles.formLabel}>Due Date</Text>
              <TouchableOpacity onPress={() => openDatePicker('form')} style={styles.formInput}>
                <Text style={[styles.triggerText, !form.due_date && styles.placeholderText]}>{form.due_date || 'Pick due date'}</Text>
              </TouchableOpacity>
              <Text style={styles.formLabel}>Status</Text>
              <SelectField label="Status" value={form.status} onChange={(value) => setForm((prev) => ({ ...prev, status: value }))} options={statusOptions} placeholder="Select status" />
              <Text style={styles.formLabel}>Remarks</Text>
              <TextInput style={[styles.formInput, styles.multiline]} value={form.remarks} onChangeText={(value) => setForm((prev) => ({ ...prev, remarks: value }))} placeholder="Remarks" placeholderTextColor={colors.textMuted} multiline />
              <TouchableOpacity style={styles.saveBtn} onPress={addFee} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Create Fee'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => { setSelected(null); setFeeForm(null); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selected?.student_name}</Text>
              <TouchableOpacity onPress={() => { setSelected(null); setFeeForm(null); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.infoBanner}>Update the fee details below or delete the record if it was created by mistake.</Text>
              <SelectField
                label="Student Name"
                value={feeForm?.student_id}
                onChange={(value) => syncStudentFields(value, setFeeForm)}
                options={studentOptions}
                placeholder="Select student"
              />
              <SelectField label="Month" value={feeForm?.month} onChange={(value) => setFeeForm((prev) => ({ ...prev, month: value }))} options={MONTH_OPTIONS} placeholder="Select month" />
              <SelectField label="Year" value={feeForm?.year} onChange={(value) => setFeeForm((prev) => ({ ...prev, year: value }))} options={YEAR_OPTIONS} placeholder="Select year" />
              <Text style={styles.formLabel}>Roll Number</Text>
              <Text style={styles.detailValue}>{feeForm?.roll_number || 'N/A'}</Text>
              <Text style={styles.formLabel}>Amount</Text>
              <TextInput style={styles.formInput} value={feeForm?.amount || ''} onChangeText={(value) => setFeeForm((prev) => ({ ...prev, amount: value }))} placeholder="Amount" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
              <Text style={styles.formLabel}>Paid Amount</Text>
              <TextInput style={styles.formInput} value={feeForm?.paid_amount || ''} onChangeText={(value) => setFeeForm((prev) => ({ ...prev, paid_amount: value }))} placeholder="Paid amount" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
              <SelectField label="Status" value={feeForm?.status} onChange={(value) => setFeeForm((prev) => ({ ...prev, status: value }))} options={statusOptions} placeholder="Select status" />
              <Text style={styles.formLabel}>Due Date</Text>
              <TouchableOpacity onPress={() => openDatePicker('feeForm')} style={styles.formInput}>
                <Text style={[styles.triggerText, !feeForm?.due_date && styles.placeholderText]}>{feeForm?.due_date || 'Pick due date'}</Text>
              </TouchableOpacity>
              <Text style={styles.formLabel}>Remarks</Text>
              <TextInput style={[styles.formInput, styles.multiline]} value={feeForm?.remarks || ''} onChangeText={(value) => setFeeForm((prev) => ({ ...prev, remarks: value }))} placeholder="Remarks" placeholderTextColor={colors.textMuted} multiline />
              <TouchableOpacity style={styles.saveBtn} onPress={updateFee} disabled={updating}>
                <Text style={styles.saveBtnText}>{updating ? 'Updating...' : 'Update Fee'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.error, marginTop: spacing.sm }]} onPress={deleteFee} disabled={updating}>
                <Text style={styles.saveBtnText}>{updating ? 'Working...' : 'Delete Fee'}</Text>
              </TouchableOpacity>
              {selected?.status !== 'paid' ? (
                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.success, marginTop: spacing.sm }]} onPress={() => markAsPaid(selected)} disabled={updating}>
                  <Text style={styles.saveBtnText}>{updating ? 'Updating...' : 'Mark as Paid'}</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={datePicker.open} animationType="slide" transparent onRequestClose={() => setDatePicker((prev) => ({ ...prev, open: false }))}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Due Date</Text>
              <TouchableOpacity onPress={() => setDatePicker((prev) => ({ ...prev, open: false }))}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <SelectField label="Day" value={datePickerValue.day} onChange={(value) => setDatePickerValue((prev) => ({ ...prev, day: value }))} options={DAY_OPTIONS} placeholder="Day" />
              <SelectField label="Month" value={datePickerValue.month} onChange={(value) => setDatePickerValue((prev) => ({ ...prev, month: value }))} options={DUE_MONTH_OPTIONS} placeholder="Month" />
              <SelectField label="Year" value={datePickerValue.year} onChange={(value) => setDatePickerValue((prev) => ({ ...prev, year: value }))} options={YEAR_OPTIONS} placeholder="Year" />
              <TouchableOpacity style={styles.saveBtn} onPress={confirmDatePicker}>
                <Text style={styles.saveBtnText}>Save Date</Text>
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
  summaryRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: 8, marginBottom: spacing.sm },
  summaryCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: spacing.sm, alignItems: 'center', borderWidth: 1 },
  summaryVal: { fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  summaryLbl: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  summaryAmt: { color: colors.textMuted, fontSize: 9, marginTop: 1, textAlign: 'center' },
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
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '86%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: 'bold', flex: 1 },
  modalClose: { color: colors.textMuted, fontSize: 20, paddingLeft: 12 },
  addBtn: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  formLabel: { color: colors.textMuted, fontSize: 13, marginBottom: 6, marginTop: 14 },
  formInput: { backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text, fontSize: 14 },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 4 },
  infoBanner: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: spacing.sm },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: spacing.lg },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  triggerText: { color: colors.text, fontSize: 14 },
  placeholderText: { color: colors.textMuted },
});
