import { useEffect, useState } from "react";
import { Alert, Pressable, View, FlatList, ActivityIndicator, TextInput } from "react-native";
import { router } from "expo-router";

import { AppText } from "../../components/AppText";
import { useAuth } from "../../hooks/useAuth";
import { useTripStore } from "../../store/tripStore";
import { getUserTrips } from "../../lib/trips";

export default function HomeScreen() {
  const { trips, setTrips, isLoading, setIsLoading } = useTripStore();
  const user = useAuth((state) => state.user);
  const signOut = useAuth((state) => state.signOut);
  const [inviteLink, setInviteLink] = useState("");

  useEffect(() => {
    if (user) {
      loadTrips();
    }
  }, [user]);

  const loadTrips = async () => {
    try {
      setIsLoading(true);
      const data = await getUserTrips(user!.id);
      setTrips(data);
    } catch (error) {
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถโหลดรายการทริปได้");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace("/(auth)/login");
    } catch (error) {
      Alert.alert(
        "ออกจากระบบไม่สำเร็จ",
        error instanceof Error ? error.message : "กรุณาลองใหม่อีกครั้ง",
      );
    }
  };

  const extractInviteToken = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";

    const joinMatch = trimmed.match(/(?:^|\/)join\/([^/?#\s]+)/i);
    if (joinMatch?.[1]) {
      return decodeURIComponent(joinMatch[1]);
    }

    return trimmed.replace(/^["']|["']$/g, "");
  };

  const handleOpenInvite = () => {
    const token = extractInviteToken(inviteLink);

    if (!token) {
      Alert.alert("กรุณากรอกลิงก์เชิญ", "วางลิงก์เชิญหรือรหัสเชิญที่ได้รับจากเพื่อน");
      return;
    }

    router.push(`/join/${token}` as any);
    setInviteLink("");
  };

  return (
    <View className="flex-1 bg-slate-50">
      <View className="flex-row items-center justify-between px-6 py-4">
        <AppText className="text-2xl font-bold text-slate-950">TripSync</AppText>
        <Pressable onPress={handleSignOut}>
          <AppText className="text-sm font-semibold text-slate-600">ออกจากระบบ</AppText>
        </Pressable>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0f766e" />
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
          ListHeaderComponent={
            <View className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <AppText className="mb-2 text-base font-bold text-slate-900">เข้าร่วมทริปจากลิงก์เชิญ</AppText>
              <AppText className="mb-3 text-sm text-slate-500">
                วางลิงก์ที่ได้รับจากเพื่อน หรือใส่รหัสเชิญโดยตรง
              </AppText>
              <TextInput
                className="mb-3 h-12 rounded-lg border border-slate-300 bg-slate-50 px-4 text-base text-slate-900"
                placeholder="tripsync://join/..."
                value={inviteLink}
                onChangeText={setInviteLink}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="go"
                onSubmitEditing={handleOpenInvite}
              />
              <Pressable
                className="h-12 items-center justify-center rounded-lg bg-teal-600"
                onPress={handleOpenInvite}
              >
                <AppText className="font-semibold text-white">เข้าร่วมทริป</AppText>
              </Pressable>
            </View>
          }
          ListEmptyComponent={
            <View className="mt-20 items-center">
              <AppText className="text-center text-lg font-semibold text-slate-700">
                ยังไม่มีทริป
              </AppText>
              <AppText className="mt-2 text-center text-slate-500">
                กดปุ่ม + ด้านล่างเพื่อสร้างทริปแรกของคุณ!
              </AppText>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              onPress={() => router.push(`/trips/${item.id}/dashboard` as any)}
            >
              <AppText className="text-lg font-bold text-slate-900">{item.name}</AppText>
              {item.description && (
                <AppText className="mt-1 text-sm text-slate-500" numberOfLines={2}>
                  {item.description}
                </AppText>
              )}
            </Pressable>
          )}
        />
      )}

      {/* Floating Action Button */}
      <Pressable
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-teal-600 shadow-lg"
        onPress={() => router.push("/trips/create" as any)}
      >
        <AppText className="text-3xl text-white">+</AppText>
      </Pressable>
    </View>
  );
}
