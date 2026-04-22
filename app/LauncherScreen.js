import React from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, StatusBar, SafeAreaView,
} from 'react-native';
import { colors, spacing, fonts } from '../constants/theme';
import NyxionLogo from '../components/NyxionLogo';

export default function LauncherScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <NyxionLogo size={72} />
        <Text style={styles.title}>Nyxion</Text>
        <Text style={styles.subtitle}>AI-Native Education Platform</Text>
      </View>
      <View style={styles.cards}>
        <TouchableOpacity
          style={[styles.card, styles.cardEduos]}
          onPress={() => navigation.navigate('EduLogin')}
          activeOpacity={0.85}
        >
          <Text style={styles.cardEmoji}>🏫</Text>
          <Text style={styles.cardTitle}>EduOS</Text>
          <Text style={styles.cardDesc}>School Management System</Text>
          <Text style={styles.cardDescSub}>Students · Attendance · Fees · AI Exams</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Admin Portal</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.card, styles.cardLearn]}
          onPress={() => navigation.navigate('LearnLogin')}
          activeOpacity={0.85}
        >
          <Text style={styles.cardEmoji}>📚</Text>
          <Text style={styles.cardTitle}>Learnspace</Text>
          <Text style={styles.cardDesc}>Student Learning Portal</Text>
          <Text style={styles.cardDescSub}>Courses · Assignments · Progress</Text>
          <View style={[styles.badge, styles.badgeAlt]}>
            <Text style={[styles.badgeText, { color: colors.accent }]}>Student Portal</Text>
          </View>
        </TouchableOpacity>
      </View>
      <Text style={styles.footer}>Pakistan's First AI-Native School OS</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.background,
    paddingHorizontal: spacing.lg, justifyContent: 'center',
  },
  header: { alignItems: 'center', marginBottom: spacing.xxl },
  title: {
    color: colors.text, fontSize: fonts.sizes.xxl,
    fontWeight: 'bold', letterSpacing: 2, marginTop: spacing.md,
  },
  subtitle: { color: colors.textMuted, fontSize: fonts.sizes.sm, marginTop: 4 },
  cards: {},
  card: {
    borderRadius: 20, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: 16,
  },
  cardEduos: { backgroundColor: '#16112E' },
  cardLearn: { backgroundColor: '#0F1E2E' },
  cardEmoji: { fontSize: 32, marginBottom: 8 },
  cardTitle: { color: colors.text, fontSize: fonts.sizes.xl, fontWeight: 'bold', marginBottom: 4 },
  cardDesc: { color: colors.textMuted, fontSize: fonts.sizes.sm },
  cardDescSub: { color: colors.textMuted, fontSize: fonts.sizes.sm, marginBottom: 4 },
  badge: {
    marginTop: 12, alignSelf: 'flex-start',
    backgroundColor: colors.primary + '33',
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20,
  },
  badgeAlt: { backgroundColor: colors.accent + '22' },
  badgeText: { color: colors.primaryLight, fontSize: 12, fontWeight: '600' },
  footer: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl, fontSize: 12 },
});
