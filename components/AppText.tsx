import { Text, type TextProps, StyleSheet } from "react-native";

/**
 * AppText — wrapper ที่ใช้ทั่วทั้งแอป
 * inject Sarabun เป็น default font อัตโนมัติ
 * weight map:
 *   font-normal  → Sarabun_400Regular  (default)
 *   font-medium  → Sarabun_500Medium
 *   font-semibold / font-bold / font-extrabold → Sarabun_700Bold
 */

// ฟังก์ชันหา fontFamily ที่ถูกต้องตาม fontWeight ที่มาจาก className
function resolveFontFamily(style: any): string {
  const weight = StyleSheet.flatten(style)?.fontWeight;
  if (weight === "500" || weight === 500) return "Sarabun_500Medium";
  if (
    weight === "600" || weight === 600 ||
    weight === "700" || weight === 700 ||
    weight === "800" || weight === 800 ||
    weight === "900" || weight === 900 ||
    weight === "bold"
  ) return "Sarabun_700Bold";
  return "Sarabun_400Regular";
}

export function AppText({ style, className, ...props }: TextProps) {
  const flatStyle = StyleSheet.flatten(style) ?? {};
  const fontFamily = resolveFontFamily(flatStyle);

  return (
    <Text
      className={className}
      style={[{ fontFamily }, flatStyle]}
      {...props}
    />
  );
}
