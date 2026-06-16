import React, { useCallback, useState } from "react";
import { View, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { Stack, useLocalSearchParams, useFocusEffect } from "expo-router";

import { AppText } from "../../../../components/AppText";
import { getSettlementSummary, markDebtAsSettled } from "../../../../lib/expenses";
import type { MemberBalance, SimplifiedDebt } from "../../../../types/expense";

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SettleUpScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();

  const [balances, setBalances] = useState<MemberBalance[]>([]);
  const [debts, setDebts] = useState<SimplifiedDebt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settlingKey, setSettlingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tripId) return;
    setIsLoading(true);
    try {
      const summary = await getSettlementSummary(tripId);
      setBalances(summary.balances);
      setDebts(summary.debts);
    } catch {
      Alert.alert("Error", "Could not load settlement summary.");
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleSettle = async (debt: SimplifiedDebt) => {
    const key = `${debt.from_member_id}-${debt.to_member_id}`;
    setSettlingKey(key);
    try {
      await markDebtAsSettled(debt.split_ids);
      await load();
    } catch {
      Alert.alert("Error", "Could not mark as settled. Please try again.");
    } finally {
      setSettlingKey(null);
    }
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
      <Stack.Screen options={{ title: "Settle Up" }} />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        {/* Outstanding debts */}
        <AppText className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Outstanding balances
        </AppText>

        {debts.length === 0 ? (
          <View className="mb-6 items-center rounded-xl border border-slate-200 bg-white p-8">
            <AppText className="text-base font-semibold text-slate-700">All settled up! 🎉</AppText>
            <AppText className="mt-1 text-sm text-slate-500">No outstanding debts.</AppText>
          </View>
        ) : (
          <View className="mb-6">
            {debts.map((debt) => {
              const key = `${debt.from_member_id}-${debt.to_member_id}`;
              const isSettling = settlingKey === key;
              return (
                <View
                  key={key}
                  className="mb-3 rounded-xl border border-slate-200 bg-white p-4"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <AppText className="text-sm text-slate-800">
                        <AppText className="font-semibold text-slate-900">
                          {debt.from_name ?? "Unnamed"}
                        </AppText>{" "}
                        owes{" "}
                        <AppText className="font-semibold text-slate-900">
                          {debt.to_name ?? "Unnamed"}
                        </AppText>
                      </AppText>
                      <AppText className="mt-1 text-lg font-bold text-amber-600">
                        ฿{formatMoney(debt.amount)}
                      </AppText>
                    </View>
                    <Pressable
                      className="h-9 items-center justify-center rounded-lg bg-teal-600 px-4"
                      onPress={() => handleSettle(debt)}
                      disabled={isSettling}
                    >
                      {isSettling ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <AppText className="text-sm font-semibold text-white">Mark settled</AppText>
                      )}
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Per-member balance breakdown */}
        <AppText className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Balance breakdown
        </AppText>

        <View className="rounded-xl border border-slate-200 bg-white">
          {balances.map((b, idx) => {
            const isPositive = b.net > 0.01;
            const isNegative = b.net < -0.01;
            return (
              <View
                key={b.member_id}
                className={`flex-row items-center justify-between px-4 py-3 ${
                  idx !== balances.length - 1 ? "border-b border-slate-100" : ""
                }`}
              >
                <View>
                  <AppText className="text-sm font-medium text-slate-800">
                    {b.display_name ?? "Unnamed"}
                  </AppText>
                  <AppText className="text-xs text-slate-400">
                    Paid ฿{formatMoney(b.paid)} · Owed ฿{formatMoney(b.owed)}
                  </AppText>
                </View>
                <AppText
                  className={`text-sm font-semibold ${
                    isPositive ? "text-green-600" : isNegative ? "text-red-500" : "text-slate-400"
                  }`}
                >
                  {isPositive ? "+" : ""}
                  ฿{formatMoney(b.net)}
                </AppText>
              </View>
            );
          })}
        </View>

        <AppText className="mt-4 text-center text-xs text-slate-400">
          Positive balance means the group owes that person money.
        </AppText>
      </ScrollView>
    </View>
  );
}
