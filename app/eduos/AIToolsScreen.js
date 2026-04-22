import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, ActivityIndicator, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';

const BASE = 'https://nyxion-eduos-production-63b9.up.railway.app/api/v1';

const TOOLS = [
  { id: 'generate', label: '📝 Exam Generator', endpoint: '/ai/generate', fields: ['subject', 'topic', 'num_questions'] },
  { id: 'homework', label: '📚 Homework Generator', endpoint: '/ai/homework-generator', fields: ['subject', 'topic', 'class_name'] },
  { id: 'chatbot', label: '🤖 AI Chatbot', endpoint: '/ai/chatbot', fields: ['message'] },
  { id: 'analyse', label: '🔍 Exam Analysis', endpoint: '/ai/exam-analysis', fields: ['exam_id'] },
];

export default function AIToolsScreen({ navigation }) {
  const [activeTool, setActiveTool] = useState(null);
  const [inputs, setInputs] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    if (!activeTool) return;
    setLoading(true); setResult(null);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${BASE}${activeTool.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(inputs),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'AI request failed');
      setResult(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>AI Tools</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.toolGrid}>
          {TOOLS.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[styles.toolBtn, activeTool?.id === t.id && styles.toolBtnActive]}
              onPress={() => { setActiveTool(t); setInputs({}); setResult(null); }}
            >
              <Text style={styles.toolLabel}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {activeTool && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{activeTool.label}</Text>
            {activeTool.fields.map(f => (
              <View key={f}>
                <Text style={styles.label}>{f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</Text>
                <TextInput
                  style={styles.input}
                  value={inputs[f] || ''}
                  onChangeText={v => setInputs(p => ({ ...p, [f]: v }))}
                  placeholder={`Enter ${f.replace(/_/g, ' ')}...`}
                  placeholderTextColor={colors.textMuted}
                  keyboardType={f === 'num_questions' ? 'numeric' : 'default'}
                  multiline={f === 'message'}
                />
              </View>
            ))}
            <TouchableOpacity style={styles.btn} onPress={run} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>✨ Run</Text>}
            </TouchableOpacity>
          </View>
        )}
        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Result</Text>
            <Text style={styles.resultText}>{result}</Text>
          </View>
        )}
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
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.md },
  toolBtn: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  toolBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
  toolLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: spacing.md },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text, fontSize: 14, minHeight: 44 },
  btn: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: spacing.md },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  resultCard: { backgroundColor: '#16112E', borderRadius: 16, padding: spacing.lg, borderWidth: 1, borderColor: colors.primary + '55' },
  resultTitle: { color: colors.primary, fontSize: 14, fontWeight: '700', marginBottom: spacing.sm },
  resultText: { color: colors.text, fontSize: 13, lineHeight: 20 },
});
