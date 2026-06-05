import { useEffect } from "react";
import { Alert, Pressable, View, FlatList, ActivityIndicator } from "react-native";
import { router } from "expo-router";

import { AppText } from "../../components/AppText";
import { useAuth } from "../../hooks/useAuth";
import { useTripStore } from "../../store/tripStore";
import { getUserTrips } from "../../lib/trips";

export default function HomeScreen() {
  const { trips, setTrips, isLoading, setIsLoading } = useTripStore();
  const user = useAuth((state) => state.user);
  const signOut = useAuth((state) => state.signOut);

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
      Alert.alert("Error", "Failed to load trips.");
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
        "Sign out failed",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  return (
    <View className="flex-1 bg-slate-50">
      <View className="flex-row items-center justify-between px-6 py-4">
        <AppText className="text-2xl font-bold text-slate-950">TripSync</AppText>
        <Pressable onPress={handleSignOut}>
          <AppText className="text-sm font-semibold text-slate-600">Sign out</AppText>
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
          ListEmptyComponent={
            <View className="mt-20 items-center">
              <AppText className="text-center text-lg font-semibold text-slate-700">
                No trips yet
              </AppText>
              <AppText className="mt-2 text-center text-slate-500">
                Tap the button below to create your first trip!
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
