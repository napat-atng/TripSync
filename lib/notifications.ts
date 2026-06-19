import * as ExpoNotifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// Configure how notifications appear when the app is in foreground
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
 * Request notification permissions and register the Expo push token.
 * Saves the token to public.users.push_token for the logged-in user.
 * Safe to call multiple times — exits early if permission is already granted.
 */
export async function registerPushToken(userId: string): Promise<string | null> {
  // Physical devices only — simulators don't support push
  if (Platform.OS === "web") return null;

  const { status: existingStatus } = await ExpoNotifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await ExpoNotifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    // User declined — don't crash, notifications just won't work
    return null;
  }

  try {
    const tokenData = await ExpoNotifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    // Persist to DB so the Edge Function can look it up
    await (supabase as any)
      .from("users")
      .update({ push_token: token })
      .eq("id", userId);

    return token;
  } catch {
    // getExpoPushTokenAsync() throws on simulators — swallow silently
    return null;
  }
}

// ----------------------------------------------------------------
// Notification triggers — called from action sites in the app.
// Each function resolves the relevant user IDs and invokes the
// send-notification Edge Function.
// ----------------------------------------------------------------

interface TriggerPayload {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

async function sendNotification(payload: TriggerPayload): Promise<void> {
  if (payload.userIds.length === 0) return;
  try {
    await (supabase as any).functions.invoke("send-notification", { body: payload });
  } catch {
    // Notification delivery is best-effort — never block the main action
  }
}

// Resolves trip member user_ids (only logged-in members, not guests)
async function getTripUserIds(tripId: string, excludeUserId?: string): Promise<string[]> {
  const { data } = await (supabase as any)
    .from("trip_members")
    .select("user_id")
    .eq("trip_id", tripId)
    .not("user_id", "is", null);

  return (data ?? [])
    .map((r: any) => r.user_id as string)
    .filter((id: string) => id !== excludeUserId);
}

// Resolves the leader's user_id for a trip
async function getTripLeaderUserId(tripId: string): Promise<string | null> {
  const { data } = await (supabase as any)
    .from("trip_members")
    .select("user_id")
    .eq("trip_id", tripId)
    .eq("role", "leader")
    .not("user_id", "is", null)
    .single();

  return data?.user_id ?? null;
}

// ----------------------------------------------------------------
// Trigger: New member joined the trip
// Notifies: trip leader
// ----------------------------------------------------------------
export async function notifyMemberJoined(
  tripId: string,
  tripName: string,
  newMemberName: string,
): Promise<void> {
  const leaderId = await getTripLeaderUserId(tripId);
  if (!leaderId) return;

  await sendNotification({
    userIds: [leaderId],
    title: "มีสมาชิกใหม่เข้าร่วม!",
    body: `${newMemberName} เข้าร่วมทริป "${tripName}" แล้ว`,
    data: { tripId, screen: "dashboard" },
  });
}

// ----------------------------------------------------------------
// Trigger: All members have responded to the survey
// Notifies: trip leader
// ----------------------------------------------------------------
export async function notifyAllSurveyResponsesComplete(
  tripId: string,
  tripName: string,
  leaderUserId: string,
): Promise<void> {
  await sendNotification({
    userIds: [leaderUserId],
    title: "ทุกคนตอบแบบสอบถามแล้ว!",
    body: `ดูผลสำรวจทริป "${tripName}" ได้เลย`,
    data: { tripId, screen: "dashboard" },
  });
}

// ----------------------------------------------------------------
// Trigger: New expense added to the trip
// Notifies: all trip members except the one who added it
// ----------------------------------------------------------------
export async function notifyExpenseAdded(
  tripId: string,
  tripName: string,
  expenseTitle: string,
  amount: number,
  payerName: string,
  actingUserId: string,
): Promise<void> {
  const userIds = await getTripUserIds(tripId, actingUserId);

  await sendNotification({
    userIds,
    title: `${payerName} เพิ่มค่าใช้จ่ายใหม่`,
    body: `"${expenseTitle}" ฿${Math.round(amount).toLocaleString("th-TH")} ในทริป "${tripName}"`,
    data: { tripId, screen: "expenses" },
  });
}

// ----------------------------------------------------------------
// Trigger: A debt is marked as settled
// Notifies: the creditor (person who paid and is owed money)
// ----------------------------------------------------------------
export async function notifyDebtSettled(
  tripId: string,
  tripName: string,
  debtorName: string,
  creditorUserId: string,
  amount: number,
): Promise<void> {
  await sendNotification({
    userIds: [creditorUserId],
    title: "ได้รับเงินคืนแล้ว!",
    body: `${debtorName} จ่ายคืน ฿${Math.round(amount).toLocaleString("th-TH")} ในทริป "${tripName}"`,
    data: { tripId, screen: "expenses" },
  });
}

// ----------------------------------------------------------------
// Trigger: Leader sends survey reminder
// Notifies: members who haven't responded (called from dashboard remind button)
// ----------------------------------------------------------------
export async function notifySurveyReminder(
  tripId: string,
  tripName: string,
  pendingUserIds: string[],
): Promise<void> {
  await sendNotification({
    userIds: pendingUserIds,
    title: "อย่าลืมตอบแบบสอบถาม!",
    body: `กรุณาตอบแบบสอบถามของทริป "${tripName}"`,
    data: { tripId, screen: "survey" },
  });
}
