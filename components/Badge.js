import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function Badge({ label, color = '#6C63FF' }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '33' }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  text: { fontSize: 12, fontWeight: '600' },
});
