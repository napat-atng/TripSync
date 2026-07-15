import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useLocalSearchParams, Stack, useFocusEffect } from "expo-router";
import { Send, MessageCircle } from "lucide-react-native";

import { AppText } from "../../../../components/AppText";
import { useAuth } from "../../../../hooks/useAuth";
import { getMyMemberId } from "../../../../lib/members";
import { getCommentsByTrip, addComment, subscribeToComments } from "../../../../lib/comments";
import { useCommentStore } from "../../../../store/commentStore";
import type { TripComment } from "../../../../types/comment";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

export default function DiscussionScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const user = useAuth((s) => s.user);

  const comments = useCommentStore((s) => s.comments);
  const setComments = useCommentStore((s) => s.setComments);
  const appendComment = useCommentStore((s) => s.appendComment);

  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);

  const listRef = useRef<FlatList<TripComment>>(null);

  const load = useCallback(async () => {
    if (!tripId) return;
    try {
      const [mid, data] = await Promise.all([
        getMyMemberId(tripId, user?.id),
        getCommentsByTrip(tripId, null),
      ]);
      setMyMemberId(mid ?? null);
      setComments(data);
    } catch {
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถโหลดข้อความได้");
    } finally {
      setIsLoading(false);
    }
  }, [tripId, user?.id, setComments]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Realtime: general trip thread only (itinerary_event_id = null scope)
  useEffect(() => {
    if (!tripId) return;
    const unsubscribe = subscribeToComments(tripId, load, null);
    return unsubscribe;
  }, [tripId, load]);

  useEffect(() => {
    if (comments.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [comments.length]);

  const handleSend = async () => {
    const message = draft.trim();
    if (!message || !myMemberId || !tripId) return;

    setDraft("");
    setIsSending(true);
    try {
      const created = await addComment(tripId, myMemberId, message, null);
      appendComment(created);
    } catch {
      Alert.alert("ข้อผิดพลาด", "ส่งข้อความไม่สำเร็จ");
      setDraft(message);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-50">
        <ActivityIndicator size="large" color="#D85A30" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface-50"
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <Stack.Screen options={{ title: "พูดคุยทริป" }} />

      <FlatList
        ref={listRef}
        data={comments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 24, flexGrow: 1 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center">
            <MessageCircle size={32} color="#cbd5e1" />
            <AppText className="mt-3 text-center text-base font-semibold text-surface-700">
              ยังไม่มีข้อความ
            </AppText>
            <AppText className="mt-1 text-center text-sm text-surface-500">
              ชวนเพื่อนในทริปมาคุยกันเรื่องแผนการเดินทางได้เลย
            </AppText>
          </View>
        }
        renderItem={({ item, index }) => {
          const isMine = item.member_id === myMemberId;
          const prev = comments[index - 1];
          const showName = !isMine && (!prev || prev.member_id !== item.member_id);

          return (
            <View className={`mb-2 max-w-[80%] ${isMine ? "self-end items-end" : "self-start items-start"}`}>
              {showName && (
                <AppText className="mb-1 ml-1 text-xs font-semibold text-surface-500">
                  {item.display_name ?? "สมาชิก"}
                </AppText>
              )}
              <View
                className={`rounded-2xl px-4 py-2.5 ${
                  isMine ? "rounded-tr-sm bg-primary-600" : "rounded-tl-sm border border-surface-200 bg-white"
                }`}
              >
                <AppText className={`text-base ${isMine ? "text-white" : "text-surface-900"}`}>
                  {item.message}
                </AppText>
              </View>
              <AppText className="mt-1 text-[10px] text-surface-400">{formatTime(item.created_at)}</AppText>
            </View>
          );
        }}
      />

      <View className="flex-row items-center gap-2 border-t border-surface-200 bg-white px-4 py-3">
        <TextInput
          className="h-12 flex-1 rounded-xl border border-surface-200 bg-surface-50 px-4 text-base text-surface-900"
          placeholder="พิมพ์ข้อความ..."
          placeholderTextColor="#94a3b8"
          value={draft}
          onChangeText={setDraft}
          multiline
          style={{ fontFamily: "Sarabun_400Regular" }}
        />
        <Pressable
          className={`h-12 w-12 items-center justify-center rounded-xl ${
            draft.trim() ? "bg-primary-600" : "bg-surface-200"
          }`}
          onPress={handleSend}
          disabled={!draft.trim() || isSending}
        >
          {isSending ? <ActivityIndicator size="small" color="#fff" /> : <Send size={20} color="#fff" />}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
