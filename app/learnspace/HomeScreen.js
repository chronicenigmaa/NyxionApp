import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../../constants/theme';
import NyxionLogo from '../../components/NyxionLogo';

const MenuItem = ({ icon, label, color, onPress }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.menuIconBox, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon} size={22} color={color} />
    </View>
    <Text style={styles.menuLabel}>{label}</Text>
  </TouchableOpacity>
);

export default function LearnHomeScreen({ user, onNavigate, onLogout }) {
  const isTeacher = user?.role?.toLowerCase() === 'teacher';
  const hasAiAccess = isTeacher || user?.package === 'growth' || user?.package === 'enterprise' || user?.ai_enabled;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View style={styles.topLeft}>
            <NyxionLogo size={40} />
            <View>
              <Text style={styles.greeting}>{isTeacher ? 'Teacher portal' : 'Welcome back'}</Text>
              <Text style={styles.userName}>{user?.name || user?.full_name || 'Student'}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {(user?.class_name || isTeacher) && (
          <View style={styles.infoBanner}>
            <View style={styles.infoBannerLeft}>
              <Ionicons name={isTeacher ? 'school-outline' : 'library-outline'} size={16} color={colors.primary} />
              <Text style={styles.infoText}>{isTeacher ? (user?.assigned_sections?.join(', ') || 'Teacher section') : user.class_name}</Text>
            </View>
            {user.roll_number && (
              <View style={styles.rollPill}>
                <Text style={styles.rollText}>Roll: {user.roll_number}</Text>
              </View>
            )}
          </View>
        )}

        {isTeacher && (
          <View style={styles.teacherBanner}>
            <Text style={styles.teacherBannerTitle}>Teacher workspace</Text>
            <Text style={styles.teacherBannerText}>
              Start with Student Grades to review your assigned learners, then create assignments, notes, exams, or attendance updates.
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Learning Hub</Text>
        <View style={styles.menuGrid}>
          <MenuItem icon="document-text-outline" label="Assignments" color={colors.primary} onPress={() => onNavigate('Assignments')} />
          <MenuItem icon="stats-chart-outline" label={isTeacher ? 'Student Grades' : 'Grades'} color={colors.success} onPress={() => onNavigate('Grades')} />
          <MenuItem icon="checkmark-circle-outline" label="Attendance" color="#0EA5E9" onPress={() => onNavigate('LearnAttendance')} />
          <MenuItem icon="clipboard-outline" label="Exams" color={colors.error} onPress={() => onNavigate('Exams')} />
          <MenuItem icon="journal-outline" label="Notes" color={colors.warning} onPress={() => onNavigate('Notes')} />
          <MenuItem icon="calendar-outline" label="Events" color="#8B5CF6" onPress={() => onNavigate('Events')} />
          {hasAiAccess && <MenuItem icon="sparkles-outline" label="AI Tools" color={colors.primary} onPress={() => onNavigate('LearnAITools')} />}
          {isTeacher && (
            <>
              <MenuItem icon="pencil-outline" label="Create Assignment" color="#0F766E" onPress={() => onNavigate('Assignments', { teacherMode: true })} />
              <MenuItem icon="reader-outline" label="Publish Notes" color="#7C3AED" onPress={() => onNavigate('Notes', { teacherMode: true })} />
              <MenuItem icon="school-outline" label="Create Exam" color="#B91C1C" onPress={() => onNavigate('Exams', { teacherMode: true })} />
              <MenuItem icon="checkmark-done-outline" label="Mark Attendance" color="#0EA5E9" onPress={() => onNavigate('LearnAttendance', { teacherMode: true })} />
            </>
          )}
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greeting: { color: colors.textMuted, fontSize: fonts.sizes.xs },
  userName: { color: colors.text, fontSize: fonts.sizes.md, fontWeight: '700' },
  logoutBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  logoutText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  infoBanner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  rollPill: { backgroundColor: colors.primary + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  rollText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  teacherBanner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.primary + '10',
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary + '20',
  },
  teacherBannerTitle: { color: colors.primary, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  teacherBannerText: { color: colors.text, fontSize: 13, lineHeight: 19 },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: 10,
  },
  menuItem: {
    width: '30%',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  menuIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { color: colors.text, fontSize: 11, fontWeight: '600', textAlign: 'center' },
});
