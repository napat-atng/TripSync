import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useLocalSearchParams, Stack, router } from "expo-router";

import { AppText } from "../../../components/AppText";
import { InviteSheet } from "../../../components/InviteSheet";
import { useTripStore } from "../../../store/tripStore";
import { Pressable } from "react-native";

export default function TripDashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trips = useTripStore((state) => state.trips);
  const [isInviteSheetVisible, setIsInviteSheetVisible] = useState(false);

  const trip = trips.find((t) => t.id === id);

  useEffect(() => {
    // If the trip doesn't exist in our store, we probably navigated here directly
    // and need to fetch it or go back. For now, go back if not found.
    if (!trip) {
      router.replace("/(tabs)/home");
    }
  }, [trip]);

  if (!trip) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <Stack.Screen options={{ title: trip.name, headerBackTitle: "Home" }} />
      
      <View className="p-6">
        <AppText className="text-2xl font-bold text-slate-900">{trip.name}</AppText>
        {trip.description && (
          <AppText className="mt-2 text-base text-slate-600">{trip.description}</AppText>
        )}

        <View className="mt-10 rounded-xl bg-white p-6 shadow-sm border border-slate-200">
          <AppText className="text-lg font-semibold text-slate-900">Trip Members</AppText>
          <AppText className="mt-1 mb-4 text-sm text-slate-500">
            Invite your friends to start planning together.
          </AppText>
          
          <Pressable
            className="h-12 items-center justify-center rounded-lg bg-teal-50"
            onPress={() => setIsInviteSheetVisible(true)}
          >
            <AppText className="font-semibold text-teal-700">Invite Friends</AppText>
          </Pressable>
        </View>
      </View>

      {isInviteSheetVisible && (
        <>
          <Pressable 
            className="absolute inset-0 bg-black/20" 
            onPress={() => setIsInviteSheetVisible(false)} 
          />
          <InviteSheet 
            inviteToken={trip.invite_token} 
            onClose={() => setIsInviteSheetVisible(false)} 
          />
        </>
      )}
    </View>
  );
}
