import React, { useEffect, useState } from "react";
import {
  View,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Controller, useForm } from "react-hook-form";
import { Stack, router, useLocalSearchParams } from "expo-router";

import { AppText } from "../../../../components/AppText";
import { getMembersByTrip } from "../../../../lib/members";
import { addExpense } from "../../../../lib/expenses";
import type { TripMember } from "../../../../types/trip";

type FormValues = {
  title: string;
  amount: string;
  paidBy: string;
  expenseDate: string; // YYYY-MM-DD
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AddExpenseScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();

  const [members, setMembers] = useState<TripMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [selectedSplitIds, setSelectedSplitIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      title: "",
      amount: "",
      paidBy: "",
      expenseDate: todayISO(),
    },
  });

  const paidBy = watch("paidBy");

  useEffect(() => {
    loadMembers();
  }, [tripId]);

  const loadMembers = async () => {
    try {
      const data = await getMembersByTrip(tripId!);
      setMembers(data);
      // default: everyone selected
      setSelectedSplitIds(new Set(data.map((m) => m.id)));
      if (data.length > 0) {
        setValue("paidBy", data[0].id);
      }
    } catch {
      Alert.alert("Error", "Could not load trip members.");
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const toggleSplitMember = (memberId: string) => {
    setSelectedSplitIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const onSubmit = async (values: FormValues) => {
    const amountNum = parseFloat(values.amount);

    if (!values.title.trim()) {
      Alert.alert("Missing title", "Please enter a title for this expense.");
      return;
    }
    if (!amountNum || amountNum <= 0) {
      Alert.alert("Invalid amount", "Please enter a valid amount greater than 0.");
      return;
    }
    if (!values.paidBy) {
      Alert.alert("Missing payer", "Please select who paid.");
      return;
    }
    if (selectedSplitIds.size === 0) {
      Alert.alert("No split selected", "Select at least one member to split this with.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addExpense(tripId!, {
        title: values.title.trim(),
        amount: amountNum,
        paidBy: values.paidBy,
        expenseDate: values.expenseDate,
        splitMemberIds: Array.from(selectedSplitIds),
      });
      router.back();
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Could not save expense. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const amountValue = parseFloat(watch("amount") || "0");
  const perPersonShare =
    selectedSplitIds.size > 0 && amountValue > 0
      ? (amountValue / selectedSplitIds.size).toFixed(2)
      : "0.00";

  if (isLoadingMembers) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <Stack.Screen options={{ title: "Add Expense" }} />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        {/* Title */}
        <AppText className="mb-1 text-sm font-medium text-slate-600">Title</AppText>
        <Controller
          control={control}
          name="title"
          render={({ field: { value, onChange } }) => (
            <TextInput
              className="mb-4 h-12 rounded-lg border border-slate-200 bg-white px-4 text-base text-slate-900"
              placeholder="e.g. Dinner at the beach"
              value={value}
              onChangeText={onChange}
            />
          )}
        />

        {/* Amount */}
        <AppText className="mb-1 text-sm font-medium text-slate-600">Amount (THB)</AppText>
        <Controller
          control={control}
          name="amount"
          render={({ field: { value, onChange } }) => (
            <TextInput
              className="mb-4 h-12 rounded-lg border border-slate-200 bg-white px-4 text-base text-slate-900"
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={value}
              onChangeText={onChange}
            />
          )}
        />

        {/* Date */}
        <AppText className="mb-1 text-sm font-medium text-slate-600">Date</AppText>
        <Controller
          control={control}
          name="expenseDate"
          render={({ field: { value, onChange } }) => (
            <TextInput
              className="mb-4 h-12 rounded-lg border border-slate-200 bg-white px-4 text-base text-slate-900"
              placeholder="YYYY-MM-DD"
              value={value}
              onChangeText={onChange}
            />
          )}
        />

        {/* Paid by */}
        <AppText className="mb-2 text-sm font-medium text-slate-600">Paid by</AppText>
        <View className="mb-5 flex-row flex-wrap gap-2">
          {members.map((m) => {
            const isSelected = paidBy === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => setValue("paidBy", m.id)}
                className={`rounded-full border px-4 py-2 ${
                  isSelected ? "border-teal-600 bg-teal-600" : "border-slate-200 bg-white"
                }`}
              >
                <AppText
                  className={`text-sm font-medium ${isSelected ? "text-white" : "text-slate-700"}`}
                >
                  {m.display_name ?? "Unnamed"}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {/* Split between */}
        <View className="mb-2 flex-row items-center justify-between">
          <AppText className="text-sm font-medium text-slate-600">Split between</AppText>
          <AppText className="text-xs text-slate-400">
            {selectedSplitIds.size} of {members.length} selected
          </AppText>
        </View>

        <View className="mb-5 rounded-xl border border-slate-200 bg-white">
          {members.map((m, idx) => {
            const checked = selectedSplitIds.has(m.id);
            return (
              <Pressable
                key={m.id}
                onPress={() => toggleSplitMember(m.id)}
                className={`flex-row items-center justify-between px-4 py-3 ${
                  idx !== members.length - 1 ? "border-b border-slate-100" : ""
                }`}
              >
                <AppText className="text-sm text-slate-800">{m.display_name ?? "Unnamed"}</AppText>
                <View
                  className={`h-5 w-5 items-center justify-center rounded-md border ${
                    checked ? "border-teal-600 bg-teal-600" : "border-slate-300 bg-white"
                  }`}
                >
                  {checked && <AppText className="text-xs font-bold text-white">✓</AppText>}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Per-person preview */}
        {selectedSplitIds.size > 0 && (
          <View className="mb-6 rounded-lg bg-teal-50 p-4">
            <AppText className="text-sm text-teal-800">
              Each person pays{" "}
              <AppText className="font-semibold text-teal-900">฿{perPersonShare}</AppText>
            </AppText>
          </View>
        )}

        <Pressable
          className="h-12 items-center justify-center rounded-lg bg-teal-600"
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <AppText className="font-semibold text-white">Save Expense</AppText>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}
