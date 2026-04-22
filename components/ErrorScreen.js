import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing } from '../constants/theme';

export default function ErrorScreen({ message, onRetry }) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>⚠️</Text>
      <Text style={styles.message}>{message || 'Something went wrong'}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.btn} onPress={onRetry}>
          <Text style={styles.btnText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
    padding: spacing.xl,
  },
  emoji: { fontSize: 48, marginBottom: 16 },
  message: { color: colors.textMuted, fontSize: 16, textAlign: 'center', marginBottom: 24 },
  btn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
  },
  btnText: { color: '#fff', fontWeight: '600' },
});
