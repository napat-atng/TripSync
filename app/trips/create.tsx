import { useState } from "react";
import { View, TextInput, Pressable, Alert, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useForm, Controller } from "react-hook-form";

import { AppText } from "../../components/AppText";
import { createTrip } from "../../lib/trips";
import { getProfile } from "../../lib/profile";
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
      
      let displayName = "หัวหน้าทริป";
      try {
        const profile = await getProfile(user.id);
        const emailPrefix = user.email ? user.email.split("@")[0] : "";
        if (profile.name && profile.name !== emailPrefix && profile.name !== user.email) {
          displayName = profile.name;
        }
      } catch (e) {
        // Fallback to default
      }
      
      const trip = await createTrip(data.name, data.description || null, user.id, displayName);
      router.replace(`/trips/${trip.id}/dashboard` as any);
    } catch (error: any) {
      Alert.alert(
        "สร้างทริปไม่สำเร็จ",
        error?.message || JSON.stringify(error) || "กรุณาลองใหม่อีกครั้ง"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-slate-50 px-6 pt-10">
      <View className="mb-8">
        <AppText className="text-3xl font-bold text-slate-950">สร้างทริปใหม่</AppText>
        <AppText className="mt-2 text-base text-slate-600">
          จะไปที่ไหนกันดี?
        </AppText>
      </View>

      <View className="mb-6">
        <AppText className="mb-2 text-sm font-semibold text-slate-700">
          ชื่อทริป *
        </AppText>
        <Controller
          control={control}
          rules={{ required: "กรุณากรอกชื่อทริป" }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className="h-14 rounded-lg border border-slate-300 bg-white px-4 text-base"
              placeholder="เช่น สายฟ้าไปโตเกียว"
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
          รายละเอียด (ไม่บังคับ)
        </AppText>
        <Controller
          control={control}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className="min-h-[100px] rounded-lg border border-slate-300 bg-white p-4 text-base"
              placeholder="ทริปนี้เป็นยังไง?"
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
          <AppText className="text-base font-semibold text-white">สร้างทริป</AppText>
        )}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        className="mt-4 h-14 items-center justify-center rounded-lg"
        disabled={isSubmitting}
        onPress={() => router.back()}
      >
        <AppText className="text-base font-semibold text-slate-600">ยกเลิก</AppText>
      </Pressable>
    </View>
  );
}
