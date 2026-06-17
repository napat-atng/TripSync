import React from "react";
import { View } from "react-native";

import { AppText } from "./AppText";
import type { QuestionResult } from "../lib/survey-analytics";

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function SurveyResultsSection({ results }: { results: QuestionResult[] }) {
  if (results.length === 0) {
    return (
      <AppText className="text-sm text-slate-500">
        หัวหน้าทริปยังไม่ได้สร้างแบบสอบถาม
      </AppText>
    );
  }

  return (
    <View>
      {results.map((r) => (
        <View key={r.question.id} className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
          <AppText className="mb-3 text-sm font-semibold text-slate-900">{r.question.question}</AppText>

          {r.type === "multiple_choice" && (
            <MultipleChoiceBar result={r} />
          )}

          {r.type === "budget_range" && (
            <View>
              {r.values.length === 0 ? (
                <AppText className="text-xs text-slate-400">ยังไม่มีคำตอบ</AppText>
              ) : (
                <View className="flex-row gap-4">
                  <Stat label="ต่ำสุด" value={`฿${formatMoney(r.min ?? 0)}`} />
                  <Stat label="ค่ากลาง" value={`฿${formatMoney(r.median ?? 0)}`} />
                  <Stat label="สูงสุด" value={`฿${formatMoney(r.max ?? 0)}`} />
                </View>
              )}
            </View>
          )}

          {r.type === "text" && (
            <View>
              {r.answers.length === 0 ? (
                <AppText className="text-xs text-slate-400">ยังไม่มีคำตอบ</AppText>
              ) : (
                r.answers.map((a, idx) => (
                  <View
                    key={`${a.member_id}-${idx}`}
                    className="mb-2 rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <AppText className="text-xs font-medium text-slate-500">
                      {a.display_name ?? "ผู้เยี่ยม"}
                    </AppText>
                    <AppText className="text-sm text-slate-800">{a.answer}</AppText>
                  </View>
                ))
              )}
            </View>
          )}

          {r.type === "date_range" && (
            <View>
              {r.answers.length === 0 ? (
                <AppText className="text-xs text-slate-400">No responses yet.</AppText>
              ) : (
                r.answers.map((a, idx) => (
                  <View
                    key={`${a.member_id}-${idx}`}
                    className="mb-2 flex-row items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <AppText className="text-xs font-medium text-slate-500">
                      {a.display_name ?? "ผู้เยี่ยม"}
                    </AppText>
                    <AppText className="text-sm text-slate-800">
                      {a.start ?? "?"} → {a.end ?? "?"}
                    </AppText>
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center rounded-lg bg-slate-50 py-2">
      <AppText className="text-xs text-slate-400">{label}</AppText>
      <AppText className="text-sm font-semibold text-slate-900">{value}</AppText>
    </View>
  );
}

function MultipleChoiceBar({
  result,
}: {
  result: Extract<QuestionResult, { type: "multiple_choice" }>;
}) {
  const maxCount = Math.max(1, ...result.counts.map((c) => c.count));

  if (result.totalVotes === 0) {
    return <AppText className="text-xs text-slate-400">No responses yet.</AppText>;
  }

  return (
    <View>
      {result.counts.map((c) => {
        const pct = (c.count / maxCount) * 100;
        return (
          <View key={c.option} className="mb-2">
            <View className="mb-1 flex-row items-center justify-between">
              <AppText className="text-xs text-slate-700">{c.option}</AppText>
              <AppText className="text-xs text-slate-400">{c.count}</AppText>
            </View>
            <View className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <View
                className="h-2.5 rounded-full bg-teal-500"
                style={{ width: `${Math.max(pct, c.count > 0 ? 4 : 0)}%` }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}
