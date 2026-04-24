import React from 'react';
import { StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';

export default function ScreenWrapper({ children, style }) {
  return (
    <SafeAreaView style={[styles.container, style]} edges={['top', 'bottom']}>
      <StatusBar backgroundColor={colors.background} barStyle="dark-content" translucent={false} />
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
