import { Pressable, View } from "react-native";

import { AppText } from "../../components/AppText";
import { useAuth } from "../../hooks/useAuth";
import { useTripStore } from "../../store/useTripStore";

export default function HomeScreen() {
  const upcomingTrips = useTripStore((state) => state.upcomingTrips);
  const user = useAuth((state) => state.user);
  const signOut = useAuth((state) => state.signOut);

  return (
    <View className="flex-1 items-center justify-center bg-slate-50 px-6">
      <View className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <AppText className="text-center text-3xl font-bold text-slate-950">
          TripSync
        </AppText>
        <AppText className="mt-3 text-center text-base text-slate-600">
          Plan group travel, keep everyone aligned, and start your next itinerary.
        </AppText>
        <AppText className="mt-4 text-center text-sm text-slate-500">
          {user?.email ?? "Signed in"}
        </AppText>
        <AppText className="mt-6 text-center text-sm font-semibold text-teal-700">
          {upcomingTrips.length} upcoming trips
        </AppText>
        <Pressable
          accessibilityRole="button"
          className="mt-6 h-12 items-center justify-center rounded-lg border border-slate-300"
          onPress={() => {
            void signOut();
          }}
        >
          <AppText className="text-sm font-semibold text-slate-700">Sign out</AppText>
        </Pressable>
      </View>
    </View>
  );
}
