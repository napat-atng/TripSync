import React, { useEffect, useState, useCallback } from "react";
import { View, Pressable, TextInput, ActivityIndicator, Alert, Modal } from "react-native";

import { AppText } from "./AppText";
import {
  getVotesByTrip,
  createVote,
  castVote,
  subscribeToVoteResponses,
  updateVote,
  deleteVote,
} from "../lib/votes";
import type { VoteWithResults } from "../types/vote";

interface VoteSectionProps {
  tripId: string;
  myMemberId: string | null;
  isLeader: boolean;
}

export function VoteSection({ tripId, myMemberId, isLeader }: VoteSectionProps) {
  const [votes, setVotes] = useState<VoteWithResults[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);
  
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editingVoteId, setEditingVoteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getVotesByTrip(tripId, myMemberId);
      setVotes(data);
    } catch {
      // silent fail on background refresh; surfaced only on initial load
    } finally {
      setIsLoading(false);
    }
  }, [tripId, myMemberId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime subscription: refresh whenever someone casts a vote
  useEffect(() => {
    const unsubscribe = subscribeToVoteResponses(tripId, load);
    return unsubscribe;
  }, [tripId, load]);

  const handleCreateVote = async () => {
    if (!myMemberId || !newTitle.trim()) return;
    setIsSaving(true);
    try {
      await createVote(tripId, myMemberId, newTitle.trim());
      setNewTitle("");
      setCreateModalVisible(false);
      await load();
    } catch {
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถสร้างโหวตได้");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCastVote = async (voteId: string, answer: boolean) => {
    if (!myMemberId) return;
    setVotingId(voteId);
    try {
      await castVote(voteId, myMemberId, answer);
      await load();
    } catch {
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถโหวตได้");
    } finally {
      setVotingId(null);
    }
  };

  const handleOpenEdit = (vote: VoteWithResults) => {
    setEditingVoteId(vote.id);
    setEditTitle(vote.title);
    setEditModalVisible(true);
  };

  const handleUpdateVote = async () => {
    if (!editingVoteId || !editTitle.trim()) return;
    setIsSaving(true);
    try {
      await updateVote(editingVoteId, editTitle.trim());
      setEditModalVisible(false);
      setEditingVoteId(null);
      await load();
    } catch {
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถแก้ไขโหวตได้");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVote = (vote: VoteWithResults) => {
    Alert.alert("ลบโหวต", `คุณต้องการลบ "${vote.title}" ใช่ไหม?`, [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ลบ",
        style: "destructive",
        onPress: async () => {
          setIsSaving(true);
          try {
            await deleteVote(vote.id);
            await load();
          } catch {
            Alert.alert("ข้อผิดพลาด", "ไม่สามารถลบโหวตได้");
          } finally {
            setIsSaving(false);
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View className="items-center py-6">
        <ActivityIndicator size="small" color="#0f766e" />
      </View>
    );
  }

  return (
    <View>
      {votes.length === 0 && (
        <AppText className="mb-3 text-sm text-slate-500">
          ยังไม่มีโหวต {isLeader ? "สร้างโหวตเพื่อรับความเห็นจากกลุ่ม" : ""}
        </AppText>
      )}

      {votes.map((vote) => {
        const total = vote.yes_count + vote.no_count;
        const yesPct = total > 0 ? Math.round((vote.yes_count / total) * 100) : 0;
        const isVoting = votingId === vote.id;

        return (
          <View key={vote.id} className="mb-3 rounded-xl border border-slate-200 bg-white p-4">
            <View className="mb-2 flex-row items-start justify-between">
              <AppText className="text-sm font-semibold text-slate-900 flex-1 mr-2">{vote.title}</AppText>
              {isLeader && (
                <View className="flex-row gap-3">
                  <Pressable onPress={() => handleOpenEdit(vote)}>
                    <AppText className="text-sm">✏️</AppText>
                  </Pressable>
                  <Pressable onPress={() => handleDeleteVote(vote)}>
                    <AppText className="text-sm">🗑️</AppText>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Result bar */}
            <View className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <View
                className="h-2 rounded-full bg-green-500"
                style={{ width: `${yesPct}%` }}
              />
            </View>
            <View className="mb-3 flex-row items-center justify-between">
              <AppText className="text-xs text-slate-500">
                👍 {vote.yes_count}  ·  👎 {vote.no_count}
              </AppText>
              <AppText className="text-xs text-slate-400">{total} โหวต</AppText>
            </View>

            {myMemberId && (
              <View className="flex-row gap-2">
                <Pressable
                  className={`flex-1 h-9 items-center justify-center rounded-lg border ${
                    vote.my_answer === true
                      ? "border-green-600 bg-green-600"
                      : "border-slate-200 bg-slate-50"
                  }`}
                  onPress={() => handleCastVote(vote.id, true)}
                  disabled={isVoting}
                >
                  {isVoting ? (
                    <ActivityIndicator size="small" color={vote.my_answer === true ? "#fff" : "#0f766e"} />
                  ) : (
                    <AppText
                      className={`text-sm font-medium ${
                        vote.my_answer === true ? "text-white" : "text-slate-700"
                      }`}
                    >
                    ใช่
                    </AppText>
                  )}
                </Pressable>
                <Pressable
                  className={`flex-1 h-9 items-center justify-center rounded-lg border ${
                    vote.my_answer === false
                      ? "border-red-500 bg-red-500"
                      : "border-slate-200 bg-slate-50"
                  }`}
                  onPress={() => handleCastVote(vote.id, false)}
                  disabled={isVoting}
                >
                  {isVoting ? (
                    <ActivityIndicator size="small" color={vote.my_answer === false ? "#fff" : "#0f766e"} />
                  ) : (
                    <AppText
                      className={`text-sm font-medium ${
                        vote.my_answer === false ? "text-white" : "text-slate-700"
                      }`}
                    >
                    ไม่
                    </AppText>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        );
      })}

      {isLeader && (
        <Pressable
          className="h-11 items-center justify-center rounded-lg border border-teal-600 bg-teal-50"
          onPress={() => setCreateModalVisible(true)}
        >
          <AppText className="font-semibold text-teal-700">+ สร้างโหวตใช่/ไม่</AppText>
        </Pressable>
      )}

      <Modal visible={createModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/30">
          <View className="rounded-t-2xl bg-white p-6 pb-12">
            <View className="mb-4 flex-row items-center justify-between">
              <AppText className="text-lg font-bold text-slate-900">สร้างโหวตใหม่</AppText>
              <Pressable onPress={() => setCreateModalVisible(false)}>
                <AppText className="text-slate-500">ปิด</AppText>
              </Pressable>
            </View>
            <AppText className="mb-1 text-sm font-medium text-slate-600">
              สถานที่หรือวันเดินทางที่เสนอ
            </AppText>
            <TextInput
              className="mb-4 h-12 rounded-lg border border-slate-200 bg-white px-4 text-base text-slate-900"
              placeholder="เช่น เชียงใหม่ 12-15 ธันวาคม?"
              value={newTitle}
              onChangeText={setNewTitle}
            />
            <Pressable
              className="h-12 items-center justify-center rounded-lg bg-teal-600"
              onPress={handleCreateVote}
              disabled={isSaving || !newTitle.trim()}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <AppText className="font-semibold text-white">สร้างโหวต</AppText>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={editModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/30">
          <View className="rounded-t-2xl bg-white p-6 pb-12">
            <View className="mb-4 flex-row items-center justify-between">
              <AppText className="text-lg font-bold text-slate-900">แก้ไขโหวต</AppText>
              <Pressable onPress={() => setEditModalVisible(false)}>
                <AppText className="text-slate-500">ปิด</AppText>
              </Pressable>
            </View>
            <TextInput
              className="mb-4 h-12 rounded-lg border border-slate-200 bg-white px-4 text-base text-slate-900"
              value={editTitle}
              onChangeText={setEditTitle}
            />
            <Pressable
              className="h-12 items-center justify-center rounded-lg bg-teal-600"
              onPress={handleUpdateVote}
              disabled={isSaving || !editTitle.trim()}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <AppText className="font-semibold text-white">บันทึก</AppText>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
