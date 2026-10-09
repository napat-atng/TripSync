import { useCallback, useEffect, useState } from "react";
import { View, FlatList, TextInput, Pressable, ActivityIndicator, Alert, Modal } from "react-native";
import { useLocalSearchParams, Stack, useFocusEffect } from "expo-router";
import { Check, ListChecks, Plus, Trash2, X, UserCircle2 } from "lucide-react-native";

import { AppText } from "../../../../components/AppText";
import { Button } from "../../../../components/ui/Button";
import { useAuth } from "../../../../hooks/useAuth";
import { getMyMemberId, getMembersByTrip } from "../../../../lib/members";
import { getTasksByTrip, addTask, assignTask, deleteTask, subscribeToTasks } from "../../../../lib/tasks";
import { useTaskStore, selectTaskProgress } from "../../../../store/taskStore";
import type { TripTask } from "../../../../types/task";
import type { TripMember } from "../../../../types/trip";

export default function TodoScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const user = useAuth((s) => s.user);

  const tasks = useTaskStore((s) => s.tasks);
  const setTasks = useTaskStore((s) => s.setTasks);
  const addTaskLocal = useTaskStore((s) => s.addTask);
  const removeTaskLocal = useTaskStore((s) => s.removeTask);
  const updateTaskLocal = useTaskStore((s) => s.updateTaskLocal);
  const toggleTaskOptimistic = useTaskStore((s) => s.toggleTaskOptimistic);

  const [members, setMembers] = useState<TripMember[]>([]);
  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAssignee, setNewAssignee] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [detailTask, setDetailTask] = useState<TripTask | null>(null);

  const progress = selectTaskProgress(tasks);

  const load = useCallback(async () => {
    if (!tripId) return;
    try {
      const [mid, taskData, memberData] = await Promise.all([
        getMyMemberId(tripId, user?.id),
        getTasksByTrip(tripId),
        getMembersByTrip(tripId),
      ]);

      // Fallback: if getMyMemberId returns undefined, find our member from the full list
      const resolvedMid =
        mid ??
        memberData.find((m) => m.user_id === user?.id)?.id ??
        null;

      console.log("[TodoScreen] load => myMemberId:", resolvedMid, "userId:", user?.id);
      setMyMemberId(resolvedMid);
      setTasks(taskData);
      setMembers(memberData);
    } catch (err) {
      console.error("[TodoScreen] load error:", err);
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถโหลดรายการได้");
    } finally {
      setIsLoading(false);
    }
  }, [tripId, user?.id, setTasks]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (!tripId) return;
    const unsubscribe = subscribeToTasks(tripId, load);
    return unsubscribe;
  }, [tripId, load]);

  const handleToggle = async (task: TripTask) => {
    try {
      await toggleTaskOptimistic(task.id, !task.is_completed);
    } catch {
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถอัปเดตสถานะได้");
    }
  };

  const handleAddTask = async () => {
    console.log("[handleAddTask] called. title:", newTitle, "myMemberId:", myMemberId, "tripId:", tripId);
    if (!newTitle.trim()) return;
    if (!tripId || !myMemberId) {
      Alert.alert("ข้อผิดพลาด", "ไม่พบข้อมูลสมาชิกของคุณในทริปนี้ (myMemberId = null) ลองแรหน้าจอแล้วเปิดใหม่อีกครั้ง");
      return;
    }
    setIsSaving(true);
    try {
      const created = await addTask(tripId, myMemberId, newTitle.trim(), newAssignee);
      addTaskLocal(created);
      setNewTitle("");
      setNewAssignee(null);
      setAddModalVisible(false);
    } catch (err: any) {
      console.error("[handleAddTask] error:", err);
      const msg = err?.message ?? err?.error_description ?? "ไม่สามารถเพิ่มรายการได้";
      Alert.alert("ข้อผิดพลาด", msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssign = async (memberId: string | null) => {
    if (!detailTask) return;
    const previous = detailTask.assigned_to;
    const assignedName = members.find((m) => m.id === memberId)?.display_name ?? null;
    updateTaskLocal(detailTask.id, { assigned_to: memberId, assigned_to_name: assignedName });
    setDetailTask((t) => (t ? { ...t, assigned_to: memberId, assigned_to_name: assignedName } : t));
    try {
      await assignTask(detailTask.id, memberId);
    } catch {
      updateTaskLocal(detailTask.id, { assigned_to: previous });
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถมอบหมายงานได้");
    }
  };

  const handleDeleteTask = () => {
    if (!detailTask) return;
    Alert.alert("ลบรายการ", `ต้องการลบ "${detailTask.title}" ใช่ไหม?`, [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ลบ",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTask(detailTask.id);
            removeTaskLocal(detailTask.id);
            setDetailTask(null);
          } catch {
            Alert.alert("ข้อผิดพลาด", "ไม่สามารถลบรายการได้");
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-50">
        <ActivityIndicator size="large" color="#D85A30" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-50">
      <Stack.Screen options={{ title: "เช็คลิสต์ทริป" }} />

      {/* Progress header */}
      <View className="border-b border-surface-200 bg-white px-5 pb-5 pt-4">
        <View className="mb-2 flex-row items-center justify-between">
          <AppText className="text-sm font-semibold text-surface-700">
            ทำแล้ว {progress.completed}/{progress.total}
          </AppText>
          <AppText className="text-sm font-bold text-primary-600">{progress.pct}%</AppText>
        </View>
        <View className="h-3 w-full overflow-hidden rounded-full border border-surface-200 bg-surface-100">
          <View className="h-full rounded-full bg-primary-500" style={{ width: `${progress.pct}%` }} />
        </View>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        ListEmptyComponent={
          <View className="mt-16 items-center">
            <ListChecks size={32} color="#cbd5e1" />
            <AppText className="mt-3 text-center text-base font-semibold text-surface-700">
              ยังไม่มีรายการ
            </AppText>
            <AppText className="mt-1 text-center text-sm text-surface-500">
              เพิ่มของที่ต้องเตรียม หรืองานที่ต้องมอบหมายกันในทริป
            </AppText>
            <Pressable
              onPress={() => setAddModalVisible(true)}
              className="mt-5 rounded-xl bg-primary-600 px-6 py-3"
            >
              <AppText className="font-semibold text-white">เพิ่มรายการแรก</AppText>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setDetailTask(item)}
            className="mb-3 flex-row items-center rounded-xl border border-surface-200 bg-white p-4"
          >
            <Pressable
              onPress={() => handleToggle(item)}
              hitSlop={8}
              className={`mr-3 h-6 w-6 items-center justify-center rounded-full border-2 ${
                item.is_completed ? "border-primary-600 bg-primary-600" : "border-surface-300 bg-white"
              }`}
            >
              {item.is_completed && <Check size={14} color="#fff" />}
            </Pressable>
            <View className="flex-1">
              <AppText
                className={`text-base font-medium ${
                  item.is_completed ? "text-surface-400 line-through" : "text-surface-900"
                }`}
              >
                {item.title}
              </AppText>
              <View className="mt-1 flex-row items-center gap-1">
                <UserCircle2 size={13} color="#94a3b8" />
                <AppText className="text-xs text-surface-500">
                  {item.assigned_to_name ?? "ยังไม่มอบหมาย"}
                </AppText>
              </View>
            </View>
          </Pressable>
        )}
      />

      {/* FAB */}
      <Pressable
        className="absolute bottom-8 right-6 h-14 w-14 items-center justify-center rounded-full bg-primary-600 shadow-lg"
        onPress={() => setAddModalVisible(true)}
        style={{ elevation: 8, zIndex: 50 }}
      >
        <Plus size={26} color="#fff" />
      </Pressable>

      {/* Add task modal */}
      <Modal visible={addModalVisible} transparent animationType="slide" onRequestClose={() => setAddModalVisible(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-2xl bg-white p-6 pb-10">
            <View className="mb-4 flex-row items-center justify-between">
              <AppText className="text-lg font-bold text-surface-950">เพิ่มรายการ</AppText>
              <Pressable onPress={() => setAddModalVisible(false)}>
                <X size={22} color="#64748b" />
              </Pressable>
            </View>

            <TextInput
              className="mb-4 h-14 rounded-xl border border-surface-200 bg-surface-50 px-4 text-base text-surface-900"
              placeholder="เช่น จองรถตู้, เตรียมลำโพง"
              placeholderTextColor="#94a3b8"
              value={newTitle}
              onChangeText={setNewTitle}
              style={{ fontFamily: "Sarabun_400Regular" }}
            />

            <AppText className="mb-2 text-sm font-medium text-surface-700">มอบหมายให้ (ไม่บังคับ)</AppText>
            <View className="mb-5 flex-row flex-wrap gap-2">
              <Pressable
                onPress={() => setNewAssignee(null)}
                className={`rounded-full border px-4 py-2 ${
                  newAssignee === null ? "border-primary-600 bg-primary-50" : "border-surface-200 bg-white"
                }`}
              >
                <AppText
                  className={`text-sm font-medium ${newAssignee === null ? "text-primary-700" : "text-surface-600"}`}
                >
                  ยังไม่มอบหมาย
                </AppText>
              </Pressable>
              {members.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => setNewAssignee(m.id)}
                  className={`rounded-full border px-4 py-2 ${
                    newAssignee === m.id ? "border-primary-600 bg-primary-50" : "border-surface-200 bg-white"
                  }`}
                >
                  <AppText
                    className={`text-sm font-medium ${
                      newAssignee === m.id ? "text-primary-700" : "text-surface-600"
                    }`}
                  >
                    {m.display_name ?? "ไม่ระบุชื่อ"}
                  </AppText>
                </Pressable>
              ))}
            </View>

            <Button loading={isSaving} disabled={!newTitle.trim()} onPress={handleAddTask}>
              เพิ่มรายการ
            </Button>
          </View>
        </View>
      </Modal>

      {/* Task detail / assign / delete modal */}
      <Modal
        visible={!!detailTask}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailTask(null)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-2xl bg-white p-6 pb-10">
            {detailTask && (
              <>
                <View className="mb-4 flex-row items-center justify-between">
                  <AppText className="flex-1 pr-2 text-lg font-bold text-surface-950">
                    {detailTask.title}
                  </AppText>
                  <Pressable onPress={() => setDetailTask(null)}>
                    <X size={22} color="#64748b" />
                  </Pressable>
                </View>

                <AppText className="mb-2 text-sm font-medium text-surface-700">มอบหมายให้</AppText>
                <View className="mb-6 flex-row flex-wrap gap-2">
                  <Pressable
                    onPress={() => handleAssign(null)}
                    className={`rounded-full border px-4 py-2 ${
                      detailTask.assigned_to === null
                        ? "border-primary-600 bg-primary-50"
                        : "border-surface-200 bg-white"
                    }`}
                  >
                    <AppText
                      className={`text-sm font-medium ${
                        detailTask.assigned_to === null ? "text-primary-700" : "text-surface-600"
                      }`}
                    >
                      ยังไม่มอบหมาย
                    </AppText>
                  </Pressable>
                  {members.map((m) => (
                    <Pressable
                      key={m.id}
                      onPress={() => handleAssign(m.id)}
                      className={`rounded-full border px-4 py-2 ${
                        detailTask.assigned_to === m.id
                          ? "border-primary-600 bg-primary-50"
                          : "border-surface-200 bg-white"
                      }`}
                    >
                      <AppText
                        className={`text-sm font-medium ${
                          detailTask.assigned_to === m.id ? "text-primary-700" : "text-surface-600"
                        }`}
                      >
                        {m.display_name ?? "ไม่ระบุชื่อ"}
                      </AppText>
                    </Pressable>
                  ))}
                </View>

                <Button variant="ghost" textClassName="text-red-500" onPress={handleDeleteTask}>
                  <Trash2 size={16} color="#ef4444" className="mr-2" />
                  ลบรายการนี้
                </Button>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
