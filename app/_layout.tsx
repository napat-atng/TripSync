import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";

import "../global.css";

import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/authStore";

function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
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

  useProtectedRoute();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return <Slot />;
}
