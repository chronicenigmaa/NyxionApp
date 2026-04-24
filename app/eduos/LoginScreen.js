import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, ActivityIndicator, Alert, ScrollView, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import NyxionLogo from '../../components/NyxionLogo';

const BASE = 'https://nyxion-eduos-production-63b9.up.railway.app/api/v1';

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('admin@tcs.edu.pk');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

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

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) return Alert.alert('Required', 'Enter your email');
    setForgotLoading(true);
    try {
      const res = await fetch(`${BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Password reset failed');
      Alert.alert('Check Email', data.message || 'Password reset instruction sent.');
      setForgotMode(false);
      setForgotEmail('');
    } catch (e) {
      Alert.alert('Forgot Password Failed', e.message);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <NyxionLogo size={72} />
          <Text style={styles.title}>EduOS</Text>
          <Text style={styles.subtitle}>School Management System</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={colors.textMuted}
            placeholder="admin@school.edu"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={colors.textMuted}
            placeholder="Enter your password"
          />

          <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Sign In</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setForgotMode(true)}>
            <Text style={styles.link}>Forgot password?</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>Demo: admin@tcs.edu.pk / admin123</Text>
        </View>
      </ScrollView>

      <Modal visible={forgotMode} animationType="slide" transparent onRequestClose={() => setForgotMode(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Forgot Password</Text>
            <Text style={styles.modalText}>Enter your email and we’ll send reset instructions.</Text>
            <TextInput
              style={styles.input}
              value={forgotEmail}
              onChangeText={setForgotEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="Email address"
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity style={styles.btn} onPress={handleForgotPassword} disabled={forgotLoading}>
              {forgotLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send Reset Link</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setForgotMode(false)} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { alignItems: 'center', marginBottom: spacing.xxl },
  title: { color: colors.text, fontSize: fonts.sizes.xl, fontWeight: '800', marginTop: spacing.md, letterSpacing: 0.5 },
  subtitle: { color: colors.textMuted, fontSize: fonts.sizes.sm, marginTop: 4 },
  form: {},
  label: { color: colors.text, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: spacing.md },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    color: colors.text,
    fontSize: 15,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { color: colors.primary, fontSize: 13, textAlign: 'center', marginTop: spacing.md, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: spacing.sm },
  modalOverlay: { flex: 1, backgroundColor: '#00000099', justifyContent: 'center', padding: spacing.lg },
  modalCard: { backgroundColor: colors.surface, borderRadius: 20, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  modalTitle: { color: colors.text, fontSize: fonts.sizes.lg, fontWeight: '800', marginBottom: spacing.sm },
  modalText: { color: colors.textMuted, fontSize: 14, marginBottom: spacing.md, lineHeight: 20 },
  modalCloseBtn: { alignItems: 'center', marginTop: spacing.md },
  modalCloseText: { color: colors.textMuted, fontSize: 14 },
});
