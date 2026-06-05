import { useState } from "react";
import { View, Pressable, Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";

import { AppText } from "./AppText";

type InviteSheetProps = {
  inviteToken: string;
  onClose: () => void;
};

export function InviteSheet({ inviteToken, onClose }: InviteSheetProps) {
  const [isCopied, setIsCopied] = useState(false);
  const inviteUrl = `tripsync://join/${inviteToken}`;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(inviteUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(inviteUrl, {
          dialogTitle: "Join my trip on TripSync!",
        });
      } else {
        Alert.alert("Sharing not available", "Your device does not support sharing.");
      }
    } catch (error) {
      // Ignore abort errors
    }
  };

  return (
    <View className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white p-6 shadow-2xl">
      <View className="mb-6 items-center">
        <View className="mb-4 h-1.5 w-12 rounded-full bg-slate-200" />
        <AppText className="text-xl font-bold text-slate-900">Invite Friends</AppText>
        <AppText className="mt-2 text-center text-sm text-slate-500">
          Share this link with your friends to let them join the trip.
        </AppText>
      </View>

      <View className="mb-6 rounded-lg bg-slate-100 p-4">
        <AppText className="text-center text-sm font-medium text-slate-700" numberOfLines={1}>
          {inviteUrl}
        </AppText>
      </View>

      <Pressable
        className="mb-3 h-14 flex-row items-center justify-center rounded-lg bg-teal-600"
        onPress={handleShare}
      >
        <AppText className="text-base font-semibold text-white">Share Link</AppText>
      </Pressable>

      <Pressable
        className={`mb-4 h-14 flex-row items-center justify-center rounded-lg border ${
          isCopied ? "border-emerald-500 bg-emerald-50" : "border-slate-300 bg-white"
        }`}
        onPress={handleCopy}
      >
        <AppText className={`text-base font-semibold ${isCopied ? "text-emerald-600" : "text-slate-700"}`}>
          {isCopied ? "Copied!" : "Copy Link"}
        </AppText>
      </Pressable>

      <Pressable className="items-center py-2" onPress={onClose}>
        <AppText className="font-semibold text-slate-500">Close</AppText>
      </Pressable>
    </View>
  );
}
