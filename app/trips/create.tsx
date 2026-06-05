import { useState } from "react";
import { View, TextInput, Pressable, Alert, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useForm, Controller } from "react-hook-form";

import { AppText } from "../../components/AppText";
import { createTrip } from "../../lib/trips";
import { useAuth } from "../../hooks/useAuth";

type CreateTripFormData = {
  name: string;
  description: string;
};

export default function CreateTripScreen() {
  const { control, handleSubmit, formState: { errors } } = useForm<CreateTripFormData>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const user = useAuth((state) => state.user);

  const onSubmit = async (data: CreateTripFormData) => {
    if (!user) return;
    try {
      setIsSubmitting(true);
      const displayName = user.email ? user.email.split("@")[0] : "Leader";
      const trip = await createTrip(data.name, data.description || null, user.id, displayName);
      router.replace(`/trips/${trip.id}/dashboard` as any);
    } catch (error: any) {
      Alert.alert(
        "Failed to create trip",
        error?.message || JSON.stringify(error) || "Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-slate-50 px-6 pt-10">
      <View className="mb-8">
        <AppText className="text-3xl font-bold text-slate-950">New Trip</AppText>
        <AppText className="mt-2 text-base text-slate-600">
          Where are we going?
        </AppText>
      </View>

      <View className="mb-6">
        <AppText className="mb-2 text-sm font-semibold text-slate-700">
          Trip Name *
        </AppText>
        <Controller
          control={control}
          rules={{ required: "Trip name is required" }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className="h-14 rounded-lg border border-slate-300 bg-white px-4 text-base"
              placeholder="e.g. Summer in Tokyo"
              placeholderTextColor="#94a3b8"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
          name="name"
        />
        {errors.name && (
          <AppText className="mt-1 text-sm text-red-500">{errors.name.message}</AppText>
        )}
      </View>

      <View className="mb-8">
        <AppText className="mb-2 text-sm font-semibold text-slate-700">
          Description (Optional)
        </AppText>
        <Controller
          control={control}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className="min-h-[100px] rounded-lg border border-slate-300 bg-white p-4 text-base"
              placeholder="What's the vibe?"
              placeholderTextColor="#94a3b8"
              multiline
              textAlignVertical="top"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
          name="description"
        />
      </View>

      <Pressable
        accessibilityRole="button"
        className="h-14 items-center justify-center rounded-lg bg-teal-600 shadow-sm"
        disabled={isSubmitting}
        onPress={handleSubmit(onSubmit)}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <AppText className="text-base font-semibold text-white">Create Trip</AppText>
        )}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        className="mt-4 h-14 items-center justify-center rounded-lg"
        disabled={isSubmitting}
        onPress={() => router.back()}
      >
        <AppText className="text-base font-semibold text-slate-600">Cancel</AppText>
      </Pressable>
    </View>
  );
}
