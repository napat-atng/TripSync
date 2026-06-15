import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  FlatList,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";

import { AppText } from "../../../../components/AppText";
import { getExpensesByTrip } from "../../../../lib/expenses";
import type { Expense } from "../../../../types/expense";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatAmount(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Detail Modal ────────────────────────────────────────────────────────────

function ExpenseDetailModal({
  expense,
  onClose,
}: {
  expense: Expense;
  onClose: () => void;
}) {
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable onPress={() => {}} className="rounded-t-2xl bg-white p-6 pb-10">
          <View className="mb-1 flex-row items-center justify-between">
            <AppText className="text-lg font-bold text-slate-900">{expense.title}</AppText>
            <Pressable onPress={onClose}>
              <AppText className="text-slate-400">Close</AppText>
            </Pressable>
          </View>

          <AppText className="mb-4 text-sm text-slate-500">
            Paid by {expense.payer_name ?? "Unknown"} · {formatDate(expense.expense_date)}
          </AppText>

          <View className="mb-4 rounded-xl bg-teal-50 p-4">
            <AppText className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              Total
            </AppText>
            <AppText className="text-2xl font-bold text-teal-800">
              ฿{formatAmount(expense.amount)}
            </AppText>
          </View>

          <AppText className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Split
          </AppText>

          {(expense.splits ?? []).map((split) => (
            <View key={split.id} className="mb-2 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <View className="h-7 w-7 items-center justify-center rounded-full bg-slate-100">
                  <AppText className="text-xs font-bold text-slate-600">
                    {(split.member_name ?? "?")[0].toUpperCase()}
                  </AppText>
                </View>
                <AppText className="text-sm text-slate-700">
                  {split.member_name ?? "Guest"}
                </AppText>
              </View>
              <View className="flex-row items-center gap-2">
                <AppText className="text-sm font-semibold text-slate-800">
                  ฿{formatAmount(split.share_amount)}
                </AppText>
                {split.settled && (
                  <View className="rounded-full bg-green-100 px-2 py-0.5">
                    <AppText className="text-xs text-green-700">settled</AppText>
                  </View>
                )}
              </View>
            </View>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ExpenseListScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<Expense | null>(null);

  const load = useCallback(async () => {
    if (!tripId) return;
    setIsLoading(true);
    try {
      const data = await getExpensesByTrip(tripId);
      setExpenses(data);
    } catch {
      Alert.alert("Error", "Could not load expenses.");
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => { load(); }, [load]);

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <Stack.Screen options={{ title: "Expenses" }} />

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListHeaderComponent={
          <View>
            {/* Total card */}
            <View className="mb-4 rounded-2xl bg-teal-600 p-5">
              <AppText className="text-sm font-medium text-teal-100">Total trip spend</AppText>
              <AppText className="mt-1 text-3xl font-bold text-white">
                ฿{formatAmount(total)}
              </AppText>
              <AppText className="mt-1 text-xs text-teal-200">
                {expenses.length} expense{expenses.length !== 1 ? "s" : ""}
              </AppText>
            </View>

            {/* Settle button */}
            <Pressable
              className="mb-4 h-11 items-center justify-center rounded-xl border border-teal-600 bg-white"
              onPress={() => router.push(`/trips/${tripId}/expenses/settle` as any)}
            >
              <AppText className="font-semibold text-teal-700">View Settlement Summary</AppText>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          <View className="mt-10 items-center">
            <AppText className="text-base font-semibold text-slate-600">No expenses yet</AppText>
            <AppText className="mt-1 text-sm text-slate-400">Tap + to add the first one</AppText>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            className="mb-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
            onPress={() => setSelected(item)}
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-1 mr-3">
                <AppText className="text-base font-semibold text-slate-900" numberOfLines={1}>
                  {item.title}
                </AppText>
                <AppText className="mt-0.5 text-xs text-slate-400">
                  Paid by {item.payer_name ?? "Unknown"} · {formatDate(item.expense_date)}
                </AppText>
                <AppText className="mt-0.5 text-xs text-slate-400">
                  Split {item.splits?.length ?? 0} ways
                </AppText>
              </View>
              <AppText className="text-base font-bold text-slate-800">
                ฿{formatAmount(Number(item.amount))}
              </AppText>
            </View>
          </Pressable>
        )}
      />

      {/* FAB */}
      <Pressable
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-teal-600 shadow-lg"
        onPress={() => router.push(`/trips/${tripId}/expenses/add` as any)}
      >
        <AppText className="text-3xl text-white">+</AppText>
      </Pressable>

      {selected && (
        <ExpenseDetailModal expense={selected} onClose={() => setSelected(null)} />
      )}
    </View>
  );
}
