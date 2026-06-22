import { useState } from "react";
import { View, Alert } from "react-native";
import { router } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { Map, MapPin } from "lucide-react-native";

import { AppText } from "../../components/AppText";
import { createTrip } from "../../lib/trips";
import { getProfile } from "../../lib/profile";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

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
    <View className="flex-1 bg-surface-50 px-6 pt-10">
      <View className="mb-8 items-center">
        <View className="h-20 w-20 items-center justify-center rounded-2xl bg-primary-100 mb-4">
          <Map size={40} color="#4f46e5" strokeWidth={2} />
        </View>
        <AppText className="text-3xl font-extrabold text-surface-950">เริ่มทริปใหม่</AppText>
        <AppText className="mt-2 text-base text-surface-500">
          ตั้งชื่อและรายละเอียดให้เพื่อนๆ รู้ว่าเราจะไปไหนกัน!
        </AppText>
      </View>

      <Controller
        control={control}
        rules={{ required: "กรุณากรอกชื่อทริป" }}
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="ชื่อทริป"
            placeholder="เช่น โตเกียวสัปดาห์หน้า"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            error={errors.name?.message}
            icon={<MapPin size={20} color="#94a3b8" />}
          />
        )}
        name="name"
      />

      <Controller
        control={control}
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="รายละเอียด (ไม่บังคับ)"
            placeholder="ทริปนี้เป็นยังไง?"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            multiline
            numberOfLines={4}
            className="h-32 pt-4"
            textAlignVertical="top"
          />
        )}
        name="description"
      />

      <View className="mt-auto pb-10 gap-3">
        <Button
          loading={isSubmitting}
          onPress={handleSubmit(onSubmit)}
          size="lg"
        >
          สร้างทริปเลย!
        </Button>

        <Button
          variant="ghost"
          onPress={() => router.back()}
          disabled={isSubmitting}
        >
          ยกเลิก
        </Button>
      </View>
    </View>
  );
}
