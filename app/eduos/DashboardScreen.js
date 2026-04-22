import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl, StatusBar, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import NyxionLogo from '../../components/NyxionLogo';
import LoadingScreen from '../../components/LoadingScreen';
import ScreenWrapper from '../../components/ScreenWrapper';

const BASE = 'https://nyxion-eduos-production-63b9.up.railway.app/api/v1';

const StatCard = ({ emoji, label, value, color }) => (
  <View style={[styles.statCard, { borderColor: color + '55' }]}>
    <Text style={styles.statEmoji}>{emoji}</Text>
    <Text style={[styles.statValue, { color }]}>{value ?? '—'}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const MenuItem = ({ emoji, label, color, onPress }) => (
  <TouchableOpacity style={[styles.menuItem, { borderColor: color + '44' }]} onPress={onPress} activeOpacity={0.75}>
    <Text style={styles.menuEmoji}>{emoji}</Text>
    <Text style={styles.menuLabel}>{label}</Text>
  </TouchableOpacity>
);

export default function DashboardScreen({ user, onLogout, navigation }) {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isSuperAdmin = user?.role === 'super_admin';

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
              <Text style={styles.greeting}>Welcome back 👋</Text>
              <Text style={styles.userName}>{user?.full_name || user?.name || 'Admin'}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {user?.school_name && (
          <View style={styles.schoolBanner}>
            <Text style={styles.schoolName}>🏫 {user.school_name}</Text>
            <Text style={styles.schoolRole}>{user.role?.replace('_', ' ').toUpperCase()}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsGrid}>
          {isSuperAdmin && stats.schools !== null && (
            <StatCard emoji="🏫" label="Schools" value={stats.schools} color={colors.accent} />
          )}
          <StatCard emoji="👨‍🎓" label="Students" value={stats.students} color={colors.primary} />
          <StatCard emoji="👨‍🏫" label="Teachers" value={stats.teachers} color="#FF9800" />
          <StatCard emoji="✅" label="Fees Paid" value={stats.feesPaid} color={colors.success} />
          <StatCard emoji="⏳" label="Pending" value={stats.feesPending} color={colors.error} />
        </View>

        {isSuperAdmin && (
          <>
            <Text style={styles.sectionTitle}>Super Admin</Text>
            <View style={styles.menuGrid}>
              <MenuItem emoji="🏫" label="Schools" color={colors.accent} onPress={() => navigation.navigate('Schools')} />
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Manage</Text>
        <View style={styles.menuGrid}>
          <MenuItem emoji="👨‍🎓" label="Students" color={colors.primary} onPress={() => navigation.navigate('Students')} />
          <MenuItem emoji="👨‍🏫" label="Teachers" color="#FF9800" onPress={() => navigation.navigate('Teachers')} />
          <MenuItem emoji="✅" label="Attendance" color={colors.success} onPress={() => navigation.navigate('Attendance')} />
          <MenuItem emoji="💰" label="Fees" color="#9C27B0" onPress={() => navigation.navigate('Fees')} />
          <MenuItem emoji="📚" label="Academics" color={colors.accent} onPress={() => navigation.navigate('Academics')} />
          <MenuItem emoji="📢" label="Notices" color="#00BCD4" onPress={() => navigation.navigate('Notices')} />
          <MenuItem emoji="📊" label="Results" color="#E91E63" onPress={() => navigation.navigate('Results')} />
          <MenuItem emoji="🕐" label="Timetable" color="#FF5722" onPress={() => navigation.navigate('Timetable')} />
          <MenuItem emoji="🤖" label="AI Tools" color={colors.primary} onPress={() => navigation.navigate('AITools')} />
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  topText: {},
  greeting: { color: colors.textMuted, fontSize: fonts.sizes.xs },
  userName: { color: colors.text, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  logoutBtn: { backgroundColor: colors.error + '22', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  logoutText: { color: colors.error, fontSize: 13, fontWeight: '600' },
  schoolBanner: { marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  schoolName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  schoolRole: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  sectionTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '700', paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm, letterSpacing: 1, textTransform: 'uppercase' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, gap: 10 },
  statCard: { width: '47%', backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, alignItems: 'center', borderWidth: 1, marginBottom: 4 },
  statEmoji: { fontSize: 24, marginBottom: 6 },
  statValue: { fontSize: fonts.sizes.xl, fontWeight: 'bold' },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, gap: 12, paddingBottom: spacing.md },
  menuItem: { width: '30%', backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  menuEmoji: { fontSize: 28, marginBottom: 8 },
  menuLabel: { color: colors.text, fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
