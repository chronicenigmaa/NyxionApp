import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, ActivityIndicator, Alert,
} from 'react-native';
import { eduos } from '../../services/api';
import { colors, spacing, fonts } from '../../constants/theme';

export default function AIExamsScreen({ onBack }) {
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState('10');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const generate = async () => {
    if (!subject || !topic) return Alert.alert('Required', 'Please enter subject and topic');
    setLoading(true); setResult(null);
    try {
      const data = await eduos.post('/ai/generate-exam', {
        subject, topic, num_questions: parseInt(numQuestions),
      });
      setResult(data);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>AI Exam Generator</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🤖 Generate Exam</Text>
          <Text style={styles.label}>Subject</Text>
          <TextInput style={styles.input} value={subject} onChangeText={setSubject}
            placeholder="e.g. Mathematics" placeholderTextColor={colors.textMuted} />
          <Text style={styles.label}>Topic</Text>
          <TextInput style={styles.input} value={topic} onChangeText={setTopic}
            placeholder="e.g. Algebra, Fractions" placeholderTextColor={colors.textMuted} />
          <Text style={styles.label}>Number of Questions</Text>
          <TextInput style={styles.input} value={numQuestions} onChangeText={setNumQuestions}
            keyboardType="numeric" placeholderTextColor={colors.textMuted} />
          <TouchableOpacity style={styles.btn} onPress={generate} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>✨ Generate Exam</Text>}
          </TouchableOpacity>
        </View>
        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.cardTitle}>📝 Generated Exam</Text>
            <Text style={styles.resultText}>
              {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.sm },
  back: { color: colors.primary, fontSize: 16, marginRight: spacing.md },
  title: { flex: 1, color: colors.text, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: spacing.md },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text, fontSize: 14 },
  btn: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 20 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  resultCard: { backgroundColor: '#16112E', borderRadius: 16, padding: spacing.lg, borderWidth: 1, borderColor: colors.primary + '55' },
  resultText: { color: colors.text, fontSize: 13, lineHeight: 20 },
});
