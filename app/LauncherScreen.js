import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../constants/theme';
import NyxionLogo from '../components/NyxionLogo';

export default function LauncherScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <NyxionLogo size={72} />
        <Text style={styles.title}>Nyxion</Text>
        <Text style={styles.subtitle}>AI-Native Education Platform</Text>
      </View>
      <View style={styles.cards}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('EduLogin')}
          activeOpacity={0.85}
        >
          <View style={[styles.cardIconBox, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="business-outline" size={28} color={colors.primary} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>EduOS</Text>
            <Text style={styles.cardDesc}>School Management System</Text>
            <Text style={styles.cardDescSub}>Students · Attendance · Fees · AI Exams</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.primary + '12' }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>Admin Portal</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.chevron} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('LearnLogin')}
          activeOpacity={0.85}
        >
          <View style={[styles.cardIconBox, { backgroundColor: colors.success + '15' }]}>
            <Ionicons name="book-outline" size={28} color={colors.success} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Learnspace</Text>
            <Text style={styles.cardDesc}>Student Learning Portal</Text>
            <Text style={styles.cardDescSub}>Courses · Assignments · Progress</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.success + '12' }]}>
            <Text style={[styles.badgeText, { color: colors.success }]}>Student Portal</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.chevron} />
        </TouchableOpacity>
      </View>
      <Text style={styles.footer}>Pakistan's First AI-Native School OS</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  header: { alignItems: 'center', marginBottom: spacing.xxl },
  title: {
    color: colors.text,
    fontSize: fonts.sizes.xxl,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: spacing.md,
  },
  subtitle: { color: colors.textMuted, fontSize: fonts.sizes.sm, marginTop: 4 },
  cards: { gap: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: fonts.sizes.md, fontWeight: '700', marginBottom: 2 },
  cardDesc: { color: colors.textMuted, fontSize: 13 },
  cardDescSub: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  chevron: { marginLeft: 4 },
  footer: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl, fontSize: 12 },
});
