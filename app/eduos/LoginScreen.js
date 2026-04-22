import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';

const BASE = 'https://nyxion-eduos-production-63b9.up.railway.app/api/v1';

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('admin@tcs.edu.pk');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Invalid credentials');
      await AsyncStorage.setItem('token', data.access_token);
      await AsyncStorage.setItem('eduos_user', JSON.stringify(data));
      onLogin(data);
    } catch (e) {
      Alert.alert('Login Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <View style={styles.logo}><Text style={styles.logoText}>N</Text></View>
        <Text style={styles.title}>EduOS</Text>
        <Text style={styles.subtitle}>School Management System</Text>
      </View>
      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input} value={email} onChangeText={setEmail}
        keyboardType="email-address" autoCapitalize="none"
        placeholderTextColor={colors.textMuted}
      />
      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input} value={password} onChangeText={setPassword}
        secureTextEntry placeholderTextColor={colors.textMuted}
      />
      <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Sign In</Text>}
      </TouchableOpacity>
      <Text style={styles.hint}>Demo: admin@tcs.edu.pk / admin123</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  header: { alignItems: 'center', marginTop: spacing.xxl, marginBottom: spacing.xxl },
  logo: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  logoText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  title: { color: colors.text, fontSize: fonts.sizes.xl, fontWeight: 'bold' },
  subtitle: { color: colors.textMuted, fontSize: fonts.sizes.sm, marginTop: 4 },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    padding: 14, color: colors.text, fontSize: 15,
  },
  btn: {
    backgroundColor: colors.primary, borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 28,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 16 },
});
