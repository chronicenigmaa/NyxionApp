import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, StatusBar,
} from 'react-native';
import { colors, spacing, fonts } from '../constants/theme';

export default function ScreenHeader({ title, onBack, rightLabel, onRight, rightColor }) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {rightLabel ? (
          <TouchableOpacity onPress={onRight} style={[styles.rightBtn, { backgroundColor: (rightColor || colors.primary) + '22' }]}>
            <Text style={[styles.rightText, { color: rightColor || colors.primary }]}>{rightLabel}</Text>
          </TouchableOpacity>
        ) : <View style={styles.placeholder} />}
      </View>
    </View>
  );
}

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0;

const styles = StyleSheet.create({
  wrapper: {
    paddingTop: STATUSBAR_HEIGHT,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { marginRight: spacing.sm },
  back: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: fonts.sizes.lg,
    fontWeight: 'bold',
    marginHorizontal: spacing.sm,
  },
  rightBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  rightText: { fontSize: 13, fontWeight: '700' },
  placeholder: { width: 60 },
});
