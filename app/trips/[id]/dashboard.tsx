import { useCallback, useRef, useState } from "react";
import { View, ActivityIndicator, ScrollView, Pressable, Alert } from "react-native";
import { useLocalSearchParams, Stack, router, useFocusEffect } from "expo-router";
import * as Clipboard from "expo-clipboard";

import { AppText } from "../../../components/AppText";
import { InviteSheet } from "../../../components/InviteSheet";
import { AvailabilityHeatmap } from "../../../components/AvailabilityHeatmap";
import { SurveyResultsSection } from "../../../components/SurveyResultsSection";
import { VoteSection } from "../../../components/VoteSection";
import { useTripStore } from "../../../store/tripStore";
import { useAuth } from "../../../hooks/useAuth";
import { getMyMemberId } from "../../../lib/members";
import { setConfirmedDate, deleteTrip } from "../../../lib/trips";
import { getSurveyAnalytics, type SurveyAnalytics } from "../../../lib/survey-analytics";
import { getBestDates } from "../../../lib/availability";
import { sendPushNotification, getLeaderUserId } from "../../../lib/notifications";
import { supabase } from "../../../lib/supabase";
import type { DayAvailability } from "../../../types/availability";

// Feature flag: set to true only after Edge Function is deployed
const PUSH_NOTIFICATIONS_ENABLED = false;

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function TripDashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trips = useTripStore((state) => state.trips);
  const removeTrip = useTripStore((state) => state.removeTrip);
  const user = useAuth((s) => s.user);

  const [isInviteSheetVisible, setIsInviteSheetVisible] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<SurveyAnalytics | null>(null);
  const [bestDates, setBestDates] = useState<DayAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingDate, setIsSettingDate] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [myRole, setMyRole] = useState<string | null>(null);

  const trip = trips.find((t) => t.id === id);

  // trip_members can be nested as array from getUserTrips join
  const tripMembers = (trip as any)?.trip_members ?? [];
  const isLeader =
    myRole === "leader" ||
    tripMembers.some((m: any) => m.user_id === user?.id && m.role === "leader");

  const prevRespondedCount = useRef(0);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [mid, surveyData, dates] = await Promise.all([
        getMyMemberId(id, user?.id),
        getSurveyAnalytics(id),
        getBestDates(id, 3),
      ]);
      setMyMemberId(mid ?? null);
      setAnalytics(surveyData);
      setBestDates(dates);

      // Fetch role directly from DB — don’t rely on store join which may be stale
      if (mid) {
        const { data: memberRow } = await (supabase as any)
          .from("trip_members")
          .select("role")
          .eq("id", mid)
          .single();
        if (memberRow?.role) setMyRole(memberRow.role);
      }

      // Trigger 2: notify leader when all members have responded
      // Wrapped in its own try/catch so notification failure never breaks the dashboard load
      if (
        PUSH_NOTIFICATIONS_ENABLED &&
        isLeader &&
        surveyData.totalMembers > 0 &&
        surveyData.respondedCount === surveyData.totalMembers &&
        prevRespondedCount.current < surveyData.totalMembers
      ) {
        try {
          const leaderUserId = await getLeaderUserId(id);
          if (leaderUserId) {
            await sendPushNotification(
              [leaderUserId],
              "ทุกคนตอบแล้ว! 🎉",
              `สมาชิกทุกคนตอบแบบสอบถามสำหรับ "${trip?.name}" ครบแล้ว ดูผลได้เลย`,
              { tripId: id },
            );
          }
        } catch {
          // notification failure is non-critical — log and continue
          console.warn("[dashboard] survey-complete notification failed");
        }
      }

      prevRespondedCount.current = surveyData.respondedCount;
    } catch (err) {
      console.warn("[dashboard] load error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [id, user?.id, isLeader, trip?.name]);

  useFocusEffect(
    useCallback(() => {
      if (!trip && !isDeleting) {
        router.replace("/(tabs)/home");
        return;
      }
      if (trip) load();
    }, [trip, isDeleting, load]),
  );

  const handleDeleteTrip = () => {
    if (!trip || !id) return;
    Alert.alert(
      "ลบทริป",
      `คุณแน่ใจว่าต้องการลบทริป "${trip.name}" ใช่ไหม? เมื่อลบแล้วจะไม่สามารถกู้คืนได้`,
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ลบทริป",
          style: "destructive",
          onPress: () => executeDeletion(id),
        },
      ],
    );
  };

  const executeDeletion = async (tripId: string) => {
    setIsDeleting(true);
    try {
      await deleteTrip(tripId);
      // Remove from store AFTER successful DB delete
      removeTrip(tripId);
      // Use setTimeout to let store update propagate before navigating
      // This prevents useFocusEffect from seeing trip=undefined mid-deletion
      setTimeout(() => {
        router.replace("/(tabs)/home");
      }, 50);
    } catch (err: any) {
      setIsDeleting(false);
      const message = err?.message ?? JSON.stringify(err) ?? "ไม่ทราบสาเหตุ";
      Alert.alert("ไม่สามารถลบทริปได้", message);
    }
  };

  const handleRemind = async () => {
    if (!analytics || !id) return;
    const pending = analytics.members.filter((m) => !m.responded);

    if (pending.length === 0) {
      Alert.alert("สั่งเตือนเรียบร้อยแล้ว", "ทุกคนตอบแบบสอบถามครบแล้ว!");
      return;
    }

    if (PUSH_NOTIFICATIONS_ENABLED) {
      // Send push notification to members with accounts
      try {
        const { data: pendingRows } = await (supabase as any)
          .from("trip_members")
          .select("user_id")
          .in("id", pending.map((m) => m.member_id))
          .not("user_id", "is", null);

        const pendingUserIds: string[] = (pendingRows ?? []).map((r: any) => r.user_id);

        if (pendingUserIds.length > 0) {
          await sendPushNotification(
            pendingUserIds,
            "อย่าลืมตอบแบบสอบถามนะ! 🙏",
            `อย่าลืมตอบแบบสอบถามทริป "${trip?.name}" ด้วยนะ`,
            { tripId: id },
          );
          Alert.alert("ส่งแจ้งเตือนแล้ว", `ส่งการแจ้งเตือนไปยังสมาชิก ${pendingUserIds.length} คนแล้ว`);
          return;
        }
      } catch {
        console.warn("[dashboard] remind notification failed, falling back to clipboard");
      }
    }

    // Fallback: copy reminder message to clipboard (used when push is disabled or all pending are guests)
    const names = pending.map((m) => m.display_name ?? "สมาชิก").join(", ");
    const message = `อย่าลืมตอบแบบสอบถามทริป "${trip?.name}" ด้วยนะ 🙏 รอ: ${names}`;
    await Clipboard.setStringAsync(message);
    Alert.alert(
      "คัดลอกข้อความแล้ว",
      "เอาข้อความนี้ไปวางในกลุ่มแชตเพื่อเตือนสมาชิกได้เลย",
    );
  };

  const handleSetTripDate = async (date: string) => {
    if (!id) return;
    setIsSettingDate(date);
    try {
      await setConfirmedDate(id, date);
      Alert.alert("กำหนดวันเดินทางแล้ว!", `ยืนยันวัน ${formatDate(date)} แล้ว`);
    } catch {
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถกำหนดวันเดินทางได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSettingDate(null);
    }
  };

  // Don't block rendering when deleting — show spinner overlay instead
  if (isLoading && !isDeleting) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  if (!trip) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  const budgetLabel =
    analytics && analytics.budgetRange.min !== null
      ? `฿${Math.round(analytics.budgetRange.min).toLocaleString()} – ฿${Math.round(
          analytics.budgetRange.max ?? 0,
        ).toLocaleString()}`
      : "—";

  const bestDateLabel = bestDates.length > 0 ? formatDate(bestDates[0].date) : "—";

  return (
    <View className="flex-1 bg-slate-50">
      <Stack.Screen
        options={{
          title: trip.name,
          headerRight: isLeader
            ? () => (
                <Pressable
                  onPress={handleDeleteTrip}
                  className="mr-2"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <AppText className="text-sm font-semibold text-red-500">ลบ</AppText>
                  )}
                </Pressable>
              )
            : undefined,
        }}
      />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <AppText className="text-2xl font-bold text-slate-900">{trip.name}</AppText>
        {trip.description && (
          <AppText className="mt-1 text-base text-slate-500">{trip.description}</AppText>
        )}
        {trip.confirmed_date && (
          <View className="mt-3 self-start rounded-full bg-teal-100 px-3 py-1">
            <AppText className="text-xs font-semibold text-teal-800">
              📅 ยืนยันแล้ว: {formatDate(trip.confirmed_date)}
            </AppText>
          </View>
        )}

        {/* ---------------- QUICK STATS ---------------- */}
        <View className="mt-6 flex-row gap-2">
          <QuickStat label="สมาชิก" value={String(analytics?.totalMembers ?? 0)} />
          <QuickStat label="ตอบครบ" value={`${analytics?.completionPct ?? 0}%`} />
          <QuickStat label="งบประมาณ" value={budgetLabel} small />
          <QuickStat label="วันที่เหมาะ" value={bestDateLabel} small />
        </View>

        {/* ---------------- RESPONSE STATUS ---------------- */}
        <Section title="สถานะการตอบ">
          {analytics && analytics.totalMembers > 0 ? (
            <>
              <View className="mb-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <View
                  className="h-2.5 rounded-full bg-teal-500"
                  style={{ width: `${analytics.completionPct}%` }}
                />
              </View>
              <AppText className="mb-3 text-xs text-slate-500">
                {analytics.respondedCount}/{analytics.totalMembers} คนตอบแล้ว
              </AppText>

              {analytics.members.map((m) => (
                <View
                  key={m.member_id}
                  className="mb-2 flex-row items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                >
                  <AppText className="text-sm text-slate-800">
                    {m.display_name ?? "ไม่ระบุชื่อ"}
                  </AppText>
                  {m.responded ? (
                    <View className="flex-row items-center gap-1">
                      <AppText className="text-sm text-green-600">✓</AppText>
                      <AppText className="text-xs font-medium text-green-700">ตอบแล้ว</AppText>
                    </View>
                  ) : (
                    <View className="flex-row items-center gap-1">
                      <AppText className="text-sm text-slate-400">🕒</AppText>
                      <AppText className="text-xs font-medium text-slate-400">รอดำเนินการ</AppText>
                    </View>
                  )}
                </View>
              ))}

              {isLeader && analytics.respondedCount < analytics.totalMembers && (
                <Pressable
                  className="mt-2 h-10 items-center justify-center rounded-lg border border-amber-300 bg-amber-50"
                  onPress={handleRemind}
                >
                  <AppText className="text-sm font-semibold text-amber-700">
                    เตือนสมาชิกที่ยังไม่ตอบ
                  </AppText>
                </Pressable>
              )}
            </>
          ) : (
            <AppText className="text-sm text-slate-500">
              ยังไม่มีแบบสอบถาม สร้างได้ที่ "แก้ไขแบบสอบถาม" ด้านล่าง
            </AppText>
          )}
        </Section>

        {/* ---------------- BEST DATES ---------------- */}
        <Section title="วันที่เหมาะที่สุด">
          {bestDates.length === 0 ? (
            <AppText className="text-sm text-slate-500">
              ยังไม่มีข้อมูลวันว่าง ให้สมาชิกระบุวันว่างของตัวเองก่อนนะ
            </AppText>
          ) : (
            bestDates.map((d, i) => (
              <View
                key={d.date}
                className="mb-2 flex-row items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5"
              >
                <View className="flex-row items-center gap-2">
                  <AppText className="text-sm font-semibold text-slate-900">{i + 1}.</AppText>
                  <AppText className="text-sm text-slate-800">{formatDate(d.date)}</AppText>
                  <View className="rounded-full bg-green-100 px-2 py-0.5">
                    <AppText className="text-xs font-medium text-green-700">
                      {d.count}/{d.total}
                    </AppText>
                  </View>
                </View>
                {isLeader && (
                  <Pressable
                    className="h-8 items-center justify-center rounded-lg bg-teal-600 px-3"
                    onPress={() => handleSetTripDate(d.date)}
                    disabled={isSettingDate === d.date}
                  >
                    {isSettingDate === d.date ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <AppText className="text-xs font-semibold text-white">
                        เลือกเป็นวันเดินทาง
                      </AppText>
                    )}
                  </Pressable>
                )}
              </View>
            ))
          )}

          <Pressable
            className="mt-3 h-10 items-center justify-center rounded-lg border border-green-200 bg-green-50"
            onPress={() => setShowHeatmap((v) => !v)}
          >
            <AppText className="text-sm font-semibold text-green-700">
              {showHeatmap ? "ซ่อน" : "ดู"}ไทมไลน์วันว่างทั้งหมด
            </AppText>
          </Pressable>

          {showHeatmap && (
            <View className="mt-4">
              <AvailabilityHeatmap tripId={trip.id} />
            </View>
          )}

          <Pressable
            className="mt-3 h-10 items-center justify-center rounded-lg bg-slate-900"
            onPress={() => router.push(`/trips/${trip.id}/availability` as any)}
          >
            <AppText className="text-sm font-semibold text-white">ระบุวันว่างของฉัน</AppText>
          </Pressable>
        </Section>

        {/* ---------------- SURVEY RESULTS ---------------- */}
        <Section title="ผลสำรวจ">
          <SurveyResultsSection results={analytics?.results ?? []} />
          <View className="mt-2 flex-row gap-3">
            <Pressable
              className="flex-1 h-11 items-center justify-center rounded-lg bg-teal-600"
              onPress={() => router.push(`/trips/${trip.id}/survey/respond` as any)}
            >
              <AppText className="font-semibold text-white">ตอบแบบสอบถาม</AppText>
            </Pressable>
            {isLeader && (
              <Pressable
                className="flex-1 h-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50"
                onPress={() => router.push(`/trips/${trip.id}/survey/builder` as any)}
              >
                <AppText className="font-semibold text-slate-700">แก้ไขแบบสอบถาม</AppText>
              </Pressable>
            )}
          </View>
        </Section>

        {/* ---------------- VOTE ---------------- */}
        <Section title="โหวตอบคำถาม">
          <VoteSection tripId={trip.id} myMemberId={myMemberId} isLeader={!!isLeader} />
        </Section>

        {/* ---------------- EXPENSES ---------------- */}
        <Section title="ค่าใช้จ่าย">
          <AppText className="mb-4 text-sm text-slate-500">
            ติดตามค่าใช้จ่ายและหารจำนวนเงินแบบกลุ่ม
          </AppText>
          <View className="flex-row gap-3">
            <Pressable
              className="flex-1 h-11 items-center justify-center rounded-lg bg-teal-600"
              onPress={() => router.push(`/trips/${trip.id}/expenses` as any)}
            >
              <AppText className="font-semibold text-white">ดูค่าใช้จ่าย</AppText>
            </Pressable>
            <Pressable
              className="flex-1 h-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50"
              onPress={() => router.push(`/trips/${trip.id}/expenses/add` as any)}
            >
              <AppText className="font-semibold text-slate-700">+ เพิ่ม</AppText>
            </Pressable>
          </View>
        </Section>

        {/* ---------------- MEMBERS ---------------- */}
        <Section title="สมาชิกในทริป">
          <AppText className="mb-4 text-sm text-slate-500">
            ชวนเพื่อนๆ สักคนมาวางแผนด้วยกันเลย!
          </AppText>
          <Pressable
            className="h-11 items-center justify-center rounded-lg bg-teal-50"
            onPress={() => setIsInviteSheetVisible(true)}
          >
            <AppText className="font-semibold text-teal-700">เชิญเพื่อน</AppText>
          </Pressable>
        </Section>
      </ScrollView>

      {isInviteSheetVisible && (
        <>
          <Pressable
            className="absolute inset-0 bg-black/20"
            onPress={() => setIsInviteSheetVisible(false)}
          />
          <InviteSheet
            inviteToken={trip.invite_token}
            onClose={() => setIsInviteSheetVisible(false)}
          />
        </>
      )}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
      <AppText className="mb-4 text-base font-semibold text-slate-900">{title}</AppText>
      {children}
    </View>
  );
}

function QuickStat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <View className="flex-1 items-center rounded-xl border border-slate-200 bg-white px-2 py-3">
      <AppText
        className={`font-bold text-slate-900 ${small ? "text-xs" : "text-base"}`}
        numberOfLines={1}
      >
        {value}
      </AppText>
      <AppText className="mt-0.5 text-[10px] text-slate-400" numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}
