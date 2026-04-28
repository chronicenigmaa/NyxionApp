import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import NyxionLogo from '../../components/NyxionLogo';
import LoadingScreen from '../../components/LoadingScreen';
import ScreenWrapper from '../../components/ScreenWrapper';

const BASE = 'https://nyxion-eduos-production-63b9.up.railway.app/api/v1';

const StatCard = ({ icon, label, value, color }) => (
  <View style={[styles.statCard, { borderTopColor: color, borderTopWidth: 3 }]}>
    <View style={[styles.statIconBox, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
    <Text style={[styles.statValue, { color }]}>{value ?? '—'}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const MenuItem = ({ icon, label, color, onPress }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.menuIconBox, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon} size={22} color={color} />
    </View>
    <Text style={styles.menuLabel}>{label}</Text>
  </TouchableOpacity>
);

export default function DashboardScreen({ user, onLogout, navigation }) {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isSuperAdmin = user?.role === 'super_admin';
  const isTeacher = user?.role === 'teacher';

  const fetchJson = async (path) => {
    const token = await AsyncStorage.getItem('token');
    const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  const loadStats = async () => {
    try {
      const results = await Promise.allSettled([
        fetchJson('/students/'),
        fetchJson('/teachers/'),
        fetchJson('/fees/summary'),
        isSuperAdmin ? fetchJson('/schools') : Promise.resolve(null),
      ]);
      const students = results[0].status === 'fulfilled' ? results[0].value : [];
      const teachers = results[1].status === 'fulfilled' ? results[1].value : [];
      const fees = results[2].status === 'fulfilled' ? results[2].value : {};
      const schools = results[3].status === 'fulfilled' ? results[3].value : null;
      setStats({
        students: Array.isArray(students) ? students.length : students.total ?? '—',
        teachers: Array.isArray(teachers) ? teachers.length : teachers.total ?? '—',
        feesPaid: fees.paid ?? '—',
        feesPending: fees.pending ?? '—',
        schools: schools ? (Array.isArray(schools) ? schools.length : schools.total ?? '—') : null,
      });
    } catch { setStats({}); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { loadStats(); }, []);

  if (loading) return <LoadingScreen message="Loading dashboard..." />;

  return (
    <ScreenWrapper>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadStats(); }} tintColor={colors.primary} />}
      >
        <View style={styles.topBar}>
          <View style={styles.topLeft}>
            <NyxionLogo size={40} />
            <View style={styles.topText}>
              <Text style={styles.greeting}>Welcome back</Text>
              <Text style={styles.userName}>{user?.full_name || user?.name || 'Admin'}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {user?.school_name && (
          <View style={styles.schoolBanner}>
            <View style={styles.schoolBannerLeft}>
              <Ionicons name="business-outline" size={16} color={colors.primary} />
              <Text style={styles.schoolName}>{user.school_name}</Text>
            </View>
            <View style={styles.rolePill}>
              <Text style={styles.schoolRole}>{user.role?.replace('_', ' ').toUpperCase()}</Text>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsGrid}>
          {isSuperAdmin && stats.schools !== null && (
            <StatCard icon="business-outline" label="Schools" value={stats.schools} color={colors.accent} />
          )}
          <StatCard icon="people-outline" label="Students" value={stats.students} color={colors.primary} />
          <StatCard icon="person-outline" label="Teachers" value={stats.teachers} color={colors.warning} />
          <StatCard icon="checkmark-circle-outline" label="Fees Paid" value={stats.feesPaid} color={colors.success} />
          <StatCard icon="time-outline" label="Pending" value={stats.feesPending} color={colors.error} />
        </View>

        {isSuperAdmin && (
          <>
            <Text style={styles.sectionTitle}>Super Admin</Text>
            <View style={styles.menuGrid}>
              <MenuItem icon="business-outline" label="Schools" color={colors.accent} onPress={() => navigation.navigate('Schools')} />
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Manage</Text>
        <View style={styles.menuGrid}>
          <MenuItem icon="people-outline" label="Students" color={colors.primary} onPress={() => navigation.navigate('Students')} />
          <MenuItem icon="person-outline" label="Teachers" color={colors.warning} onPress={() => navigation.navigate('Teachers')} />
          {!isTeacher && <MenuItem icon="checkmark-circle-outline" label="Attendance" color={colors.success} onPress={() => navigation.navigate('Attendance')} />}
          {!isTeacher && <MenuItem icon="card-outline" label="Fees" color="#8B5CF6" onPress={() => navigation.navigate('Fees')} />}
          <MenuItem icon="megaphone-outline" label="Notices" color="#06B6D4" onPress={() => navigation.navigate('Notices')} />
          <MenuItem icon="bar-chart-outline" label="Results" color="#F43F5E" onPress={() => navigation.navigate('Results')} />
          <MenuItem icon="time-outline" label="Timetable" color="#F97316" onPress={() => navigation.navigate('Timetable')} />
          <MenuItem icon="sparkles-outline" label="AI Tools" color={colors.primary} onPress={() => navigation.navigate('AITools')} />
        </View>

        <Text style={styles.sectionTitle}>Useful Tip</Text>
        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>Keep admin work in Students and Teachers</Text>
          <Text style={styles.tipText}>
            Student assignment, class setup, and teacher ownership now flow through those two screens so day-to-day tasks are easier to find.
          </Text>
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  topText: {},
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
  schoolBanner: {
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
  schoolBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  schoolName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  rolePill: { backgroundColor: colors.primary + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  schoolRole: { color: colors.primary, fontSize: 11, fontWeight: '700' },
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
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, gap: 10 },
  statCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 4,
  },
  statIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: fonts.sizes.xl, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2, fontWeight: '500' },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: 10,
    paddingBottom: spacing.sm,
  },
  menuItem: {
    width: '30%',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: spacing.sm,
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
  tipCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  tipTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  tipText: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
});
