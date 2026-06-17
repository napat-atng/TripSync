import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { AppText } from "../../../components/AppText";
import { useAuth } from "../../../hooks/useAuth";
import {
  getMyAvailability,
  upsertAvailability,
} from "../../../lib/availability";
import { getMyMemberId } from "../../../lib/members";
import type { Availability } from "../../../types/availability";

// --- helpers ---

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function toDateKey(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

const MONTH_NAMES = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const DAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

// --- component ---

export default function AvailabilityScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const user = useAuth((s) => s.user);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  // Map of "YYYY-MM-DD" → true/false (only dates the member has explicitly marked)
  const [markedDates, setMarkedDates] = useState<Map<string, boolean>>(new Map());
  const [memberId, setMemberId] = useState<string | null>(null);
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load member ID + their existing availability
  const init = useCallback(async () => {
    if (!tripId || !user) return;
    setIsLoading(true);
    try {
      const mid = await getMyMemberId(tripId, user.id);
      if (!mid) {
        Alert.alert("ข้อผิดพลาด", "คุณไม่ได้เป็นสมาชิกของทริปนี้");
        return;
      }
      setMemberId(mid);

      const rows: Availability[] = await getMyAvailability(tripId, mid);
      const map = new Map<string, boolean>();
      rows.forEach((r) => map.set(r.date, r.available));
      setMarkedDates(map);
    } catch {
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถโหลดข้อมูลวันว่างของคุณได้");
    } finally {
      setIsLoading(false);
    }
  }, [tripId, user]);

  useEffect(() => { init(); }, [init]);

  const toggleDate = async (dateKey: string) => {
    if (!memberId || savingDate) return;

    const current = markedDates.get(dateKey);
    // Cycle: unmarked → available (true) → unavailable (false) → unmarked
    // For simplicity: unmarked/false → true, true → false
    const next = current !== true;

    // Optimistic update
    setMarkedDates((prev) => new Map(prev).set(dateKey, next));
    setSavingDate(dateKey);

    try {
      await upsertAvailability(tripId!, memberId, dateKey, next);
    } catch {
      // Roll back on error
      setMarkedDates((prev) => {
        const m = new Map(prev);
        if (current === undefined) m.delete(dateKey);
        else m.set(dateKey, current);
        return m;
      });
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถบันทึกได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSavingDate(null);
    }
  };

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const availableCount = Array.from(markedDates.values()).filter(Boolean).length;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <Stack.Screen options={{ title: "วันว่างของฉัน" }} />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        {/* Summary chip */}
        <View className="mb-5 flex-row items-center gap-3">
          <View className="rounded-full bg-green-100 px-3 py-1">
            <AppText className="text-sm font-semibold text-green-800">
              ว่าง {availableCount} วัน
            </AppText>
          </View>
          <AppText className="text-xs text-slate-400">แตะที่วันที่เพื่อเลือก/ยกเลิก</AppText>
        </View>

        {/* Month navigation */}
        <View className="mb-4 flex-row items-center justify-between">
          <Pressable
            onPress={prevMonth}
            className="h-9 w-9 items-center justify-center rounded-full bg-white border border-slate-200"
          >
            <AppText className="text-lg text-slate-600">‹</AppText>
          </Pressable>
          <AppText className="text-base font-semibold text-slate-800">
            {MONTH_NAMES[month]} {year}
          </AppText>
          <Pressable
            onPress={nextMonth}
            className="h-9 w-9 items-center justify-center rounded-full bg-white border border-slate-200"
          >
            <AppText className="text-lg text-slate-600">›</AppText>
          </Pressable>
        </View>

        {/* Day-of-week header */}
        <View className="mb-2 flex-row">
          {DAY_LABELS.map((d) => (
            <View key={d} className="flex-1 items-center">
              <AppText className="text-xs font-medium text-slate-400">{d}</AppText>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <View className="flex-row flex-wrap">
          {Array.from({ length: firstDay }).map((_, i) => (
            <View key={`e-${i}`} style={{ width: `${100 / 7}%` }} className="aspect-square p-1" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const key = toDateKey(year, month, day);
            const status = markedDates.get(key);
            const isSaving = savingDate === key;

            const isPast = new Date(key) < new Date(new Date().toDateString());

            let bg = "bg-white border border-slate-200";
            let textStyle = "text-slate-700";

            if (status === true) {
              bg = "bg-green-500";
              textStyle = "text-white";
            } else if (status === false) {
              bg = "bg-slate-200";
              textStyle = "text-slate-400";
            }

            return (
              <Pressable
                key={key}
                style={{ width: `${100 / 7}%` }}
                className="aspect-square p-1"
                onPress={() => !isPast && toggleDate(key)}
                disabled={isPast || isSaving}
              >
                <View
                  className={`flex-1 items-center justify-center rounded-lg ${bg} ${isPast ? "opacity-30" : ""}`}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color={status === true ? "#fff" : "#16a34a"} />
                  ) : (
                    <AppText className={`text-sm font-medium ${textStyle}`}>{day}</AppText>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Legend */}
        <View className="mt-6 flex-row items-center justify-center gap-4">
          <View className="flex-row items-center gap-1.5">
            <View className="h-4 w-4 rounded bg-green-500" />
            <AppText className="text-xs text-slate-500">ว่าง</AppText>
          </View>
          <View className="flex-row items-center gap-1.5">
            <View className="h-4 w-4 rounded border border-slate-200 bg-white" />
            <AppText className="text-xs text-slate-500">ไม่ได้ระบุ</AppText>
          </View>
        </View>

        <AppText className="mt-4 text-center text-xs text-slate-400">
          บันทึกการเปลี่ยนแปลงโดยอัตโนมัติ
        </AppText>
      </ScrollView>
    </View>
  );
}
