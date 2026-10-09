import React from "react";
import { Text, type TextProps } from "react-native";

/**
 * AppText — global text wrapper สำหรับ TripSync
 *
 * วิธีกำหนด weight ผ่าน className (NativeWind):
 *   font-normal      → Sarabun_400Regular
 *   font-medium      → Sarabun_500Medium
 *   font-semibold    → Sarabun_700Bold
 *   font-bold        → Sarabun_700Bold
 *   font-extrabold   → Sarabun_700Bold
 *
 * หรือกำหนดผ่าน style prop ก็ได้ เช่น style={{ fontWeight: "700" }}
 * ถ้าไม่กำหนดอะไรเลย → Sarabun_400Regular (default)
 */

const WEIGHT_MAP: Record<string, string> = {
  "100": "Sarabun_400Regular",
  "200": "Sarabun_400Regular",
  "300": "Sarabun_400Regular",
  "400": "Sarabun_400Regular",
  "normal": "Sarabun_400Regular",
  "500": "Sarabun_500Medium",
  "600": "Sarabun_700Bold",
  "700": "Sarabun_700Bold",
  "bold": "Sarabun_700Bold",
  "800": "Sarabun_700Bold",
  "900": "Sarabun_700Bold",
};

// NativeWind class → fontFamily mapping
// เนื่องจาก NativeWind inject fontWeight ผ่าน StyleSheet ภายใน ไม่ได้ expose ตรงๆ
// เราจึง parse className เพื่อหา font weight class แทน
function getFontFamilyFromClassName(className?: string): string {
  if (!className) return "Sarabun_400Regular";
  const classes = className.split(/\s+/);
  for (const cls of classes) {
    switch (cls) {
      case "font-thin":
      case "font-extralight":
      case "font-light":
      case "font-normal":
        return "Sarabun_400Regular";
      case "font-medium":
        return "Sarabun_500Medium";
      case "font-semibold":
      case "font-bold":
      case "font-extrabold":
      case "font-black":
        return "Sarabun_700Bold";
    }
  }
  return "Sarabun_400Regular";
}

function getFontFamilyFromStyle(style: any): string | null {
  if (!style) return null;
  const styleArray = Array.isArray(style) ? style : [style];
  for (const s of styleArray.reverse()) {
    if (!s) continue;
    const weight = s.fontWeight;
    if (weight && WEIGHT_MAP[String(weight)]) {
      return WEIGHT_MAP[String(weight)];
    }
    // ถ้า caller ระบุ fontFamily เองโดยตรง → ใช้ค่านั้น
    if (s.fontFamily) return s.fontFamily;
  }
  return null;
}

export function AppText({ className, style, ...props }: TextProps) {
  // ลำดับ priority: style prop > className > default
  const fontFromStyle = getFontFamilyFromStyle(style);
  const fontFromClass = getFontFamilyFromClassName(className);
  const fontFamily = fontFromStyle ?? fontFromClass;

  return (
    <Text
      className={className}
      style={[{ fontFamily }, ...(Array.isArray(style) ? style : style ? [style] : [])]}
      {...props}
    />
  );
}
