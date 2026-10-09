import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";

import { AppText } from "./AppText";
import { getAvailabilityByTrip, getBestDates, aggregateByDate } from "../lib/availability";
import { getMembersByTrip } from "../lib/members";
import type { AvailabilityWithMember, DayAvailability } from "../types/availability";

// --- helpers ---

function getHeatColor(count: number, total: number): string {
  if (total === 0 || count === 0) return "#f8fafc"; // slate-50
  const ratio = count / total;
  if (ratio <= 0.25) return "#bbf7d0"; // green-200
  if (ratio <= 0.5) return "#4ade80";  // green-400
  if (ratio <= 0.75) return "#16a34a"; // green-600
  return "#14532d";                    // green-900
}

function getTextColor(count: number, total: number): string {
  if (total === 0 || count === 0) return "#94a3b8"; // slate-400
  const ratio = count / total;
  return ratio > 0.5 ? "#fff" : "#166534"; // white or green-800
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay(); // 0=Sun
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

// --- sub-components ---

interface DayDetailModalProps {
  day: DayAvailability | null;
  totalMembers: number;
  onClose: () => void;
}

function DayDetailModal({ day, totalMembers, onClose }: DayDetailModalProps) {
  if (!day) return null;

  const notAvailable = totalMembers - day.count;
  const dateObj = new Date(day.date + "T00:00:00");
  const label = dateObj.toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable onPress={() => {}} className="rounded-t-2xl bg-white p-6 pb-10">
          <View className="mb-1 flex-row items-center justify-between">
            <AppText className="text-lg font-bold text-slate-900">{label}</AppText>
            <Pressable onPress={onClose}>
              <AppText className="text-slate-500">Close</AppText>
            </Pressable>
          </View>

          <AppText className="mb-4 text-sm text-slate-500">
          {day.count} ใน {totalMembers} คนว่างงาน
          </AppText>

          {day.members.length > 0 && (
            <>
              <AppText className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                ว่างงาน
              </AppText>
              {day.members.map((m) => (
                <View key={m.member_id} className="mb-2 flex-row items-center gap-2">
                  <View className="h-7 w-7 items-center justify-center rounded-full bg-green-100">
                    <AppText className="text-xs font-bold text-green-700">
                      {(m.display_name ?? "?")[0].toUpperCase()}
                    </AppText>
                  </View>
                  <AppText className="text-sm text-slate-700">
                    {m.display_name ?? "ผู้เยี่ยม"}
                  </AppText>
                </View>
              ))}
            </>
          )}

          {notAvailable > 0 && (
            <AppText className="mt-3 text-xs text-slate-400">
              {notAvailable} คนไม่ว่างหรือยังไม่ได้ระบุวัน
            </AppText>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// --- main component ---

interface AvailabilityHeatmapProps {
  tripId: string;
  /** initial year/month to display (defaults to current) */
  initialYear?: number;
  initialMonth?: number;
}

export function AvailabilityHeatmap({ tripId, initialYear, initialMonth }: AvailabilityHeatmapProps) {
  const now = new Date();
  const [year, setYear] = useState(initialYear ?? now.getFullYear());
  const [month, setMonth] = useState(initialMonth ?? now.getMonth());
  const [heatmap, setHeatmap] = useState<Map<string, DayAvailability>>(new Map());
  const [bestDates, setBestDates] = useState<DayAvailability[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<DayAvailability | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rows, members, best] = await Promise.all([
        getAvailabilityByTrip(tripId),
        getMembersByTrip(tripId),
        getBestDates(tripId, 3),
      ]);
      setTotalMembers(members.length);
      setHeatmap(aggregateByDate(rows, members.length));
      setBestDates(best);
    } catch {
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถโหลดข้อมูลวันว่างได้");
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => { load(); }, [load]);

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

  if (isLoading) {
    return (
      <View className="items-center py-10">
        <ActivityIndicator size="small" color="#16a34a" />
      </View>
    );
  }

  return (
    <View>
      {/* Best dates */}
      {bestDates.length > 0 && (
        <View className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4">
          <AppText className="mb-3 text-sm font-semibold text-green-800">
            🏆 วันที่เหมาะที่สุด
          </AppText>
          {bestDates.map((d, i) => {
            const dateObj = new Date(d.date + "T00:00:00");
            const label = dateObj.toLocaleDateString("th-TH", {
              weekday: "short", day: "numeric", month: "short",
            });
            return (
              <Pressable
                key={d.date}
                className="mb-2 flex-row items-center justify-between"
                onPress={() => setSelectedDay(d)}
              >
                <AppText className="text-sm text-green-900">
                  {i + 1}. {label}
                </AppText>
                <View className="rounded-full bg-green-200 px-2 py-0.5">
                  <AppText className="text-xs font-semibold text-green-800">
                    {d.count}/{d.total}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Month navigation */}
      <View className="mb-3 flex-row items-center justify-between">
        <Pressable
          onPress={prevMonth}
          className="h-8 w-8 items-center justify-center rounded-full bg-slate-100"
        >
          <AppText className="text-slate-600">‹</AppText>
        </Pressable>
        <AppText className="text-base font-semibold text-slate-800">
          {MONTH_NAMES[month]} {year}
        </AppText>
        <Pressable
          onPress={nextMonth}
          className="h-8 w-8 items-center justify-center rounded-full bg-slate-100"
        >
          <AppText className="text-slate-600">›</AppText>
        </Pressable>
      </View>

      {/* Day-of-week headers */}
      <View className="mb-1 flex-row">
        {DAY_LABELS.map((d) => (
          <View key={d} className="flex-1 items-center">
            <AppText className="text-xs text-slate-400">{d}</AppText>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View className="flex-row flex-wrap">
        {/* Empty leading cells */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <View key={`empty-${i}`} style={{ width: `${100 / 7}%` }} className="aspect-square p-0.5" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const key = toDateKey(year, month, day);
          const info = heatmap.get(key);
          const count = info?.count ?? 0;
          const bg = getHeatColor(count, totalMembers);
          const textCol = getTextColor(count, totalMembers);

          return (
            <Pressable
              key={key}
              style={{ width: `${100 / 7}%` }}
              className="aspect-square p-0.5"
              onPress={() => info && setSelectedDay(info)}
            >
              <View
                className="flex-1 items-center justify-center rounded-md"
                style={{ backgroundColor: bg }}
              >
                <AppText style={{ color: textCol, fontSize: 12, fontWeight: "500" }}>
                  {day}
                </AppText>
                {count > 0 && (
                  <AppText style={{ color: textCol, fontSize: 9 }}>{count}</AppText>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Legend */}
      <View className="mt-4 flex-row items-center justify-center gap-2">
        <AppText className="mr-1 text-xs text-slate-400">0</AppText>
        {["#bbf7d0", "#4ade80", "#16a34a", "#14532d"].map((c) => (
          <View key={c} className="h-4 w-6 rounded" style={{ backgroundColor: c }} />
        ))}
        <AppText className="ml-1 text-xs text-slate-400">ทุกคน</AppText>
      </View>

      {selectedDay && (
        <DayDetailModal
          day={selectedDay}
          totalMembers={totalMembers}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </View>
  );
}
