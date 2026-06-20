import { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ActivityIndicator, AppState, View } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
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
      // No session, redirect to login
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      // Has session but in auth group, redirect to home
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
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setSession, setIsLoading]);

  // Register push token once user is logged in
  useEffect(() => {
    if (!session) return;
    registerPushToken().catch((err) =>
      console.warn("[layout] registerPushToken failed:", err),
    );
  }, [session?.user?.id]);

  // Listen for incoming notifications while app is foregrounded
  useEffect(() => {
    notificationListener.current =
      ExpoNotifications.addNotificationReceivedListener((notification) => {
        console.log("[notifications] Received:", notification.request.content.title);
      });

    // Handle notification tap — navigate to relevant screen
    responseListener.current =
      ExpoNotifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as any;
        if (data?.tripId) {
          // Navigate to the trip's dashboard when user taps the notification
          // Use a small delay to ensure the router is ready
          setTimeout(() => {
            try {
              const { router } = require("expo-router");
              router.push(`/trips/${data.tripId}/dashboard`);
            } catch {
              // router might not be ready yet
            }
          }, 500);
        }
      });

    return () => {
      ExpoNotifications.removeNotificationSubscription(notificationListener.current);
      ExpoNotifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  useProtectedRoute();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Slot />
    </GestureHandlerRootView>
  );
}
