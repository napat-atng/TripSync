import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, TextInput, View } from "react-native";
import { Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import { AppText } from "../components/AppText";
import { useAuth } from "../hooks/useAuth";
import { getProfile, updateProfile, uploadAvatar } from "../lib/profile";

export default function ProfileScreen() {
  const user = useAuth((state) => state.user);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [user?.id]);

  const loadProfile = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      const profile = await getProfile(user.id);
      setName(profile.name ?? user.email?.split("@")[0] ?? "");
      setAvatarUrl(profile.avatar_url);
    } catch {
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถโหลดโปรไฟล์ได้");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickAvatar = async () => {
    if (!user?.id) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("ต้องการสิทธิ์เข้าถึงรูป", "กรุณาอนุญาตให้ TripSync เลือกรูปจากเครื่อง");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) return;

    try {
      setIsSaving(true);
      const asset = result.assets[0];
      const publicUrl = await uploadAvatar(user.id, asset.uri, asset.mimeType);
      await updateProfile(user.id, { name: name.trim() || null, avatar_url: publicUrl });
      setAvatarUrl(publicUrl);
      Alert.alert("อัปเดตรูปแล้ว", "บันทึกรูปโปรไฟล์เรียบร้อย");
    } catch {
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถอัปโหลดรูปโปรไฟล์ได้");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;

    try {
      setIsSaving(true);
      await updateProfile(user.id, { name: name.trim() || null, avatar_url: avatarUrl });
      Alert.alert("บันทึกเรียบร้อย", "อัปเดตโปรไฟล์แล้ว");
    } catch {
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถบันทึกโปรไฟล์ได้");
    } finally {
      setIsSaving(false);
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
    <View className="flex-1 bg-slate-50 px-6 pt-8">
      <Stack.Screen options={{ title: "โปรไฟล์" }} />

      <View className="items-center">
        <Pressable
          className="h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-slate-200"
          onPress={handlePickAvatar}
          disabled={isSaving}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} className="h-28 w-28" />
          ) : (
            <AppText className="text-4xl font-bold text-slate-500">
              {(name || user?.email || "?").slice(0, 1).toUpperCase()}
            </AppText>
          )}
        </Pressable>
        <Pressable className="mt-3" onPress={handlePickAvatar} disabled={isSaving}>
          <AppText className="font-semibold text-teal-700">เปลี่ยนรูปโปรไฟล์</AppText>
        </Pressable>
      </View>

      <View className="mt-8">
        <AppText className="mb-2 text-sm font-semibold text-slate-700">ชื่อเล่น</AppText>
        <TextInput
          className="h-14 rounded-lg border border-slate-300 bg-white px-4 text-base text-slate-900"
          placeholder="ชื่อที่อยากให้เพื่อนเห็น"
          value={name}
          onChangeText={setName}
          editable={!isSaving}
        />
      </View>

      <View className="mt-5">
        <AppText className="mb-2 text-sm font-semibold text-slate-700">อีเมล</AppText>
        <View className="h-14 justify-center rounded-lg border border-slate-200 bg-slate-100 px-4">
          <AppText className="text-base text-slate-500">{user?.email ?? "-"}</AppText>
        </View>
      </View>

      <Pressable
        className="mt-8 h-14 items-center justify-center rounded-lg bg-teal-600"
        onPress={handleSave}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <AppText className="text-base font-semibold text-white">บันทึกโปรไฟล์</AppText>
        )}
      </Pressable>
    </View>
  );
}
