import { useCallback, useEffect, useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useLocalSearchParams, Stack, router, useFocusEffect } from "expo-router";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import {
  Plus,
  Clock,
  MapPin,
  Wallet,
  Pencil,
  Trash2,
  X,
  Calendar,
  Minus,
} from "lucide-react-native";

import { AppText } from "../../../../components/AppText";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { useTripStore } from "../../../../store/tripStore";
import { useItineraryStore } from "../../../../store/itineraryStore";
import { useAuth } from "../../../../hooks/useAuth";
import { getMyMemberId } from "../../../../lib/members";
import { supabase } from "../../../../lib/supabase";
import {
  getItineraryByTrip,
  addItineraryEvent,
  updateItineraryEvent,
  deleteItineraryEvent,
  setTripDuration,
  buildItineraryDays,
  subscribeToItineraryEvents,
} from "../../../../lib/itinerary";
import type { ItineraryEvent } from "../../../../types/itinerary";

// ----------------------------------------------------------------
// Formatting helpers
// ----------------------------------------------------------------
function formatDayLabel(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTimeLabel(hhmmss: string) {
  return hhmmss.slice(0, 5);
}

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function timeStringToDate(hhmm: string | null): Date {
  const d = new Date();
  if (!hhmm) {
    d.setHours(9, 0, 0, 0);
    return d;
  }
  const [h, m] = hhmm.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToTimeString(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ----------------------------------------------------------------
// Screen
// ----------------------------------------------------------------
export default function ItineraryScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();

  const trips = useTripStore((s) => s.trips);
  const updateTrip = useTripStore((s) => s.updateTrip);
  const user = useAuth((s) => s.user);

  const events = useItineraryStore((s) => s.events);
  const setEvents = useItineraryStore((s) => s.setEvents);
  const addEventLocal = useItineraryStore((s) => s.addEvent);
  const updateEventLocal = useItineraryStore((s) => s.updateEvent);
  const removeEventLocal = useItineraryStore((s) => s.removeEvent);
  const selectedDayNumber = useItineraryStore((s) => s.selectedDayNumber);
  const setSelectedDayNumber = useItineraryStore((s) => s.setSelectedDayNumber);

  const trip = trips.find((t) => t.id === tripId);
  const tripMembers = (trip as any)?.trip_members ?? [];

  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [durationInput, setDurationInput] = useState(3);
  const [isSavingDuration, setIsSavingDuration] = useState(false);

  const isLeader =
    myRole === "leader" || tripMembers.some((m: any) => m.user_id === user?.id && m.role === "leader");

  // ---- Load ----
  const load = useCallback(async () => {
    if (!tripId) return;
    setIsLoading(true);
    try {
      const [mid, evts] = await Promise.all([getMyMemberId(tripId, user?.id), getItineraryByTrip(tripId)]);
      setMyMemberId(mid ?? null);
      setEvents(evts);

      if (mid) {
        const { data: memberRow } = await (supabase as any)
          .from("trip_members")
          .select("role")
          .eq("id", mid)
          .single();
        if (memberRow?.role) setMyRole(memberRow.role);
      }
    } catch {
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถโหลดแผนการเดินทางได้");
    } finally {
      setIsLoading(false);
    }
  }, [tripId, user?.id, setEvents]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Realtime: reload the flat event list whenever anyone edits the itinerary
  useEffect(() => {
    if (!tripId) return;
    const unsubscribe = subscribeToItineraryEvents(tripId, load);
    return unsubscribe;
  }, [tripId, load]);

  // ---- Duration setup (leader only, first-time) ----
  const handleSaveDuration = async () => {
    if (!tripId) return;
    setIsSavingDuration(true);
    try {
      const updated = await setTripDuration(tripId, durationInput);
      updateTrip(tripId, { duration_days: updated.duration_days });
    } catch {
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถบันทึกจำนวนวันได้");
    } finally {
      setIsSavingDuration(false);
    }
  };

  // ---- Add / edit event modal state ----
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ItineraryEvent | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formCost, setFormCost] = useState("");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState<string | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [isSavingEvent, setIsSavingEvent] = useState(false);

  const days = trip?.confirmed_date && trip?.duration_days
    ? buildItineraryDays(trip.confirmed_date, trip.duration_days, events)
    : [];
  const currentDay = days.find((d) => d.dayNumber === selectedDayNumber) ?? days[0];

  const openAddModal = () => {
    setEditingEvent(null);
    setFormTitle("");
    setFormDescription("");
    setFormLocation("");
    setFormCost("");
    setFormStartTime("09:00");
    setFormEndTime(null);
    setModalVisible(true);
  };

  const openEditModal = (event: ItineraryEvent) => {
    setEditingEvent(event);
    setFormTitle(event.title);
    setFormDescription(event.description ?? "");
    setFormLocation(event.location ?? "");
    setFormCost(event.cost_estimate != null ? String(event.cost_estimate) : "");
    setFormStartTime(formatTimeLabel(event.start_time));
    setFormEndTime(event.end_time ? formatTimeLabel(event.end_time) : null);
    setModalVisible(true);
  };

  const handleSaveEvent = async () => {
    if (!tripId || !currentDay || !formTitle.trim() || !myMemberId) return;
    setIsSavingEvent(true);
    try {
      const input = {
        eventDate: currentDay.date,
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        startTime: formStartTime,
        endTime: formEndTime,
        location: formLocation.trim() || null,
        costEstimate: formCost.trim() ? Number(formCost) : null,
      };

      if (editingEvent) {
        const updated = await updateItineraryEvent(editingEvent.id, input);
        updateEventLocal(editingEvent.id, updated);
      } else {
        const created = await addItineraryEvent(tripId, myMemberId, input);
        addEventLocal(created);
      }
      setModalVisible(false);
    } catch {
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถบันทึกกิจกรรมได้");
    } finally {
      setIsSavingEvent(false);
    }
  };

  const handleDeleteEvent = () => {
    if (!editingEvent) return;
    Alert.alert("ลบกิจกรรม", `ต้องการลบ "${editingEvent.title}" ใช่ไหม?`, [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ลบ",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteItineraryEvent(editingEvent.id);
            removeEventLocal(editingEvent.id);
            setModalVisible(false);
          } catch {
            Alert.alert("ข้อผิดพลาด", "ไม่สามารถลบกิจกรรมได้");
          }
        },
      },
    ]);
  };

  const onChangeStart = (event: DateTimePickerEvent, selected?: Date) => {
    setShowStartPicker(false);
    if (event.type === "set" && selected) setFormStartTime(dateToTimeString(selected));
  };

  const onChangeEnd = (event: DateTimePickerEvent, selected?: Date) => {
    setShowEndPicker(false);
    if (event.type === "set" && selected) setFormEndTime(dateToTimeString(selected));
  };

  // ---- Render states ----
  if (isLoading && events.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-50">
        <ActivityIndicator size="large" color="#D85A30" />
      </View>
    );
  }

  if (!trip) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-50">
        <ActivityIndicator size="large" color="#D85A30" />
      </View>
    );
  }

  if (!trip.confirmed_date) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-50 px-8">
        <Stack.Screen options={{ title: "แผนการเดินทาง" }} />
        <Calendar size={40} color="#94a3b8" />
        <AppText className="mt-4 text-center text-lg font-bold text-surface-900">
          ยังไม่ได้ยืนยันวันเดินทาง
        </AppText>
        <AppText className="mt-2 text-center text-sm text-surface-500">
          กำหนดวันเดินทางในหน้าแดชบอร์ดก่อน แล้วค่อยกลับมาวางแผนกิจกรรมแต่ละวันได้เลย
        </AppText>
        <Button className="mt-6" onPress={() => router.push(`/trips/${trip.id}/dashboard` as any)}>
          ไปหน้าแดชบอร์ด
        </Button>
      </View>
    );
  }

  if (!trip.duration_days) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-50 px-8">
        <Stack.Screen options={{ title: "แผนการเดินทาง" }} />
        <Calendar size={40} color="#94a3b8" />
        <AppText className="mt-4 text-center text-lg font-bold text-surface-900">
          ทริปนี้กี่วัน?
        </AppText>
        {isLeader ? (
          <>
            <AppText className="mt-2 text-center text-sm text-surface-500">
              ระบุจำนวนวันของทริป เพื่อสร้างตารางเวลาแยกตามวัน เริ่มจาก{" "}
              {formatDayLabel(trip.confirmed_date)}
            </AppText>
            <View className="mt-6 flex-row items-center gap-4">
              <Pressable
                className="h-12 w-12 items-center justify-center rounded-xl border border-surface-300 bg-white"
                onPress={() => setDurationInput((v) => Math.max(1, v - 1))}
              >
                <Minus size={18} color="#334155" />
              </Pressable>
              <AppText className="w-16 text-center text-2xl font-extrabold text-surface-950">
                {durationInput}
              </AppText>
              <Pressable
                className="h-12 w-12 items-center justify-center rounded-xl border border-surface-300 bg-white"
                onPress={() => setDurationInput((v) => Math.min(60, v + 1))}
              >
                <Plus size={18} color="#334155" />
              </Pressable>
            </View>
            <Button className="mt-6 w-48" loading={isSavingDuration} onPress={handleSaveDuration}>
              บันทึก
            </Button>
          </>
        ) : (
          <AppText className="mt-2 text-center text-sm text-surface-500">
            รอหัวหน้าทริปกำหนดจำนวนวันของทริปก่อนนะ
          </AppText>
        )}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-50">
      <Stack.Screen options={{ title: "แผนการเดินทาง" }} />

      {/* Day tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="border-b border-surface-200 bg-white"
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
      >
        {days.map((day) => {
          const selected = day.dayNumber === selectedDayNumber;
          return (
            <Pressable
              key={day.dayNumber}
              onPress={() => setSelectedDayNumber(day.dayNumber)}
              className={`rounded-xl px-4 py-2.5 ${selected ? "bg-primary-600" : "bg-surface-100"}`}
            >
              <AppText
                className={`text-xs font-bold ${selected ? "text-white" : "text-surface-500"}`}
              >
                วันที่ {day.dayNumber}
              </AppText>
              <AppText
                className={`mt-0.5 text-sm font-semibold ${selected ? "text-white" : "text-surface-800"}`}
              >
                {formatDayLabel(day.date)}
              </AppText>
              {day.events.length > 0 && (
                <View
                  className={`mt-1 h-1.5 w-1.5 self-center rounded-full ${
                    selected ? "bg-white" : "bg-primary-400"
                  }`}
                />
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Timeline */}
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {!currentDay || currentDay.events.length === 0 ? (
          <View className="mt-16 items-center">
            <Clock size={32} color="#cbd5e1" />
            <AppText className="mt-3 text-center text-base font-semibold text-surface-700">
              ยังไม่มีแผนสำหรับวันนี้
            </AppText>
            {isLeader && (
              <AppText className="mt-1 text-center text-sm text-surface-500">
                กดปุ่ม + เพื่อเพิ่มกิจกรรมแรกของวันนี้
              </AppText>
            )}
          </View>
        ) : (
          <View className="gap-3">
            {currentDay.events.map((event) => (
              <Pressable
                key={event.id}
                disabled={!isLeader}
                onPress={() => openEditModal(event)}
                className="flex-row rounded-2xl border border-surface-200 bg-white p-4"
              >
                <View className="mr-3 w-16">
                  <AppText className="text-sm font-bold text-primary-600">
                    {formatTimeLabel(event.start_time)}
                  </AppText>
                  {event.end_time && (
                    <AppText className="text-xs text-surface-400">
                      – {formatTimeLabel(event.end_time)}
                    </AppText>
                  )}
                </View>
                <View className="w-px bg-surface-200" />
                <View className="ml-3 flex-1">
                  <View className="flex-row items-start justify-between">
                    <AppText className="flex-1 pr-2 text-base font-semibold text-surface-900">
                      {event.title}
                    </AppText>
                    {isLeader && <Pencil size={16} color="#94a3b8" />}
                  </View>
                  {event.description && (
                    <AppText className="mt-1 text-sm text-surface-500">{event.description}</AppText>
                  )}
                  <View className="mt-2 flex-row flex-wrap gap-3">
                    {event.location && (
                      <View className="flex-row items-center gap-1">
                        <MapPin size={13} color="#94a3b8" />
                        <AppText className="text-xs text-surface-500">{event.location}</AppText>
                      </View>
                    )}
                    {event.cost_estimate != null && (
                      <View className="flex-row items-center gap-1">
                        <Wallet size={13} color="#94a3b8" />
                        <AppText className="text-xs text-surface-500">
                          ฿{formatMoney(event.cost_estimate)}
                        </AppText>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      {isLeader && (
        <Pressable
          className="absolute bottom-8 right-6 h-14 w-14 items-center justify-center rounded-full bg-primary-600 shadow-lg"
          onPress={openAddModal}
          style={{ elevation: 4 }}
        >
          <Plus size={26} color="#fff" />
        </Pressable>
      )}

      {/* Add / edit modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 justify-end"
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <Pressable className="absolute inset-0 bg-black/40" onPress={() => setModalVisible(false)} />
          <View className="max-h-[85%] rounded-t-2xl bg-white p-6 pb-10">
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="mb-4 flex-row items-center justify-between">
                <AppText className="text-lg font-bold text-surface-950">
                  {editingEvent ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรม"}
                  {currentDay ? ` · วันที่ ${currentDay.dayNumber}` : ""}
                </AppText>
                <Pressable onPress={() => setModalVisible(false)}>
                  <X size={22} color="#64748b" />
                </Pressable>
              </View>

              <Input label="ชื่อกิจกรรม" placeholder="เช่น เช็คอินที่พัก" value={formTitle} onChangeText={setFormTitle} />

              <Input
                label="รายละเอียด (ไม่บังคับ)"
                placeholder="รายละเอียดเพิ่มเติม"
                value={formDescription}
                onChangeText={setFormDescription}
                multiline
              />

              <View className="mb-4 flex-row gap-3">
                <View className="flex-1">
                  <AppText className="mb-1.5 ml-1 text-sm font-medium text-surface-700">เวลาเริ่ม</AppText>
                  <Pressable
                    className="h-14 items-center justify-center rounded-xl border border-surface-200 bg-surface-50"
                    onPress={() => setShowStartPicker(true)}
                  >
                    <AppText className="font-semibold text-surface-900">{formStartTime}</AppText>
                  </Pressable>
                </View>
                <View className="flex-1">
                  <AppText className="mb-1.5 ml-1 text-sm font-medium text-surface-700">
                    เวลาสิ้นสุด (ไม่บังคับ)
                  </AppText>
                  <Pressable
                    className="h-14 items-center justify-center rounded-xl border border-surface-200 bg-surface-50"
                    onPress={() => setShowEndPicker(true)}
                  >
                    <AppText className="font-semibold text-surface-900">{formEndTime ?? "ไม่ระบุ"}</AppText>
                  </Pressable>
                </View>
              </View>

              {formEndTime && (
                <Pressable onPress={() => setFormEndTime(null)} className="mb-4 self-start">
                  <AppText className="text-xs text-surface-400 underline">ล้างเวลาสิ้นสุด</AppText>
                </Pressable>
              )}

              <Input
                label="สถานที่ (ไม่บังคับ)"
                placeholder="เช่น สนามบินสุวรรณภูมิ"
                value={formLocation}
                onChangeText={setFormLocation}
              />

              <Input
                label="ค่าใช้จ่ายโดยประมาณ (ไม่บังคับ)"
                placeholder="0"
                value={formCost}
                onChangeText={setFormCost}
                keyboardType="numeric"
              />

              <Button loading={isSavingEvent} disabled={!formTitle.trim()} onPress={handleSaveEvent}>
                บันทึก
              </Button>

              {editingEvent && (
                <Button
                  variant="ghost"
                  className="mt-2"
                  textClassName="text-red-500"
                  onPress={handleDeleteEvent}
                >
                  <Trash2 size={16} color="#ef4444" className="mr-2" />
                  ลบกิจกรรมนี้
                </Button>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {showStartPicker && (
        <DateTimePicker
          value={timeStringToDate(formStartTime)}
          mode="time"
          is24Hour
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onChangeStart}
        />
      )}
      {showEndPicker && (
        <DateTimePicker
          value={timeStringToDate(formEndTime)}
          mode="time"
          is24Hour
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onChangeEnd}
        />
      )}
    </View>
  );
}
