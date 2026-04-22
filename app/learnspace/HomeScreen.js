import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { colors, spacing, fonts } from '../../constants/theme';
import NyxionLogo from '../../components/NyxionLogo';

const MenuItem = ({ emoji, label, color, onPress }) => (
  <TouchableOpacity style={[styles.menuItem, { borderColor: color + '44' }]} onPress={onPress} activeOpacity={0.75}>
    <Text style={styles.menuEmoji}>{emoji}</Text>
    <Text style={styles.menuLabel}>{label}</Text>
  </TouchableOpacity>
);

export default function LearnHomeScreen({ user, onNavigate, onLogout }) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View style={styles.topLeft}>
            <NyxionLogo size={40} />
            <View>
              <Text style={styles.greeting}>Welcome back 👋</Text>
              <Text style={styles.userName}>{user?.name || user?.full_name || 'Student'}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
        {user?.class_name && (
          <View style={styles.infoBanner}>
            <Text style={styles.infoText}>📚 {user.class_name}</Text>
            {user.roll_number && <Text style={styles.infoText}>Roll: {user.roll_number}</Text>}
          </View>
        )}
        <Text style={styles.sectionTitle}>Learning Hub</Text>
        <View style={styles.menuGrid}>
          <MenuItem emoji="📝" label="Assignments" color={colors.primary} onPress={() => onNavigate('Assignments')} />
          <MenuItem emoji="📊" label="Grades" color={colors.success} onPress={() => onNavigate('Grades')} />
          <MenuItem emoji="✅" label="Attendance" color={colors.accent} onPress={() => onNavigate('LearnAttendance')} />
          <MenuItem emoji="📋" label="Exams" color={colors.error} onPress={() => onNavigate('Exams')} />
          <MenuItem emoji="📓" label="Notes" color="#FF9800" onPress={() => onNavigate('Notes')} />
          <MenuItem emoji="📅" label="Events" color="#9C27B0" onPress={() => onNavigate('Events')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greeting: { color: colors.textMuted, fontSize: fonts.sizes.xs },
  userName: { color: colors.text, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  logoutBtn: { backgroundColor: colors.error + '22', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  logoutText: { color: colors.error, fontSize: 13, fontWeight: '600' },
  infoBanner: { marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  infoText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  sectionTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '700', paddingHorizontal: spacing.lg, marginBottom: spacing.sm, letterSpacing: 1, textTransform: 'uppercase' },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, gap: 12, paddingBottom: spacing.xxl },
  menuItem: { width: '30%', backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  menuEmoji: { fontSize: 28, marginBottom: 8 },
  menuLabel: { color: colors.text, fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
