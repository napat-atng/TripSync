import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { AppText } from "../../../../components/AppText";
import { getSettlementSummary, markSplitsSettled } from "../../../../lib/expenses";
import type { DebtRecord } from "../../../../types/expense";

function formatAmount(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SettleScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settlingKey, setSettlingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tripId) return;
    setIsLoading(true);
    try {
      const data = await getSettlementSummary(tripId);
      setDebts(data);
    } catch {
      Alert.alert("Error", "Could not load settlement data.");
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => { load(); }, [load]);

  const handleSettle = async (debt: DebtRecord) => {
    const key = `${debt.from_member_id}→${debt.to_member_id}`;
    Alert.alert(
      "Mark as settled?",
      `${debt.from_name ?? "Member"} paid ${debt.to_name ?? "Member"} ฿${formatAmount(debt.amount)}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setSettlingKey(key);
            try {
              await markSplitsSettled(debt.split_ids);
              // Remove from list optimistically
              setDebts((prev) =>
                prev.filter(
                  (d) =>
                    !(d.from_member_id === debt.from_member_id &&
                      d.to_member_id === debt.to_member_id),
                ),
              );
            } catch {
              Alert.alert("Error", "Could not mark as settled.");
            } finally {
              setSettlingKey(null);
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <Stack.Screen options={{ title: "Settlement" }} />

      <FlatList
        data={debts}
        keyExtractor={(item) => `${item.from_member_id}→${item.to_member_id}`}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListHeaderComponent={
          <View className="mb-4">
            <AppText className="text-lg font-bold text-slate-900">Who owes who</AppText>
            <AppText className="mt-1 text-sm text-slate-400">
              {debts.length === 0
                ? "All settled up!"
                : `${debts.length} outstanding payment${debts.length !== 1 ? "s" : ""}`}
            </AppText>
          </View>
        }
        ListEmptyComponent={
          <View className="mt-16 items-center">
            {/* Checkmark circle */}
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <AppText className="text-3xl">✓</AppText>
            </View>
            <AppText className="text-base font-semibold text-slate-700">All settled up!</AppText>
            <AppText className="mt-1 text-sm text-slate-400">
              No outstanding payments in this trip.
            </AppText>
          </View>
        }
        renderItem={({ item }) => {
          const key = `${item.from_member_id}→${item.to_member_id}`;
          const isSettling = settlingKey === key;

          return (
            <View className="mb-3 rounded-xl border border-slate-200 bg-white p-4">
              {/* Debt row */}
              <View className="mb-3 flex-row items-center gap-3">
                {/* From avatar */}
                <View className="h-9 w-9 items-center justify-center rounded-full bg-red-100">
                  <AppText className="text-sm font-bold text-red-600">
                    {(item.from_name ?? "?")[0].toUpperCase()}
                  </AppText>
                </View>

                {/* Arrow + amount */}
                <View className="flex-1 items-center">
                  <AppText className="text-xs text-slate-400">owes</AppText>
                  <AppText className="text-base font-bold text-slate-900">
                    ฿{formatAmount(item.amount)}
                  </AppText>
                  <AppText className="text-xs text-slate-400">→</AppText>
                </View>

                {/* To avatar */}
                <View className="h-9 w-9 items-center justify-center rounded-full bg-green-100">
                  <AppText className="text-sm font-bold text-green-600">
                    {(item.to_name ?? "?")[0].toUpperCase()}
                  </AppText>
                </View>
              </View>

              {/* Names */}
              <View className="mb-3 flex-row justify-between px-1">
                <AppText className="text-xs font-medium text-slate-600">
                  {item.from_name ?? "Guest"}
                </AppText>
                <AppText className="text-xs font-medium text-slate-600">
                  {item.to_name ?? "Guest"}
                </AppText>
              </View>

              {/* Settle button */}
              <Pressable
                onPress={() => handleSettle(item)}
                disabled={isSettling}
                className="h-10 items-center justify-center rounded-lg bg-teal-600"
              >
                {isSettling
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <AppText className="text-sm font-semibold text-white">Mark as Settled</AppText>
                }
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}
