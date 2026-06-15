import { useEffect, useState } from "react";
import { View, ActivityIndicator, ScrollView } from "react-native";
import { useLocalSearchParams, Stack, router } from "expo-router";
import { Pressable } from "react-native";

import { AppText } from "../../../components/AppText";
import { InviteSheet } from "../../../components/InviteSheet";
import { AvailabilityHeatmap } from "../../../components/AvailabilityHeatmap";
import { useTripStore } from "../../../store/tripStore";
import { useAuth } from "../../../hooks/useAuth";

export default function TripDashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trips = useTripStore((state) => state.trips);
  const user = useAuth((s) => s.user);
  const [isInviteSheetVisible, setIsInviteSheetVisible] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);

  const trip = trips.find((t) => t.id === id);

  const isLeader = trip?.trip_members?.some(
    (m) => m.user_id === user?.id && m.role === "leader",
  );

  useEffect(() => {
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

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <AppText className="text-2xl font-bold text-slate-900">{trip.name}</AppText>
        {trip.description && (
          <AppText className="mt-1 text-base text-slate-500">{trip.description}</AppText>
        )}

        {/* Survey card */}
        <View className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <AppText className="text-base font-semibold text-slate-900">Trip Survey</AppText>
          <AppText className="mt-1 mb-4 text-sm text-slate-500">
            Gather preferences from your trip members.
          </AppText>
          <View className="flex-row gap-3">
            <Pressable
              className="flex-1 h-11 items-center justify-center rounded-lg bg-teal-600"
              onPress={() => router.push(`/trips/${trip.id}/survey/respond` as any)}
            >
              <AppText className="font-semibold text-white">Take Survey</AppText>
            </Pressable>
            {isLeader && (
              <Pressable
                className="flex-1 h-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50"
                onPress={() => router.push(`/trips/${trip.id}/survey/builder` as any)}
              >
                <AppText className="font-semibold text-slate-700">Edit Survey</AppText>
              </Pressable>
            )}
          </View>
        </View>

        {/* Availability card */}
        <View className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
          <AppText className="text-base font-semibold text-slate-900">Availability</AppText>
          <AppText className="mt-1 mb-4 text-sm text-slate-500">
            Mark the dates you're free so the group can find the best time.
          </AppText>

          <Pressable
            className="h-11 items-center justify-center rounded-lg bg-green-600"
            onPress={() => router.push(`/trips/${trip.id}/availability` as any)}
          >
            <AppText className="font-semibold text-white">Mark My Availability</AppText>
          </Pressable>

          {isLeader && (
            <Pressable
              className="mt-3 h-11 items-center justify-center rounded-lg border border-green-200 bg-green-50"
              onPress={() => setShowHeatmap((v) => !v)}
            >
              <AppText className="font-semibold text-green-700">
                {showHeatmap ? "Hide" : "View"} Group Availability
              </AppText>
            </Pressable>
          )}

          {showHeatmap && isLeader && (
            <View className="mt-4">
              <AvailabilityHeatmap tripId={trip.id} />
            </View>
          )}
        </View>

        {/* Members card */}
        <View className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
          <AppText className="text-base font-semibold text-slate-900">Trip Members</AppText>
          <AppText className="mt-1 mb-4 text-sm text-slate-500">
            Invite your friends to start planning together.
          </AppText>
          <Pressable
            className="h-11 items-center justify-center rounded-lg bg-teal-50"
            onPress={() => setIsInviteSheetVisible(true)}
          >
            <AppText className="font-semibold text-teal-700">Invite Friends</AppText>
          </Pressable>
        </View>
      </ScrollView>

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
