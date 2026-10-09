import React, { useEffect, useState } from "react";
import { View, Pressable, ActivityIndicator, Alert, TextInput, Modal } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from "react-native-draggable-flatlist";

import { AppText } from "../../../../components/AppText";
import { getQuestions, saveQuestions } from "../../../../lib/survey";
import type { SurveyQuestion, SurveyQuestionType } from "../../../../types/survey";

function getQuestionOptions(question: SurveyQuestion) {
  return Array.isArray(question.options) ? (question.options as string[]) : [];
}

function normalizeMultipleChoiceOptions(options: string[]) {
  const seen = new Set<string>();

  return options
    .map((option) => option.trim())
    .filter((option) => {
      if (!option || seen.has(option)) return false;
      seen.add(option);
      return true;
    });
}

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
    const normalizedQuestions = questions.map((q) => {
      if (q.type !== "multiple_choice") return q;

      return {
        ...q,
        options: normalizeMultipleChoiceOptions(getQuestionOptions(q)),
      };
    });

    const invalidMultipleChoice = normalizedQuestions.find(
      (q) => q.type === "multiple_choice" && getQuestionOptions(q).length === 0,
    );

    if (invalidMultipleChoice) {
      Alert.alert("ยังไม่มีตัวเลือก", "คำถามแบบตัวเลือกต้องมีอย่างน้อย 1 ตัวเลือก");
      return;
    }

    try {
      setIsSaving(true);
      const payload = normalizedQuestions.map((q, index) => ({
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
      id: Math.random().toString(36).substring(7),
      trip_id: tripId!,
      type,
      question: "คำถามใหม่",
      options: type === "multiple_choice" ? [] : type === "budget_range" ? { min: 0, max: 1000, step: 100 } : [],
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

  const updateQuestionOptions = (id: string, options: string[]) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, options } : q)));
  };

  const updateQuestionOption = (id: string, optionIndex: number, text: string) => {
    const question = questions.find((q) => q.id === id);
    if (!question) return;

    const options = [...getQuestionOptions(question)];
    options[optionIndex] = text;
    updateQuestionOptions(id, options);
  };

  const addQuestionOption = (id: string) => {
    const question = questions.find((q) => q.id === id);
    if (!question) return;

    updateQuestionOptions(id, [...getQuestionOptions(question), ""]);
  };

  const deleteQuestionOption = (id: string, optionIndex: number) => {
    const question = questions.find((q) => q.id === id);
    if (!question) return;

    updateQuestionOptions(
      id,
      getQuestionOptions(question).filter((_, index) => index !== optionIndex),
    );
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<SurveyQuestion>) => {
    const options = getQuestionOptions(item);
    const visibleOptions = options.length > 0 ? options : [""];

    return (
      <ScaleDecorator>
        <View className={`mb-3 flex-row rounded-xl border p-4 ${isActive ? "bg-primary-50 border-primary-200" : "bg-white border-slate-200"}`}>
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
              style={{ fontFamily: "Sarabun_400Regular" }}
              value={item.question}
              onChangeText={(text) => updateQuestionText(item.id, text)}
              placeholder="พิมพ์คำถามของคุณ"
            />

            {item.type === "multiple_choice" && (
              <View className="mt-4">
                <AppText className="mb-2 text-xs font-semibold text-slate-600">ตัวเลือก</AppText>
                {visibleOptions.map((option, index) => (
                  <View key={`${item.id}-option-${index}`} className="mb-2 flex-row items-center">
                    <TextInput
                      className="mr-2 h-10 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm text-slate-900"
                      style={{ fontFamily: "Sarabun_400Regular" }}
                      value={option}
                      onChangeText={(text) => updateQuestionOption(item.id, index, text)}
                      placeholder={`ตัวเลือก ${index + 1}`}
                    />
                    <Pressable
                      className="h-10 w-10 items-center justify-center rounded-lg border border-red-200 bg-red-50"
                      onPress={() => deleteQuestionOption(item.id, index)}
                    >
                      <AppText className="font-semibold text-red-500">ลบ</AppText>
                    </Pressable>
                  </View>
                ))}
                <Pressable
                  className="mt-1 h-10 items-center justify-center rounded-lg border border-teal-600 bg-teal-50"
                  onPress={() => addQuestionOption(item.id)}
                >
                  <AppText className="font-semibold text-teal-700">+ เพิ่มตัวเลือก</AppText>
                </Pressable>
              </View>
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
          className="flex-1 mr-2 h-12 items-center justify-center rounded-lg border border-primary-600 bg-primary-50"
          onPress={() => setAddModalVisible(true)}
        >
          <AppText className="font-semibold text-primary-700">+ เพิ่มคำถาม</AppText>
        </Pressable>
        <Pressable
          className="flex-1 ml-2 h-12 items-center justify-center rounded-lg bg-primary-600"
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
            <View>
              {[
                { type: "text", label: "ตอบข้อความ", desc: "กรอกข้อความเสรี" },
                { type: "multiple_choice", label: "ตัวเลือก", desc: "เลือกจากตัวเลือกที่กำหนด" },
                { type: "budget_range", label: "ช่วงงบประมาณ", desc: "กรอกงบประมาณต่อคน (บาท)" },
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
