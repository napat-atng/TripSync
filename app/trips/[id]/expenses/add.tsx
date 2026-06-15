import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";

import { AppText } from "../../../../components/AppText";
import { useAuth } from "../../../../hooks/useAuth";
import { getMembersByTrip, getMyMemberId } from "../../../../lib/members";
import { addExpense } from "../../../../lib/expenses";
import type { TripMember } from "../../../../types/trip";

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export default function AddExpenseScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const user = useAuth((s) => s.user);

  const [members, setMembers] = useState<TripMember[]>([]);
  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [amountText, setAmountText] = useState("");
  const [paidBy, setPaidBy] = useState<string>("");
  const [date, setDate] = useState(todayISO());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!tripId || !user) return;
    try {
      const [mems, mid] = await Promise.all([
        getMembersByTrip(tripId),
        getMyMemberId(tripId, user.id),
      ]);
      setMembers(mems);
      // Default payer = current user's member
      const defaultPayer = mid ?? mems[0]?.id ?? "";
      setPaidBy(defaultPayer);
      // Default: all selected
      setSelectedIds(new Set(mems.map((m) => m.id)));
      setMyMemberId(mid ?? null);
    } catch {
      Alert.alert("Error", "Could not load members.");
    } finally {
      setIsLoading(false);
    }
  }, [tripId, user]);

  useEffect(() => { load(); }, [load]);

  const toggleMember = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size === 1) return prev; // must keep at least one
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const sharePerPerson = () => {
    const amount = parseFloat(amountText);
    if (!amount || selectedIds.size === 0) return 0;
    return Math.round((amount / selectedIds.size) * 100) / 100;
  };

  const handleSubmit = async () => {
    const amount = parseFloat(amountText);

    if (!title.trim()) { Alert.alert("Error", "Please enter a title."); return; }
    if (!amount || amount <= 0) { Alert.alert("Error", "Please enter a valid amount."); return; }
    if (!paidBy) { Alert.alert("Error", "Please select who paid."); return; }
    if (selectedIds.size === 0) { Alert.alert("Error", "Select at least one person to split with."); return; }

    setIsSubmitting(true);
    try {
      await addExpense(tripId!, {
        title: title.trim(),
        amount,
        paid_by: paidBy,
        expense_date: new Date(date).toISOString(),
        split_member_ids: Array.from(selectedIds),
      });
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not save expense.");
    } finally {
      setIsSubmitting(false);
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
      <Stack.Screen options={{ title: "Add Expense" }} />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>

        {/* Title */}
        <AppText className="mb-1 text-sm font-semibold text-slate-700">Title</AppText>
        <TextInput
          className="mb-4 h-12 rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900"
          placeholder="e.g. Dinner, Hotel, Transport"
          value={title}
          onChangeText={setTitle}
        />

        {/* Amount */}
        <AppText className="mb-1 text-sm font-semibold text-slate-700">Amount (THB)</AppText>
        <TextInput
          className="mb-4 h-12 rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900"
          placeholder="0.00"
          keyboardType="decimal-pad"
          value={amountText}
          onChangeText={setAmountText}
        />

        {/* Date */}
        <AppText className="mb-1 text-sm font-semibold text-slate-700">Date</AppText>
        <TextInput
          className="mb-4 h-12 rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900"
          placeholder="YYYY-MM-DD"
          value={date}
          onChangeText={setDate}
        />

        {/* Paid by */}
        <AppText className="mb-2 text-sm font-semibold text-slate-700">Paid by</AppText>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {members.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => setPaidBy(m.id)}
              className={`rounded-full border px-4 py-2 ${
                paidBy === m.id
                  ? "border-teal-600 bg-teal-600"
                  : "border-slate-200 bg-white"
              }`}
            >
              <AppText
                className={`text-sm font-medium ${
                  paidBy === m.id ? "text-white" : "text-slate-700"
                }`}
              >
                {m.display_name ?? "Guest"}
                {m.id === myMemberId ? " (me)" : ""}
              </AppText>
            </Pressable>
          ))}
        </View>

        {/* Split between */}
        <View className="mb-2 flex-row items-center justify-between">
          <AppText className="text-sm font-semibold text-slate-700">Split between</AppText>
          {selectedIds.size > 0 && parseFloat(amountText) > 0 && (
            <View className="rounded-full bg-teal-50 px-3 py-1">
              <AppText className="text-xs font-semibold text-teal-700">
                ฿{sharePerPerson().toLocaleString()} / person
              </AppText>
            </View>
          )}
        </View>

        <View className="mb-6 rounded-xl border border-slate-200 bg-white overflow-hidden">
          {members.map((m, i) => {
            const checked = selectedIds.has(m.id);
            return (
              <Pressable
                key={m.id}
                onPress={() => toggleMember(m.id)}
                className={`flex-row items-center px-4 py-3 ${
                  i < members.length - 1 ? "border-b border-slate-100" : ""
                }`}
              >
                {/* Checkbox */}
                <View
                  className={`mr-3 h-5 w-5 items-center justify-center rounded border ${
                    checked ? "border-teal-600 bg-teal-600" : "border-slate-300 bg-white"
                  }`}
                >
                  {checked && <AppText className="text-xs text-white">✓</AppText>}
                </View>
                <AppText className="flex-1 text-sm text-slate-800">
                  {m.display_name ?? "Guest"}
                  {m.id === myMemberId ? " (me)" : ""}
                </AppText>
                {m.id === paidBy && (
                  <View className="rounded-full bg-slate-100 px-2 py-0.5">
                    <AppText className="text-xs text-slate-500">payer</AppText>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Submit */}
      <View className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-white px-4 py-4 pb-8">
        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting}
          className="h-12 items-center justify-center rounded-xl bg-teal-600"
        >
          {isSubmitting
            ? <ActivityIndicator color="#fff" />
            : <AppText className="text-base font-semibold text-white">Save Expense</AppText>
          }
        </Pressable>
      </View>
    </View>
  );
}
