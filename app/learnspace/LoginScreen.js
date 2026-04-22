import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';

const BASE = 'https://nyxion-learnspace-production.up.railway.app/api/v1';

export default function LearnLoginScreen({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Required', 'Enter email and password');
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Invalid credentials');
      await AsyncStorage.setItem('learn_token', data.access_token);
      onLogin(data);
    } catch (e) {
      Alert.alert('Login Failed', e.message);
    } finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (!name || !email || !password) return Alert.alert('Required', 'Fill all fields');
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role: 'student' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Registration failed');
      Alert.alert('Success', 'Account created! Please login.', [
        { text: 'OK', onPress: () => setMode('login') },
      ]);
    } catch (e) {
      Alert.alert('Registration Failed', e.message);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.logo}><Text style={styles.logoText}>L</Text></View>
          <Text style={styles.title}>Learnspace</Text>
          <Text style={styles.subtitle}>Student Learning Portal</Text>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, mode === 'login' && styles.tabActive]}
            onPress={() => setMode('login')}
          >
            <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'register' && styles.tabActive]}
            onPress={() => setMode('register')}
          >
            <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>Register</Text>
          </TouchableOpacity>
        </View>

        {mode === 'register' && (
          <>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input} value={name} onChangeText={setName}
              placeholder="Your name" placeholderTextColor={colors.textMuted}
            />
          </>
        )}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input} value={email} onChangeText={setEmail}
          keyboardType="email-address" autoCapitalize="none"
          placeholder="your@email.com" placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input} value={password} onChangeText={setPassword}
          secureTextEntry placeholder="••••••••" placeholderTextColor={colors.textMuted}
        />

        <TouchableOpacity
          style={styles.btn}
          onPress={mode === 'login' ? handleLogin : handleRegister}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.btnText}>{mode === 'login' ? 'Sign In' : 'Create Account'}</Text>}
        </TouchableOpacity>

        {mode === 'login' && (
          <Text style={styles.hint}>
            New here? Switch to Register to create an account.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.xl },
  logo: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  logoText: { color: '#000', fontSize: 32, fontWeight: 'bold' },
  title: { color: colors.text, fontSize: fonts.sizes.xl, fontWeight: 'bold' },
  subtitle: { color: colors.textMuted, fontSize: fonts.sizes.sm, marginTop: 4 },
  tabs: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderRadius: 12, padding: 4, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: colors.accent },
  tabText: { color: colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: '#000' },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    padding: 14, color: colors.text, fontSize: 15,
  },
  btn: {
    backgroundColor: colors.accent, borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 28,
  },
  btnText: { color: '#000', fontSize: 16, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 16 },
});
