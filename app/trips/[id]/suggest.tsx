import React, { useCallback, useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Share,
} from "react-native";
import { Stack, useLocalSearchParams, useFocusEffect } from "expo-router";

import { AppText } from "../../../components/AppText";
import { generateSuggestions, getSavedSuggestions } from "../../../lib/suggestions";
import { useTripStore } from "../../../store/tripStore";
import { useAuth } from "../../../hooks/useAuth";
import type { DestinationSuggestion, SuggestionsResult } from "../../../types/suggestion";

function formatMoney(n: number) {
  return n.toLocaleString("th-TH");
}

// ----------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------

function HighlightChip({ text }: { text: string }) {
  return (
    <View className="mr-2 mt-1 rounded-full bg-teal-50 border border-teal-200 px-3 py-1">
      <AppText className="text-xs text-teal-800">{text}</AppText>
    </View>
  );
}

function SuggestionCard({
  item,
  index,
}: {
  item: DestinationSuggestion;
  index: number;
}) {
  const rankColors = ["bg-amber-500", "bg-slate-400", "bg-orange-400"];
  const rankColor = rankColors[index] ?? "bg-slate-300";

  return (
    <View className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* Header */}
      <View className="bg-teal-600 px-5 py-4">
        <View className="flex-row items-center gap-3">
          <View className={`h-8 w-8 items-center justify-center rounded-full ${rankColor}`}>
            <AppText className="text-sm font-bold text-white">{index + 1}</AppText>
          </View>
          <View className="flex-1">
            <AppText className="text-lg font-bold text-white">{item.name}</AppText>
            <AppText className="text-xs text-teal-100">{item.best_for}</AppText>
          </View>
          <View className="items-end">
            <AppText className="text-xs text-teal-100">ประมาณคนละ</AppText>
            <AppText className="text-base font-bold text-white">
              ฿{formatMoney(item.estimated_cost_per_person)}
            </AppText>
          </View>
        </View>
      </View>

      {/* Body */}
      <View className="px-5 py-4">
        <AppText className="text-sm leading-relaxed text-slate-700">{item.description}</AppText>

        <View className="mt-4">
          <AppText className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            ไฮไลต์
          </AppText>
          <View className="flex-row flex-wrap">
            {item.highlights.map((h, i) => (
              <HighlightChip key={i} text={h} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

// ----------------------------------------------------------------
// Loading animation — fun copy while waiting for Claude
// ----------------------------------------------------------------
const LOADING_MESSAGES = [
  "กำลังถามผู้ช่วย AI...",
  "วิเคราะห์วันว่างและงบประมาณของกลุ่ม...",
  "ค้นหาจุดหมายที่ใช่...",
  "เกือบเสร็จแล้ว รอแป๊บนึงนะ!",
];

function LoadingView() {
  const [msgIndex, setMsgIndex] = useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <View className="flex-1 items-center justify-center px-8">
      <ActivityIndicator size="large" color="#0f766e" />
      <AppText className="mt-6 text-center text-base font-semibold text-slate-700">
        {LOADING_MESSAGES[msgIndex]}
      </AppText>
      <AppText className="mt-2 text-center text-xs text-slate-400">
        Claude กำลังวิเคราะห์ข้อมูลของกลุ่มคุณอยู่
      </AppText>
    </View>
  );
}

// ----------------------------------------------------------------
// Main screen
// ----------------------------------------------------------------
export default function SuggestScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const trips = useTripStore((s) => s.trips);
  const user = useAuth((s) => s.user);

  const trip = trips.find((t) => t.id === tripId);
  const isLeader = trip?.trip_members?.some(
    (m) => m.user_id === user?.id && m.role === "leader",
  );

  const [result, setResult] = useState<SuggestionsResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Load saved suggestions on mount
  const loadSaved = useCallback(async () => {
    if (!tripId) return;
    setIsLoading(true);
    try {
      const saved = await getSavedSuggestions(tripId);
      if (saved) setResult(saved);
    } catch {
      // no saved suggestions, that's fine
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      loadSaved();
    }, [loadSaved]),
  );

  const handleGenerate = async () => {
    if (!tripId) return;
    setIsGenerating(true);
    try {
      const data = await generateSuggestions(tripId);
      setResult(data);
    } catch (err) {
      Alert.alert(
        "เกิดข้อผิดพลาด",
        err instanceof Error ? err.message : "ไม่สามารถสร้างคำแนะนำได้ กรุณาลองใหม่",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = async () => {
    if (!result) return;
    const lines = result.suggestions.map(
      (s, i) =>
        `${i + 1}. ${s.name} — ประมาณ ฿${formatMoney(s.estimated_cost_per_person)}/คน\n   ${s.highlights.join(" · ")}`,
    );
    const text = `🗺️ AI แนะนำจุดหมายสำหรับทริป "${trip?.name}"\n\n${lines.join("\n\n")}`;
    await Share.share({ message: text });
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-slate-50">
        <Stack.Screen options={{ title: "AI แนะนำจุดหมาย" }} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0f766e" />
        </View>
      </View>
    );
  }

  if (isGenerating) {
    return (
      <View className="flex-1 bg-slate-50">
        <Stack.Screen options={{ title: "AI แนะนำจุดหมาย" }} />
        <LoadingView />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <Stack.Screen options={{ title: "AI แนะนำจุดหมาย" }} />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
        {/* Header card */}
        <View className="mb-5 rounded-2xl bg-teal-600 p-5">
          <AppText className="text-lg font-bold text-white">จุดหมายที่เหมาะกับกลุ่มคุณ</AppText>
          <AppText className="mt-1 text-sm text-teal-100">
            AI วิเคราะห์จากวันว่าง งบประมาณ และความต้องการของทุกคนในกลุ่ม
          </AppText>
        </View>

        {/* No suggestions yet */}
        {!result && (
          <View className="mt-8 items-center px-6">
            <AppText className="text-4xl">🗺️</AppText>
            <AppText className="mt-4 text-center text-base font-semibold text-slate-700">
              ยังไม่มีคำแนะนำ
            </AppText>
            <AppText className="mt-2 text-center text-sm text-slate-500">
              {isLeader
                ? "กดปุ่มด้านล่างเพื่อให้ AI วิเคราะห์ข้อมูลของกลุ่มและแนะนำจุดหมาย"
                : "รอหัวหน้าทริปสร้างคำแนะนำ AI ก่อนนะ"}
            </AppText>
          </View>
        )}

        {/* Suggestion cards */}
        {result && (
          <>
            {result.generated_at && (
              <AppText className="mb-3 text-xs text-slate-400">
                สร้างเมื่อ{" "}
                {new Date(result.generated_at).toLocaleDateString("th-TH", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </AppText>
            )}

            {result.suggestions.map((item, i) => (
              <SuggestionCard key={item.name} item={item} index={i} />
            ))}

            <Pressable
              className="mt-2 h-11 flex-row items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white"
              onPress={handleShare}
            >
              <AppText className="font-semibold text-slate-700">แชร์ให้กลุ่ม</AppText>
            </Pressable>
          </>
        )}
      </ScrollView>

      {/* Generate button — floating at bottom, leader only */}
      {isLeader && (
        <View className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-white px-5 py-4">
          <Pressable
            className="h-12 items-center justify-center rounded-xl bg-teal-600"
            onPress={handleGenerate}
            disabled={isGenerating}
          >
            <AppText className="font-semibold text-white">
              {result ? "สร้างคำแนะนำใหม่อีกครั้ง" : "ให้ AI แนะนำจุดหมาย"}
            </AppText>
          </Pressable>
        </View>
      )}
    </View>
  );
}
