import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { Stack, router, useLocalSearchParams, useFocusEffect } from "expo-router";

import { AppText } from "../../../../components/AppText";
import { getExpensesByTrip, getTripTotalSpend } from "../../../../lib/expenses";
import type { ExpenseWithSplits } from "../../../../types/expense";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ExpenseListScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();

  const [expenses, setExpenses] = useState<ExpenseWithSplits[]>([]);
  const [totalSpend, setTotalSpend] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseWithSplits | null>(null);

  const load = useCallback(async () => {
    if (!tripId) return;
    setIsLoading(true);
    try {
      const [exps, total] = await Promise.all([
        getExpensesByTrip(tripId),
        getTripTotalSpend(tripId),
      ]);
      setExpenses(exps);
      setTotalSpend(total);
    } catch {
      Alert.alert("Error", "Could not load expenses.");
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  // Reload every time the screen gains focus (e.g. after adding an expense)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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

      {/* Total spend card */}
      <View className="px-5 pt-5">
        <View className="rounded-xl bg-teal-600 p-5">
          <AppText className="text-sm text-teal-100">Total trip spend</AppText>
          <AppText className="mt-1 text-3xl font-bold text-white">
            ฿{formatMoney(totalSpend)}
          </AppText>
          <AppText className="mt-1 text-xs text-teal-100">
            {expenses.length} expense{expenses.length !== 1 ? "s" : ""}
          </AppText>
        </View>

        <View className="mt-4 flex-row gap-3">
          <Pressable
            className="flex-1 h-11 items-center justify-center rounded-lg bg-white border border-slate-200"
            onPress={() => router.push(`/trips/${tripId}/expenses/add` as any)}
          >
            <AppText className="font-semibold text-slate-700">+ Add expense</AppText>
          </Pressable>
          <Pressable
            className="flex-1 h-11 items-center justify-center rounded-lg bg-slate-900"
            onPress={() => router.push(`/trips/${tripId}/expenses/settle` as any)}
          >
            <AppText className="font-semibold text-white">Settle up</AppText>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        ListEmptyComponent={
          <View className="mt-16 items-center">
            <AppText className="text-center text-base font-semibold text-slate-700">
              No expenses yet
            </AppText>
            <AppText className="mt-1 text-center text-sm text-slate-500">
              Add your first expense to start tracking.
            </AppText>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            className="mb-3 rounded-xl border border-slate-200 bg-white p-4"
            onPress={() => setSelectedExpense(item)}
          >
            <View className="flex-row items-center justify-between">
              <AppText className="flex-1 text-base font-semibold text-slate-900" numberOfLines={1}>
                {item.title}
              </AppText>
              <AppText className="text-base font-semibold text-slate-900">
                ฿{formatMoney(item.amount)}
              </AppText>
            </View>
            <View className="mt-2 flex-row items-center justify-between">
              <AppText className="text-xs text-slate-500">
                Paid by {item.paid_by_name ?? "Unknown"} · {formatDate(item.expense_date)}
              </AppText>
              <AppText className="text-xs text-slate-400">
                Split {item.splits.length} way{item.splits.length !== 1 ? "s" : ""}
              </AppText>
            </View>
          </Pressable>
        )}
      />

      {/* Detail modal */}
      <Modal
        visible={!!selectedExpense}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedExpense(null)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setSelectedExpense(null)}
        >
          <Pressable onPress={() => {}} className="rounded-t-2xl bg-white p-6 pb-10">
            {selectedExpense && (
              <>
                <View className="mb-1 flex-row items-center justify-between">
                  <AppText className="text-lg font-bold text-slate-900">
                    {selectedExpense.title}
                  </AppText>
                  <Pressable onPress={() => setSelectedExpense(null)}>
                    <AppText className="text-slate-500">Close</AppText>
                  </Pressable>
                </View>
                <AppText className="mb-4 text-sm text-slate-500">
                  ฿{formatMoney(selectedExpense.amount)} · paid by{" "}
                  {selectedExpense.paid_by_name ?? "Unknown"} ·{" "}
                  {formatDate(selectedExpense.expense_date)}
                </AppText>

                <AppText className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Who owes what
                </AppText>

                {selectedExpense.splits.map((s) => {
                  const isPayer = s.member_id === selectedExpense.paid_by;
                  return (
                    <View
                      key={s.id}
                      className="mb-2 flex-row items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5"
                    >
                      <AppText className="text-sm text-slate-800">
                        {s.display_name ?? "Unnamed"}
                        {isPayer ? " (paid)" : ""}
                      </AppText>
                      <View className="flex-row items-center gap-2">
                        <AppText className="text-sm font-semibold text-slate-900">
                          ฿{formatMoney(s.share_amount)}
                        </AppText>
                        {s.settled ? (
                          <View className="rounded-full bg-green-100 px-2 py-0.5">
                            <AppText className="text-xs font-medium text-green-700">Settled</AppText>
                          </View>
                        ) : (
                          <View className="rounded-full bg-amber-100 px-2 py-0.5">
                            <AppText className="text-xs font-medium text-amber-700">Pending</AppText>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
