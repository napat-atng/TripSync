import { useEffect, useState } from "react";
import { View, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { AppText } from "../../components/AppText";
import { getTripByInviteToken } from "../../lib/trips";
import { joinTripAsUser, joinTripAsGuest } from "../../lib/members";
import { useAuth } from "../../hooks/useAuth";
import type { Trip } from "../../types/trip";

export default function JoinTripScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const user = useAuth((state) => state.user);
  const isLoadingAuth = useAuth((state) => state.isLoading);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (token && !isLoadingAuth) {
      loadTrip();
    }
  }, [token, isLoadingAuth]);

  const loadTrip = async () => {
    try {
      const fetchedTrip = await getTripByInviteToken(token!);
      setTrip(fetchedTrip);

      // If user is logged in, auto-join
      if (user) {
        await handleJoinAsUser(fetchedTrip);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      Alert.alert("Invalid Link", "This invite link is invalid or has expired.");
      router.replace("/(tabs)/home");
    }
  };

  const handleJoinAsUser = async (targetTrip: Trip) => {
    try {
      const defaultName = user?.email?.split("@")[0] || "Member";
      await joinTripAsUser(targetTrip.id, user!.id, defaultName);
      router.replace(`/trips/${targetTrip.id}/dashboard` as any);
    } catch (error) {
      Alert.alert("Failed to join", "Could not join the trip.");
      setIsLoading(false);
    }
  };

  const handleJoinAsGuest = async () => {
    if (!displayName.trim()) {
      Alert.alert("Required", "Please enter your name to join.");
      return;
    }
    if (!trip) return;

    try {
      setIsJoining(true);
      const member = await joinTripAsGuest(trip.id, displayName.trim());

      // Save guest membership to AsyncStorage
      const existingMembershipsStr = await AsyncStorage.getItem("guest_memberships");
      const memberships = existingMembershipsStr ? JSON.parse(existingMembershipsStr) : {};
      memberships[trip.id] = member.id;
      await AsyncStorage.setItem("guest_memberships", JSON.stringify(memberships));

      router.replace(`/trips/${trip.id}/dashboard` as any);
    } catch (error) {
      Alert.alert("Failed to join", "Could not join the trip as guest.");
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#0f766e" />
        <AppText className="mt-4 text-slate-500">Preparing your invite...</AppText>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center bg-slate-50 px-6">
      <View className="w-full max-w-sm self-center rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <AppText className="mb-2 text-center text-xl font-bold text-slate-900">
          You've been invited!
        </AppText>
        <AppText className="mb-6 text-center text-base text-slate-600">
          Join <AppText className="font-semibold text-slate-900">{trip?.name}</AppText>
        </AppText>

        <AppText className="mb-2 text-sm font-semibold text-slate-700">
          Enter your name to join as a guest:
        </AppText>
        <TextInput
          className="mb-6 h-12 rounded-lg border border-slate-300 bg-white px-4 text-base"
          placeholder="e.g. Alex"
          value={displayName}
          onChangeText={setDisplayName}
          editable={!isJoining}
        />

        <Pressable
          className="h-12 items-center justify-center rounded-lg bg-teal-600"
          onPress={handleJoinAsGuest}
          disabled={isJoining}
        >
          {isJoining ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <AppText className="font-semibold text-white">Join Trip</AppText>
          )}
        </Pressable>

        <AppText className="mt-4 text-center text-xs text-slate-500">
          Already have an account? Go back and login first to sync your trips.
        </AppText>
      </View>
    </View>
  );
}
