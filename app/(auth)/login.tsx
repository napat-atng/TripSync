import { useState } from "react";
import {
  Alert,
  View,
  StyleSheet,
  ImageBackground,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MapPin } from "lucide-react-native";

import { AppText } from "../../components/AppText";
import { Button } from "../../components/ui/Button";
import { signInWithGoogle } from "../../lib/auth";
import { useAuthStore } from "../../store/authStore";

export default function LoginScreen() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);

  const handleGoogleLogin = async () => {
    try {
      setIsSubmitting(true);
      const result = await signInWithGoogle();

      if (result?.session) {
        setSession(result.session);
        router.replace("/(tabs)/home");
      }
    } catch (error) {
      Alert.alert(
        "เข้าสู่ระบบด้วย Google ไม่สำเร็จ",
        error instanceof Error ? error.message : "กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-surface-950">
      {/* Dynamic Background with Gradient overlay */}
      <View className="absolute inset-0 z-0">
        <LinearGradient
          colors={['#D85A30', '#4A1B0C']}
          style={StyleSheet.absoluteFill}
        />
        <View className="absolute inset-0 bg-black/20" />
      </View>

      <View className="flex-1 justify-between px-6 pb-12 pt-24 z-10">
        
        {/* Top Hero Area */}
        <View className="items-center mt-12">
          <View className="mb-6 h-24 w-24 items-center justify-center rounded-[32px] bg-white">
            <MapPin size={48} color="#D85A30" strokeWidth={2.5} />
          </View>
          <AppText className="text-5xl font-extrabold tracking-tight text-white mb-3">
            TripSync
          </AppText>
          <AppText className="text-center text-lg text-primary-100/90 font-medium px-4">
            วางแผนทริปกลุ่มง่ายๆ{"\n"}ทุกคนรู้ทุกอย่างพร้อมกัน
          </AppText>
        </View>

        {/* Bottom Card Area */}
        <View className="w-full rounded-[32px] bg-white p-8 shadow-2xl" style={styles.cardShadow}>
          <AppText className="text-2xl font-bold text-surface-950 text-center mb-2">
            ยินดีต้อนรับ
          </AppText>
          <AppText className="text-sm text-surface-500 text-center mb-8">
            เข้าสู่ระบบเพื่อเริ่มวางแผนทริปของคุณ
          </AppText>
          
          <Button
            size="lg"
            variant="outline"
            onPress={handleGoogleLogin}
            loading={isSubmitting}
            className="w-full mb-6 border-surface-200"
            textClassName="text-surface-900 font-bold"
          >
            {!isSubmitting && (
              <View className="mr-3 h-6 w-6 items-center justify-center rounded-full bg-surface-100">
                <AppText className="font-bold text-surface-900 text-sm">G</AppText>
              </View>
            )}
            เข้าสู่ระบบด้วย Google
          </Button>

          <AppText className="text-center text-xs leading-5 text-surface-400">
            การเข้าสู่ระบบถือว่าคุณยอมรับ{"\n"}
            <AppText className="text-primary-600 font-semibold">ข้อกำหนดการใช้งาน</AppText> และ{" "}
            <AppText className="text-primary-600 font-semibold">นโยบายความเป็นส่วนตัว</AppText>
          </AppText>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
});
