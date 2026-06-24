import { useEffect, useState } from "react";
import { Alert, Pressable, View, FlatList, ActivityIndicator, Image } from "react-native";
import { router } from "expo-router";
import { Plus, LogOut, Map, Calendar, Users, Link2 } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";

import { AppText } from "../../components/AppText";
import { useAuth } from "../../hooks/useAuth";
import { useTripStore } from "../../store/tripStore";
import { getUserTrips } from "../../lib/trips";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";

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
    <View className="flex-1 bg-surface-50">
      <View className="flex-row items-center justify-between px-6 py-4 bg-white border-b border-surface-200">
        <View className="flex-row items-center">
          <View className="w-8 h-8 rounded-lg bg-primary-100 items-center justify-center mr-3">
            <Map size={18} color="#4f46e5" strokeWidth={2.5} />
          </View>
          <AppText className="text-xl font-bold text-surface-950">TripSync</AppText>
        </View>
        <Button variant="ghost" size="sm" onPress={handleSignOut} className="px-2">
          <LogOut size={20} color="#64748b" />
        </Button>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#D85A30" />
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          ListHeaderComponent={
            <Card className="mb-6 border-primary-100 bg-primary-50/50">
              <CardContent className="pt-6">
                <AppText className="mb-2 text-base font-bold text-primary-950">
                  เข้าร่วมทริปด้วยลิงก์เชิญ
                </AppText>
                <AppText className="mb-4 text-sm text-primary-700/80">
                  มีลิงก์จากเพื่อนแล้วใช่ไหม? วางลิงก์เพื่อเข้าร่วมทริปได้เลย
                </AppText>
                <View className="flex-row items-center">
                  <View className="flex-1">
                    <Input
                      placeholder="tripsync://join/..."
                      value={inviteLink}
                      onChangeText={setInviteLink}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      returnKeyType="go"
                      onSubmitEditing={handleOpenInvite}
                      className="mb-0"
                      icon={<Link2 size={20} color="#94a3b8" />}
                    />
                  </View>
                  <Button 
                    className="ml-3 h-14 px-5 bg-primary-600" 
                    onPress={handleOpenInvite}
                  >
                    เข้าร่วม
                  </Button>
                </View>
              </CardContent>
            </Card>
          }
          ListEmptyComponent={
            <View className="mt-12 items-center px-4">
              <View className="w-24 h-24 rounded-full bg-surface-100 items-center justify-center mb-6">
                <Map size={40} color="#94a3b8" strokeWidth={1.5} />
              </View>
              <AppText className="text-center text-xl font-bold text-surface-900">
                ยังไม่มีทริป
              </AppText>
              <AppText className="mt-2 text-center text-surface-500 max-w-[250px]">
                เริ่มต้นการเดินทางของคุณโดยการสร้างทริปใหม่ หรือเข้าร่วมทริปจากเพื่อน
              </AppText>
              <Button 
                className="mt-8 px-8"
                onPress={() => router.push("/trips/create" as any)}
              >
                สร้างทริปแรกของคุณ
              </Button>
            </View>
          }
          renderItem={({ item, index }) => {
            const gradients = [
              ['#D85A30', '#E87455'],
              ['#993C1D', '#D85A30'],
              ['#4A1B0C', '#993C1D'],
              ['#E06640', '#F0997B'],
            ];
            const colors = gradients[index % gradients.length];
            
            return (
              <Pressable
                className="mb-4"
                onPress={() => router.push(`/trips/${item.id}/dashboard` as any)}
              >
                <View className="overflow-hidden rounded-2xl bg-white border border-surface-200 shadow-sm">
                  <View className="h-24">
                    <LinearGradient
                      colors={colors as [string, string]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ flex: 1, opacity: 0.8 }}
                    />
                    <View className="absolute inset-0 bg-black/10" />
                    <View className="absolute inset-0 p-4 justify-end">
                      <AppText className="text-xl font-bold text-white shadow-sm">{item.name}</AppText>
                    </View>
                  </View>
                  
                  <View className="p-4">
                    {item.description ? (
                      <AppText className="text-sm text-surface-600 mb-4" numberOfLines={2}>
                        {item.description}
                      </AppText>
                    ) : (
                      <AppText className="text-sm text-surface-400 italic mb-4">
                        ไม่มีคำอธิบายทริป
                      </AppText>
                    )}
                    
                    <View className="flex-row items-center justify-between border-t border-surface-100 pt-3 mt-1">
                      <View className="flex-row items-center">
                        <Users size={16} color="#64748b" />
                        <AppText className="ml-1.5 text-xs font-medium text-surface-500">
                          ดูรายละเอียดทริป
                        </AppText>
                      </View>
                      <View className="w-8 h-8 rounded-full bg-surface-100 items-center justify-center">
                        <AppText className="text-surface-600 font-bold">→</AppText>
                      </View>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {/* Floating Action Button */}
      <Pressable
        className="absolute bottom-6 right-6 h-16 w-16 items-center justify-center rounded-full bg-primary-600 shadow-xl shadow-primary-600/30"
        onPress={() => router.push("/trips/create" as any)}
      >
        <Plus size={32} color="#ffffff" />
      </Pressable>
    </View>
  );
}
