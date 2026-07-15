import { useCallback, useRef, useState } from "react";
import { View, ActivityIndicator, ScrollView, Pressable, Alert, Platform } from "react-native";
import { useLocalSearchParams, Stack, router, useFocusEffect } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Calendar, Users, CheckCircle2, Clock, CreditCard, ListTodo, Share2, Trash2, BellRing, MapPin, Route, MessageCircle, ListChecks } from "lucide-react-native";

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
import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/Card";

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
  const updateTrip = useTripStore((state) => state.updateTrip);
  const user = useAuth((s) => s.user);

  const [isInviteSheetVisible, setIsInviteSheetVisible] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<SurveyAnalytics | null>(null);
  const [bestDates, setBestDates] = useState<DayAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingDate, setIsSettingDate] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);
  const [myRole, setMyRole] = useState<string | null>(null);

  const trip = trips.find((t) => t.id === id);

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

      if (mid) {
        const { data: memberRow } = await (supabase as any)
          .from("trip_members")
          .select("role")
          .eq("id", mid)
          .single();
        if (memberRow?.role) setMyRole(memberRow.role);
      }

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
    setIsDeleteConfirmVisible(true);
  };

  const executeDeletion = async (tripId: string) => {
    setIsDeleting(true);
    try {
      await deleteTrip(tripId);
      removeTrip(tripId);
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
      const updatedTrip = await setConfirmedDate(id, date);
      // Update global store so the UI reacts immediately
      updateTrip(id, { confirmed_date: updatedTrip.confirmed_date });
      
      Alert.alert("กำหนดวันเดินทางแล้ว!", `ยืนยันวัน ${formatDate(date)} แล้ว`);
    } catch {
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถกำหนดวันเดินทางได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSettingDate(null);
    }
  };

  if (isLoading && !isDeleting) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-50">
        <ActivityIndicator size="large" color="#D85A30" />
      </View>
    );
  }

  if (!trip) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-50">
        <ActivityIndicator size="large" color="#D85A30" />
      </View>
    );
  }

  const budgetLabel =
    analytics && analytics.budgetRange.min !== null
      ? `฿${Math.round(analytics.budgetRange.min).toLocaleString()} – ฿${Math.round(
          analytics.budgetRange.max ?? 0,
        ).toLocaleString()}`
      : "—";

  const bestDateLabel = trip.confirmed_date
    ? formatDate(trip.confirmed_date)
    : (bestDates.length > 0 ? formatDate(bestDates[0].date) : "—");

  return (
    <View className="flex-1 bg-surface-50">
      <Stack.Screen
        options={{
          title: trip.name,
        }}
      />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <View className="mb-6">
          <AppText className="text-3xl font-extrabold text-surface-950">{trip.name}</AppText>
          {trip.description && (
            <AppText className="mt-2 text-base text-surface-500 leading-6">{trip.description}</AppText>
          )}
          {trip.confirmed_date && (
            <View className="mt-4 flex-row items-center self-start rounded-full bg-primary-100 px-4 py-2 border border-primary-200">
              <Calendar size={16} color="#4f46e5" />
              <AppText className="ml-2 text-sm font-bold text-primary-800">
                ยืนยันแล้ว: {formatDate(trip.confirmed_date)}
              </AppText>
            </View>
          )}
        </View>

        {/* ---------------- QUICK STATS ---------------- */}
        <View className="mb-6 flex-row gap-2">
          <QuickStat label="สมาชิก" value={String(analytics?.totalMembers ?? 0)} />
          <QuickStat label="ตอบครบ" value={`${analytics?.completionPct ?? 0}%`} />
          <QuickStat label="งบประมาณ" value={budgetLabel} small />
          <QuickStat label="วันเดินทาง" value={bestDateLabel} small />
        </View>

        {/* ---------------- RESPONSE STATUS ---------------- */}
        <Section title="สถานะการตอบแบบสอบถาม" icon={<ListTodo size={20} color="#4f46e5" />}>
          {analytics && analytics.totalMembers > 0 ? (
            <>
              <View className="mb-4 h-3 w-full overflow-hidden rounded-full bg-surface-100 border border-surface-200">
                <View
                  className="h-full rounded-full bg-primary-500"
                  style={{ width: `${analytics.completionPct}%` }}
                />
              </View>
              <AppText className="mb-4 text-sm font-medium text-surface-500">
                {analytics.respondedCount}/{analytics.totalMembers} คนตอบแล้ว
              </AppText>

              <View className="space-y-2 mb-4">
                {analytics.members.map((m) => (
                  <View
                    key={m.member_id}
                    className="flex-row items-center justify-between rounded-xl bg-surface-50 px-4 py-3 border border-surface-100"
                  >
                    <AppText className="text-sm font-semibold text-surface-800">
                      {m.display_name ?? "ไม่ระบุชื่อ"}
                    </AppText>
                    {m.responded ? (
                      <View className="flex-row items-center gap-1.5">
                        <CheckCircle2 size={16} color="#10b981" />
                        <AppText className="text-xs font-bold text-green-600">ตอบแล้ว</AppText>
                      </View>
                    ) : (
                      <View className="flex-row items-center gap-1.5">
                        <Clock size={16} color="#94a3b8" />
                        <AppText className="text-xs font-bold text-surface-400">รอดำเนินการ</AppText>
                      </View>
                    )}
                  </View>
                ))}
              </View>

              {isLeader && analytics.respondedCount < analytics.totalMembers && (
                <Button 
                  variant="outline" 
                  onPress={handleRemind}
                  className="border-amber-200 bg-amber-50"
                  textClassName="text-amber-700"
                >
                  <BellRing size={18} color="#b45309" className="mr-2" />
                  เตือนสมาชิกที่ยังไม่ตอบ
                </Button>
              )}
            </>
          ) : (
            <AppText className="text-sm text-surface-500">
              ยังไม่มีแบบสอบถาม สร้างได้ที่ "แก้ไขแบบสอบถาม" ด้านล่าง
            </AppText>
          )}
        </Section>

        {/* ---------------- BEST DATES ---------------- */}
        <Section title="วันที่เหมาะที่สุด" icon={<Calendar size={20} color="#4f46e5" />}>
          {bestDates.length === 0 ? (
            <AppText className="text-sm text-surface-500 mb-4">
              ยังไม่มีข้อมูลวันว่าง ให้สมาชิกระบุวันว่างของตัวเองก่อนนะ
            </AppText>
          ) : (
            <View className="space-y-2 mb-4">
              {bestDates.map((d, i) => (
                <View
                  key={d.date}
                  className="flex-row items-center justify-between rounded-xl bg-surface-50 px-4 py-3 border border-surface-100"
                >
                  <View className="flex-row items-center gap-3">
                    <View className="h-6 w-6 rounded-full bg-primary-100 items-center justify-center">
                      <AppText className="text-xs font-bold text-primary-700">{i + 1}</AppText>
                    </View>
                    <AppText className="text-sm font-semibold text-surface-800">{formatDate(d.date)}</AppText>
                    <View className="rounded-md bg-green-100 px-2 py-1">
                      <AppText className="text-[10px] font-bold text-green-700">
                        ว่าง {d.count}/{d.total}
                      </AppText>
                    </View>
                  </View>
                  {isLeader && (
                    <Button
                      size="sm"
                      onPress={() => handleSetTripDate(d.date)}
                      disabled={isSettingDate === d.date || trip.confirmed_date === d.date}
                      loading={isSettingDate === d.date}
                      variant={trip.confirmed_date === d.date ? "secondary" : "default"}
                    >
                      {trip.confirmed_date === d.date ? "เลือกแล้ว" : "เลือก"}
                    </Button>
                  )}
                </View>
              ))}
            </View>
          )}

          <View className="flex-row gap-3">
            <Button
              className="flex-1"
              variant="outline"
              onPress={() => setShowHeatmap((v) => !v)}
            >
              {showHeatmap ? "ซ่อนไทมไลน์" : "ดูไทมไลน์วันว่าง"}
            </Button>
            <Button
              className="flex-1"
              onPress={() => router.push(`/trips/${trip.id}/availability` as any)}
            >
              ระบุวันว่าง
            </Button>
          </View>

          {showHeatmap && (
            <View className="mt-6 border-t border-surface-100 pt-6">
              <AvailabilityHeatmap tripId={trip.id} />
            </View>
          )}
        </Section>

        {/* ---------------- SURVEY RESULTS ---------------- */}
        <Section title="ผลสำรวจ & โหวต" icon={<ListTodo size={20} color="#4f46e5" />}>
          <SurveyResultsSection results={analytics?.results ?? []} />
          
          <View className="mt-6 border-t border-surface-100 pt-6">
            <VoteSection tripId={trip.id} myMemberId={myMemberId} isLeader={!!isLeader} />
          </View>

          <View className="mt-6 flex-row gap-3">
            <Button
              className="flex-1"
              onPress={() => router.push(`/trips/${trip.id}/survey/respond` as any)}
            >
              ตอบแบบสอบถาม
            </Button>
            {isLeader && (
              <Button
                className="flex-1"
                variant="secondary"
                onPress={() => router.push(`/trips/${trip.id}/survey/builder` as any)}
              >
                แก้ไขแบบสอบถาม
              </Button>
            )}
          </View>
        </Section>

        {/* ---------------- EXPENSES ---------------- */}
        <Section title="ค่าใช้จ่าย" icon={<CreditCard size={20} color="#4f46e5" />}>
          <AppText className="mb-5 text-sm text-surface-500">
            ติดตามค่าใช้จ่ายและหารจำนวนเงินแบบกลุ่มอัตโนมัติ
          </AppText>
          <View className="flex-row gap-3">
            <Button
              className="flex-1"
              variant="outline"
              onPress={() => router.push(`/trips/${trip.id}/expenses` as any)}
            >
              ดูค่าใช้จ่าย
            </Button>
            <Button
              className="flex-1"
              onPress={() => router.push(`/trips/${trip.id}/expenses/add` as any)}
            >
              + เพิ่มรายการ
            </Button>
          </View>
        </Section>

        {/* ---------------- ITINERARY ---------------- */}
        <Section title="แผนการเดินทาง" icon={<Route size={20} color="#4f46e5" />}>
          <AppText className="mb-5 text-sm text-surface-500">
            จัดตารางกิจกรรมรายวัน ไม่ต้องสลับไปเปิด Google Sheets อีกต่อไป
          </AppText>
          <Button onPress={() => router.push(`/trips/${trip.id}/itinerary` as any)}>
            เปิดแผนการเดินทาง
          </Button>
        </Section>

        {/* ---------------- DISCUSSION ---------------- */}
        <Section title="พูดคุยทริป" icon={<MessageCircle size={20} color="#4f46e5" />}>
          <AppText className="mb-5 text-sm text-surface-500">
            คุยกับเพื่อนในทริปโดยตรง ไม่ต้องย้ายไปคุยใน LINE/WhatsApp
          </AppText>
          <Button variant="secondary" onPress={() => router.push(`/trips/${trip.id}/discussion` as any)}>
            เปิดห้องสนทนา
          </Button>
        </Section>

        {/* ---------------- TO-DO / PACKING ---------------- */}
        <Section title="เช็คลิสต์ทริป" icon={<ListChecks size={20} color="#4f46e5" />}>
          <AppText className="mb-5 text-sm text-surface-500">
            แบ่งงานและของที่ต้องเตรียม แล้วติดตามความคืบหน้ากันได้
          </AppText>
          <Button variant="secondary" onPress={() => router.push(`/trips/${trip.id}/todo` as any)}>
            เปิดเช็คลิสต์
          </Button>
        </Section>

        {/* ---------------- MEMBERS ---------------- */}
        <Section title="สมาชิกในทริป" icon={<Users size={20} color="#4f46e5" />}>
          <AppText className="mb-5 text-sm text-surface-500">
            ชวนเพื่อนๆ มาร่วมวงวางแผนด้วยกัน!
          </AppText>
          <Button
            variant="secondary"
            onPress={() => setIsInviteSheetVisible(true)}
          >
            <Share2 size={18} color="#0f172a" className="mr-2" />
            เชิญเพื่อนร่วมทริป
          </Button>
        </Section>

        {/* ---------------- DANGER ZONE ---------------- */}
        {isLeader && (
          <View className="mt-8 mb-2">
            <Button
              variant="destructive"
              onPress={handleDeleteTrip}
              disabled={isDeleting}
              loading={isDeleting}
            >
              <Trash2 size={18} color="#ffffff" className="mr-2" />
              ลบทริปนี้
            </Button>
          </View>
        )}
      </ScrollView>

      {isInviteSheetVisible && (
        <>
          <Pressable
            className="absolute inset-0 z-40 bg-black/40"
            onPress={() => setIsInviteSheetVisible(false)}
          />
          <InviteSheet
            inviteToken={trip.invite_token}
            onClose={() => setIsInviteSheetVisible(false)}
          />
        </>
      )}

      {isDeleteConfirmVisible && (
        <View className="absolute inset-0 z-50 items-center justify-center bg-black/40 px-6">
          <View className="w-full max-w-sm rounded-[32px] bg-white p-8 shadow-2xl">
            <View className="w-16 h-16 rounded-full bg-red-100 items-center justify-center self-center mb-4">
              <Trash2 size={24} color="#ef4444" />
            </View>
            <AppText className="text-2xl font-bold text-surface-950 text-center">ลบทริป</AppText>
            <AppText className="mt-3 text-base text-surface-500 text-center leading-6 mb-8">
              คุณแน่ใจว่าต้องการลบทริป "{trip.name}" ใช่ไหม? เมื่อลบแล้วจะไม่สามารถกู้คืนได้
            </AppText>
            
            <View className="flex-col gap-3">
              <Button
                variant="destructive"
                onPress={() => executeDeletion(trip.id)}
                disabled={isDeleting}
                loading={isDeleting}
                size="lg"
              >
                ลบทิ้งเลย
              </Button>
              <Button
                variant="ghost"
                onPress={() => setIsDeleteConfirmVisible(false)}
                disabled={isDeleting}
                size="lg"
              >
                ยกเลิก
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="mb-4 border-surface-200">
      <CardHeader className="flex-row items-center gap-2 pb-4">
        {icon && <View>{icon}</View>}
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
}

function QuickStat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <View className="flex-1 items-center justify-center rounded-2xl border border-surface-200 bg-white p-3 shadow-sm">
      <AppText
        className={`font-extrabold text-primary-600 ${small ? "text-sm" : "text-xl"}`}
        numberOfLines={1}
      >
        {value}
      </AppText>
      <AppText className="mt-1 text-[11px] font-medium text-surface-500 uppercase tracking-wider" numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}
