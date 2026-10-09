import * as ExpoNotifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// Configure how notifications appear when app is in foreground
ExpoNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permission and save the Expo push token
 * to the current user's row in public.users.
 * Safe to call multiple times — skips silently if already registered
 * or if running on simulator/web.
 */
export async function registerPushToken(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log("[notifications] Skipping push token — not a physical device");
    return null;
  }

  if (Platform.OS === "android") {
    await ExpoNotifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: ExpoNotifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0f766e",
    });
  }

  const { status: existingStatus } = await ExpoNotifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await ExpoNotifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[notifications] Permission not granted");
    return null;
  }

  const tokenData = await ExpoNotifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
  });
  const token = tokenData.data;

  // Persist to DB — upsert so re-installs update the token
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await (supabase as any)
      .from("users")
      .update({ push_token: token })
      .eq("id", user.id);
  }

  return token;
}

/**
 * Send an immediate local notification (useful for testing
 * or for in-app events where the user is active).
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  await ExpoNotifications.scheduleNotificationAsync({
    content: { title, body, data: data ?? {} },
    trigger: null, // fire immediately
  });
}

/**
 * Call the send-notification Edge Function to push a notification
 * to one or more users (by their user IDs in public.users).
 */
export async function sendPushNotification(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (userIds.length === 0) return;

  const { error } = await (supabase as any).functions.invoke("send-notification", {
    body: { userIds, title, body, data: data ?? {} },
  });

  if (error) {
    // Log but don't throw — notification failure should never block the main action
    console.warn("[notifications] Failed to send push:", error.message);
  }
}

/**
 * Get the user_id of the trip leader (for notifying after member joins, etc.)
 */
export async function getLeaderUserId(tripId: string): Promise<string | null> {
  const { data } = await (supabase as any)
    .from("trip_members")
    .select("user_id")
    .eq("trip_id", tripId)
    .eq("role", "leader")
    .single();

  return data?.user_id ?? null;
}

/**
 * Get user_ids of all trip members who have accounts (user_id not null)
 * excluding a specific member (e.g. the one triggering the action)
 */
export async function getMemberUserIds(
  tripId: string,
  excludeUserId?: string | null,
): Promise<string[]> {
  const { data } = await (supabase as any)
    .from("trip_members")
    .select("user_id")
    .eq("trip_id", tripId)
    .not("user_id", "is", null);

  return (data ?? [])
    .map((m: any) => m.user_id as string)
    .filter((id: string) => id !== excludeUserId);
}
