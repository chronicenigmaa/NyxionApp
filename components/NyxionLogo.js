import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect, Circle } from 'react-native-svg';

export default function NyxionLogo({ size = 60 }) {
  const dots = [
    { cx: 22, cy: 78, opacity: 0.2 },
    { cx: 36, cy: 64, opacity: 0.4 },
    { cx: 36, cy: 78, opacity: 0.4 },
    { cx: 50, cy: 50, opacity: 0.6 },
    { cx: 50, cy: 64, opacity: 0.6 },
    { cx: 50, cy: 78, opacity: 0.6 },
    { cx: 64, cy: 36, opacity: 0.8 },
    { cx: 64, cy: 50, opacity: 0.8 },
    { cx: 64, cy: 64, opacity: 0.8 },
    { cx: 64, cy: 78, opacity: 0.8 },
    { cx: 78, cy: 22, opacity: 1 },
    { cx: 78, cy: 36, opacity: 1 },
    { cx: 78, cy: 50, opacity: 1 },
    { cx: 78, cy: 64, opacity: 1 },
    { cx: 78, cy: 78, opacity: 1 },
  ];
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect width="100" height="100" rx="22" fill="#080808" />
      {dots.map((d, i) => (
        <Circle key={i} cx={d.cx} cy={d.cy} r="4" fill="#FFFFFF" opacity={d.opacity} />
      ))}
    </Svg>
  );
}
