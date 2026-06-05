import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
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
      const { session } = await signInWithGoogle();
      setSession(session);

      if (session) {
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
    <View className="flex-1 justify-center bg-slate-50 px-6">
      <View className="w-full max-w-sm self-center">
        <View className="mb-10 items-center">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-lg bg-teal-600">
            <AppText className="text-3xl font-bold text-white">T</AppText>
          </View>
          <AppText className="text-4xl font-bold text-slate-950">TripSync</AppText>
          <AppText className="mt-3 text-center text-base text-slate-600">
            Sign in to plan trips with your group.
          </AppText>
        </View>

        <Pressable
          accessibilityRole="button"
          className="mb-3 h-14 flex-row items-center justify-center rounded-lg border border-slate-300 bg-white px-4"
          disabled={isSubmitting}
          onPress={handleGoogleLogin}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <AppText className="text-base font-semibold text-slate-950">
              Login with Google
            </AppText>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          className="h-14 items-center justify-center rounded-lg bg-emerald-500 px-4"
          disabled={isSubmitting}
          onPress={() => showToast("Line login coming soon")}
        >
          <AppText className="text-base font-semibold text-white">
            Login with Line
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}
