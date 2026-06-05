import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  ToastAndroid,
  View,
} from "react-native";
import { router } from "expo-router";

import { AppText } from "../../components/AppText";
import { signInWithGoogle } from "../../lib/auth";
import { useAuthStore } from "../../store/authStore";

function showToast(message: string) {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }

  Alert.alert("TripSync", message);
}

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
        "Google login failed",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-slate-50">
      {/* Top gradient hero area */}
      <View className="flex-1 items-center justify-end pb-10">
        <View className="mb-5 h-20 w-20 items-center justify-center rounded-2xl bg-teal-600" style={styles.logoShadow}>
          <AppText className="text-4xl font-bold text-white">T</AppText>
        </View>
        <AppText className="text-4xl font-extrabold tracking-tight text-slate-900">
          TripSync
        </AppText>
        <AppText className="mt-2 text-center text-base leading-6 text-slate-500">
          Plan group trips together.{"\n"}Keep everyone in sync.
        </AppText>
      </View>

      {/* Bottom button area */}
      <View className="px-6 pb-14 pt-4">
        <View className="w-full max-w-sm self-center">
          {/* Google Login */}
          <Pressable
            accessibilityRole="button"
            className="mb-3 h-14 flex-row items-center justify-center rounded-xl border border-slate-200 bg-white px-4"
            disabled={isSubmitting}
            onPress={handleGoogleLogin}
            style={styles.buttonShadow}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <>
                <AppText className="mr-3 text-lg">G</AppText>
                <AppText className="text-base font-semibold text-slate-800">
                  Continue with Google
                </AppText>
              </>
            )}
          </Pressable>

          {/* Line Login (stub) */}
          <Pressable
            accessibilityRole="button"
            className="h-14 flex-row items-center justify-center rounded-xl bg-[#06C755] px-4"
            disabled={isSubmitting}
            onPress={() => showToast("Line login coming soon")}
            style={styles.buttonShadow}
          >
            <AppText className="mr-3 text-lg font-bold text-white">L</AppText>
            <AppText className="text-base font-semibold text-white">
              Continue with Line
            </AppText>
          </Pressable>

          {/* Terms / footer */}
          <AppText className="mt-6 text-center text-xs leading-5 text-slate-400">
            By continuing, you agree to TripSync's{"\n"}Terms of Service and
            Privacy Policy.
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  logoShadow: {
    shadowColor: "#0f766e",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
});
