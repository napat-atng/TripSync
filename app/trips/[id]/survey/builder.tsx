import React, { useEffect, useState } from "react";
import { View, Pressable, ActivityIndicator, Alert, TextInput, ScrollView, Modal } from "react-native";
import { useLocalSearchParams, Stack, router } from "expo-router";
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from "react-native-draggable-flatlist";

import { AppText } from "../../../../components/AppText";
import { getQuestions, saveQuestions } from "../../../../lib/survey";
import type { SurveyQuestion, SurveyQuestionType } from "../../../../types/survey";

export default function SurveyBuilderScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [addModalVisible, setAddModalVisible] = useState(false);

  useEffect(() => {
    loadQuestions();
  }, [tripId]);

  const loadQuestions = async () => {
    try {
      const data = await getQuestions(tripId!);
      setQuestions(data || []);
    } catch (error) {
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถโหลดคำถามได้");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      // Update order_index before saving
      const payload = questions.map((q, index) => ({
        ...q,
        order_index: index,
      }));
      await saveQuestions(tripId!, payload);
      Alert.alert("บันทึกเรียบร้อย", "บันทึกแบบสอบถามสำเร็จแล้ว!");
      router.back();
    } catch (error) {
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถบันทึกแบบสอบถามได้");
    } finally {
      setIsSaving(false);
    }
  };

  const addNewQuestion = (type: SurveyQuestionType) => {
    const newQ: SurveyQuestion = {
      id: Math.random().toString(36).substring(7), // Temp ID for new items
      trip_id: tripId!,
      type,
      question: "คำถามใหม่",
      options: type === "multiple_choice" ? ["Option 1", "Option 2"] : type === "budget_range" ? { min: 0, max: 1000, step: 100 } : null,
      order_index: questions.length,
      created_at: new Date().toISOString(),
    };
    setQuestions([...questions, newQ]);
    setAddModalVisible(false);
  };

  const deleteQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const updateQuestionText = (id: string, text: string) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, question: text } : q)));
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<SurveyQuestion>) => {
    return (
      <ScaleDecorator>
        <View className={`mb-3 flex-row rounded-xl border p-4 ${isActive ? "bg-teal-50 border-teal-200" : "bg-white border-slate-200"}`}>
          <Pressable onLongPress={drag} disabled={isActive} className="mr-3 justify-center">
            <AppText className="text-2xl text-slate-400">≡</AppText>
          </Pressable>
          <View className="flex-1 justify-center">
            <View className="mb-2 flex-row items-center justify-between">
              <View className="rounded-full bg-slate-100 px-2 py-1">
                <AppText className="text-xs font-semibold uppercase text-slate-600">{item.type.replace("_", " ")}</AppText>
              </View>
              <Pressable onPress={() => deleteQuestion(item.id)}>
                <AppText className="text-red-500">ลบ</AppText>
              </Pressable>
            </View>
            <TextInput
              className="h-10 border-b border-slate-200 text-base text-slate-900"
              value={item.question}
              onChangeText={(text) => updateQuestionText(item.id, text)}
              placeholder="พิมพ์คำถามของคุณ"
            />
            {item.type === "multiple_choice" && (
              <AppText className="mt-2 text-xs text-slate-500">
                ตัวเลือก: {item.options?.join(", ")} (แก้ไขรายละเอียดเพิ่มเติมผ่านเว็บไซต์)
              </AppText>
            )}
          </View>
        </View>
      </ScaleDecorator>
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <Stack.Screen options={{ title: "Survey Builder" }} />
      
      <View className="flex-1 px-4 pt-4">
        <DraggableFlatList
          data={questions}
          onDragEnd={({ data }) => setQuestions(data)}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <View className="items-center justify-center py-10">
              <AppText className="text-slate-500">ยังไม่มีคำถาม กด + เพิ่มคำถามเพื่อเริ่มต้น!</AppText>
            </View>
          }
        />
      </View>

      <View className="flex-row items-center justify-between border-t border-slate-200 bg-white p-4 pb-8">
        <Pressable
          className="flex-1 mr-2 h-12 items-center justify-center rounded-lg border border-teal-600 bg-teal-50"
          onPress={() => setAddModalVisible(true)}
        >
          <AppText className="font-semibold text-teal-700">+ เพิ่มคำถาม</AppText>
        </Pressable>
        <Pressable
          className="flex-1 ml-2 h-12 items-center justify-center rounded-lg bg-teal-600"
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? <ActivityIndicator color="#fff" /> : <AppText className="font-semibold text-white">บันทึกแบบสอบถาม</AppText>}
        </Pressable>
      </View>

      <Modal visible={addModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/30">
          <View className="rounded-t-2xl bg-white p-6 pb-12">
            <View className="mb-4 flex-row items-center justify-between">
              <AppText className="text-xl font-bold text-slate-900">เลือกประเภทคำถาม</AppText>
              <Pressable onPress={() => setAddModalVisible(false)}>
                <AppText className="text-slate-500">ปิด</AppText>
              </Pressable>
            </View>
            <View className="space-y-3">
              {[
                { type: "text", label: "ตอบข้อความ", desc: "กรอกข้อความเสรี" },
                { type: "date_range", label: "ช่วงวันที่", desc: "เลือกวันเริ่มต้นและวันสิ้นสุด" },
                { type: "multiple_choice", label: "ตัวเลือก", desc: "เลือกจากตัวเลือกที่กำหนด" },
                { type: "budget_range", label: "ช่วงงบประมาณ", desc: "เลือกงบขั้นต่ำและขั้นสูง" },
              ].map((opt) => (
                <Pressable
                  key={opt.type}
                  className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
                  onPress={() => addNewQuestion(opt.type as SurveyQuestionType)}
                >
                  <AppText className="font-semibold text-slate-900">{opt.label}</AppText>
                  <AppText className="text-sm text-slate-500">{opt.desc}</AppText>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
