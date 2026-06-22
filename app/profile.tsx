import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, View } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Camera, Mail, User } from "lucide-react-native";

import { AppText } from "../components/AppText";
import { useAuth } from "../hooks/useAuth";
import { getProfile, updateProfile, uploadAvatar } from "../lib/profile";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

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
      Alert.alert("บันทึกเรียบร้อย", "อัปเดตโปรไฟล์แล้ว", [
        { text: "ตกลง", onPress: () => router.back() }
      ]);
    } catch {
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถบันทึกโปรไฟล์ได้");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-50">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-50 px-6 pt-8">

      <View className="items-center mb-8">
        <Pressable
          className="relative h-32 w-32 items-center justify-center rounded-full bg-surface-200 border-4 border-white shadow-sm"
          onPress={handlePickAvatar}
          disabled={isSaving}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} className="h-full w-full rounded-full" />
          ) : (
            <AppText className="text-5xl font-bold text-primary-500">
              {(name || user?.email || "?").slice(0, 1).toUpperCase()}
            </AppText>
          )}
          
          <View className="absolute bottom-0 right-0 bg-primary-600 rounded-full p-2 border-2 border-white shadow-sm">
            <Camera size={16} color="#ffffff" />
          </View>
        </Pressable>
      </View>

      <View className="space-y-4">
        <Input
          label="ชื่อเล่น"
          placeholder="ชื่อที่อยากให้เพื่อนเห็น"
          value={name}
          onChangeText={setName}
          editable={!isSaving}
          icon={<User size={20} color="#94a3b8" />}
        />

        <View className="mb-4">
          <AppText className="text-sm font-medium text-surface-700 ml-1 mb-1.5">
            อีเมล
          </AppText>
          <View className="relative justify-center">
            <View className="absolute left-4 z-10">
              <Mail size={20} color="#94a3b8" />
            </View>
            <View className="flex h-14 w-full justify-center rounded-xl border border-surface-200 bg-surface-100 px-4 pl-12">
              <AppText className="text-base text-surface-500">{user?.email ?? "-"}</AppText>
            </View>
          </View>
        </View>
      </View>

      <View className="mt-8 flex-1">
        <Button
          onPress={handleSave}
          loading={isSaving}
        >
          บันทึกโปรไฟล์
        </Button>
      </View>
    </View>
  );
}
