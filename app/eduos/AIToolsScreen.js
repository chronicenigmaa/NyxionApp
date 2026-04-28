import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';

const BASE = 'https://nyxion-eduos-production-63b9.up.railway.app/api/v1';

const TOOLS = [
  { id: 'generate', label: 'Exam Generator', endpoint: '/ai/generate', fields: ['subject', 'topic', 'num_questions'] },
  { id: 'homework', label: 'Homework Generator', endpoint: '/ai/homework-generator', fields: ['subject', 'topic', 'class_name', 'num_questions'] },
  { id: 'chatbot', label: 'AI Chatbot', endpoint: '/ai/chatbot', fields: ['message'] },
];

export default function AIToolsScreen({ navigation }) {
  const [activeTool, setActiveTool] = useState(TOOLS[0]);
  const [inputs, setInputs] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    if (!activeTool) return;
    setLoading(true);
    setResult(null);
    try {
      const token = await AsyncStorage.getItem('token');
      let res;
      if (activeTool.id === 'generate') {
        res = await fetch(`${BASE}${activeTool.endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            type: 'exam',
            prompt: `Generate ${inputs.num_questions || 5} exam questions for subject "${inputs.subject || 'General'}" on topic "${inputs.topic || 'General'}". Format clearly with marks and question numbers.`,
          }),
        });
      } else if (activeTool.id === 'homework') {
        const query = new URLSearchParams({
          subject: inputs.subject || '',
          topic: inputs.topic || '',
          class_name: inputs.class_name || '',
          num_questions: String(Number(inputs.num_questions || 5)),
        });
        res = await fetch(`${BASE}${activeTool.endpoint}?${query.toString()}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        res = await fetch(`${BASE}${activeTool.endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ message: inputs.message }),
        });
      }
      const success = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(success.detail || success.message || `HTTP ${res.status}`);

      const normalizedResult =
        typeof success === 'string'
          ? success
          : success.result || success.response || success.output || success.message || JSON.stringify(success, null, 2);
      setResult(normalizedResult);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>AI Tools</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.helperText}>Pick a tool, enter the required inputs, and the app will try the production-compatible AI endpoint variants for you.</Text>
        <View style={styles.toolGrid}>
          {TOOLS.map((tool) => (
            <TouchableOpacity
              key={tool.id}
              style={[styles.toolBtn, activeTool?.id === tool.id && styles.toolBtnActive]}
              onPress={() => { setActiveTool(tool); setInputs({}); setResult(null); }}
            >
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.sm },
  back: { color: colors.primary, fontSize: 16, marginRight: spacing.md },
  title: { flex: 1, color: colors.text, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  helperText: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.md },
  toolBtn: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  toolBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '15' },
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
