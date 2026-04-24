import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../constants/theme';

const ANDROID_STATUS_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0;

export default function ScreenHeader({ title, onBack, rightLabel, onRight, rightColor, rightIcon }) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'android' ? ANDROID_STATUS_HEIGHT : insets.top;

  return (
    <View style={[styles.wrapper, { paddingTop: topPad }]}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
            <Text style={styles.back}>Back</Text>
          </TouchableOpacity>
        ) : <View style={styles.placeholder} />}
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {rightLabel ? (
          <TouchableOpacity onPress={onRight} style={[styles.rightBtn, { backgroundColor: (rightColor || colors.primary) + '18' }]}>
            {rightIcon && <Ionicons name={rightIcon} size={16} color={rightColor || colors.primary} />}
            <Text style={[styles.rightText, { color: rightColor || colors.primary }]}>{rightLabel}</Text>
          </TouchableOpacity>
        ) : <View style={styles.placeholder} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 60 },
  back: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: fonts.sizes.md,
    fontWeight: '700',
    textAlign: 'center',
    marginHorizontal: spacing.xs,
  },
  rightBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 60,
    justifyContent: 'center',
  },
  rightText: { fontSize: 13, fontWeight: '700' },
  placeholder: { minWidth: 60 },
});
