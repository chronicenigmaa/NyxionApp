import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { colors, spacing, fonts } from '../constants/theme';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0;

export default function ScreenHeader({ title, onBack, rightLabel, onRight, rightColor }) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.back}>Back</Text>
          </TouchableOpacity>
        ) : <View style={styles.placeholder} />}
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {rightLabel ? (
          <TouchableOpacity onPress={onRight} style={[styles.rightBtn, { backgroundColor: (rightColor || colors.primary) + '18' }]}>
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
    paddingTop: STATUSBAR_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  backBtn: { marginRight: spacing.sm },
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
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  rightText: { fontSize: 13, fontWeight: '700' },
  placeholder: { width: 60 },
});
