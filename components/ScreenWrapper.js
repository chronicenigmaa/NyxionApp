import React from 'react';
import { View, StyleSheet, StatusBar, Platform } from 'react-native';
import { colors } from '../constants/theme';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

export default function ScreenWrapper({ children, style }) {
  return (
    <View style={[styles.container, style]}>
      <StatusBar backgroundColor={colors.background} barStyle="light-content" translucent={false} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: STATUSBAR_HEIGHT,
  },
});
