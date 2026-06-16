import React, { useEffect, useState, useCallback } from "react";
import { View, Pressable, TextInput, ActivityIndicator, Alert, Modal } from "react-native";

import { AppText } from "./AppText";
import {
  getVotesByTrip,
  createVote,
  castVote,
  subscribeToVoteResponses,
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
      Alert.alert("Error", "Could not create vote.");
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
      Alert.alert("Error", "Could not submit your vote.");
    } finally {
      setVotingId(null);
    }
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
          No votes yet. {isLeader ? "Create one to get quick feedback from the group." : ""}
        </AppText>
      )}

      {votes.map((vote) => {
        const total = vote.yes_count + vote.no_count;
        const yesPct = total > 0 ? Math.round((vote.yes_count / total) * 100) : 0;
        const isVoting = votingId === vote.id;

        return (
          <View key={vote.id} className="mb-3 rounded-xl border border-slate-200 bg-white p-4">
            <AppText className="mb-2 text-sm font-semibold text-slate-900">{vote.title}</AppText>

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
              <AppText className="text-xs text-slate-400">{total} vote{total !== 1 ? "s" : ""}</AppText>
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
                      Yes
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
                      No
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
          <AppText className="font-semibold text-teal-700">+ Create Yes/No Vote</AppText>
        </Pressable>
      )}

      <Modal visible={createModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/30">
          <View className="rounded-t-2xl bg-white p-6 pb-12">
            <View className="mb-4 flex-row items-center justify-between">
              <AppText className="text-lg font-bold text-slate-900">New Vote</AppText>
              <Pressable onPress={() => setCreateModalVisible(false)}>
                <AppText className="text-slate-500">Close</AppText>
              </Pressable>
            </View>
            <AppText className="mb-1 text-sm font-medium text-slate-600">
              Proposed date or destination
            </AppText>
            <TextInput
              className="mb-4 h-12 rounded-lg border border-slate-200 bg-white px-4 text-base text-slate-900"
              placeholder="e.g. Chiang Mai, Dec 12-15?"
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
                <AppText className="font-semibold text-white">Create Vote</AppText>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
