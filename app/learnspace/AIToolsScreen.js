import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';

const BASE = 'https://nyxion-learnspace-production.up.railway.app/api/v1';
const TOOLS = [
  { id: 'chatbot', label: 'AI Chatbot', endpoints: ['/ai/chatbot'], fields: ['message'] },
  { id: 'generate', label: 'Exam Generator', endpoints: ['/ai/generate-exam', '/ai/generate'], fields: ['subject', 'topic', 'num_questions'] },
  { id: 'homework', label: 'Homework Generator', endpoints: ['/ai/homework-generator'], fields: ['subject', 'topic', 'class_name'] },
  { id: 'analyse', label: 'Exam Analysis', endpoints: ['/ai/exam-analysis'], fields: ['exam_id'] },
];

export default function AIToolsScreen({ navigation }) {
  const [activeTool, setActiveTool] = useState(TOOLS[0]);
  const [inputs, setInputs] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [accessLabel, setAccessLabel] = useState('Available');

  useEffect(() => {
    AsyncStorage.getItem('learn_user').then((raw) => {
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        setAccessLabel((data.package || data.school_package || 'starter').toUpperCase());
      } catch {
        setAccessLabel('AVAILABLE');
      }
    });
  }, []);

  const run = async () => {
    if (!activeTool) return;
    setLoading(true);
    setResult(null);
    try {
      const token = await AsyncStorage.getItem('learn_token');
      let success = null;
      let lastError = 'AI request failed';

      for (const endpoint of activeTool.endpoints) {
        const res = await fetch(`${BASE}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            ...inputs,
            num_questions: inputs.num_questions ? Number(inputs.num_questions) : undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          success = data;
          break;
        }
        lastError = data.detail || data.message || `HTTP ${res.status}`;
      }

      if (!success) throw new Error(lastError);
      setResult(typeof success === 'string' ? success : success.result || success.response || success.output || success.message || JSON.stringify(success, null, 2));
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>AI Tools</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.packageInfo}>
          <Text style={styles.packageLabel}>Access</Text>
          <Text style={styles.packageName}>{accessLabel}</Text>
        </View>
        <Text style={styles.helperText}>These tools now try the supported production endpoint variants instead of failing on one hardcoded route.</Text>
        <View style={styles.toolGrid}>
          {TOOLS.map((tool) => (
            <TouchableOpacity key={tool.id} style={[styles.toolBtn, activeTool?.id === tool.id && styles.toolBtnActive]} onPress={() => { setActiveTool(tool); setInputs({}); setResult(null); }}>
              <Text style={styles.toolLabel}>{tool.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {activeTool ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{activeTool.label}</Text>
            {activeTool.fields.map((field) => (
              <View key={field}>
                <Text style={styles.label}>{field.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())}</Text>
                <TextInput
                  style={[styles.input, field === 'message' && styles.multiline]}
                  value={inputs[field] || ''}
                  onChangeText={(value) => setInputs((prev) => ({ ...prev, [field]: value }))}
                  placeholder={`Enter ${field.replace(/_/g, ' ')}`}
                  placeholderTextColor={colors.textMuted}
                  keyboardType={field === 'num_questions' ? 'numeric' : 'default'}
                  multiline={field === 'message'}
                />
              </View>
            ))}
            <TouchableOpacity style={styles.btn} onPress={run} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Run Tool</Text>}
            </TouchableOpacity>
          </View>
        ) : null}
        {result ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Result</Text>
            <Text style={styles.resultText}>{result}</Text>
          </View>
        ) : null}
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  back: { color: colors.primary, fontSize: 16, marginRight: spacing.md },
  title: { flex: 1, color: colors.text, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  packageInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  packageLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  packageName: { fontSize: 14, color: colors.primary, fontWeight: '800' },
  helperText: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.md },
  toolBtn: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, borderWidth: 1, borderColor: colors.border, flex: 1, minWidth: '45%' },
  toolBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
  toolLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: spacing.md },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text, fontSize: 14, minHeight: 44 },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  btn: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: spacing.md },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  resultCard: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  resultTitle: { color: colors.primary, fontSize: 14, fontWeight: '700', marginBottom: spacing.sm },
  resultText: { color: colors.text, fontSize: 13, lineHeight: 20 },
});
