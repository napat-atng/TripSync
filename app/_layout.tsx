import { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ActivityIndicator, AppState, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import * as ExpoNotifications from "expo-notifications";

import "../global.css";

import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/authStore";
import { registerPushToken } from "../lib/notifications";

function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const isJoinRoute = (segments[0] as string) === "join";

    if (!session && !inAuthGroup && !isJoinRoute) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)/home");
    }
  }, [session, segments, isLoading, router]);
}

export default function RootLayout() {
  const setSession = useAuthStore((state) => state.setSession);
  const setIsLoading = useAuthStore((state) => state.setIsLoading);
  const isLoading = useAuthStore((state) => state.isLoading);
  const session = useAuthStore((state) => state.session);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setSession, setIsLoading]);

  useEffect(() => {
    if (!session) return;
    registerPushToken().catch((err) =>
      console.warn("[layout] registerPushToken failed:", err),
    );
  }, [session?.user?.id]);

  useEffect(() => {
    notificationListener.current =
      ExpoNotifications.addNotificationReceivedListener((notification) => {
        console.log("[notifications] Received:", notification.request.content.title);
      });

    responseListener.current =
      ExpoNotifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as any;
        if (data?.tripId) {
          setTimeout(() => {
            try {
              const { router } = require("expo-router");
              router.push(`/trips/${data.tripId}/dashboard`);
            } catch {
            }
          }, 500);
        }
      });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  useProtectedRoute();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-50">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#ffffff" },
          headerTintColor: "#0f172a",
          headerTitleStyle: { fontWeight: "700", fontSize: 17 },
          headerShadowVisible: false,
          headerBackTitle: "กลับ",
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: "#f8fafc" },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ title: "โปรไฟล์", headerBackTitle: "กลับ" }} />
        <Stack.Screen name="join/[token]" options={{ title: "เข้าร่วมทริป", headerBackTitle: "กลับ" }} />
        <Stack.Screen name="trips/create" options={{ title: "สร้างทริปใหม่", headerBackTitle: "กลับ" }} />
        <Stack.Screen name="trips/[id]/dashboard" options={{ headerBackTitle: "หน้าแรก" }} />
        <Stack.Screen name="trips/[id]/availability" options={{ title: "วันว่างของฉัน", headerBackTitle: "กลับ" }} />
        <Stack.Screen name="trips/[id]/suggest" options={{ title: "AI แนะนำจุดหมาย", headerBackTitle: "กลับ" }} />
        <Stack.Screen name="trips/[id]/expenses" options={{ title: "ค่าใช้จ่าย", headerBackTitle: "กลับ" }} />
        <Stack.Screen name="trips/[id]/expenses/add" options={{ title: "เพิ่มค่าใช้จ่าย", headerBackTitle: "กลับ" }} />
        <Stack.Screen name="trips/[id]/expenses/settle" options={{ title: "เคลียร์หนี้", headerBackTitle: "กลับ" }} />
        <Stack.Screen name="trips/[id]/survey/builder" options={{ title: "แก้ไขแบบสอบถาม", headerBackTitle: "กลับ" }} />
        <Stack.Screen name="trips/[id]/survey/respond" options={{ title: "แบบสอบถาม", headerBackTitle: "กลับ" }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
