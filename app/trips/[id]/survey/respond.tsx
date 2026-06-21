import React, { useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator, Alert, Pressable, TextInput } from "react-native";
import { useLocalSearchParams, Stack, router } from "expo-router";
import { useForm, Controller } from "react-hook-form";

import { AppText } from "../../../../components/AppText";
import { getQuestions, getMyResponses, submitResponses } from "../../../../lib/survey";
import { getMyMemberId } from "../../../../lib/members";
import { useAuth } from "../../../../hooks/useAuth";
import type { SurveyQuestion, SurveyResponse } from "../../../../types/survey";

function getEmptyAnswer(question: SurveyQuestion) {
  if (question.type === "multiple_choice") return [];
  return "";
}

function getRequiredRule(question: SurveyQuestion) {
  const message = "กรุณาตอบคำถามนี้";

  if (question.type === "multiple_choice") {
    return {
      validate: (value: unknown) => (Array.isArray(value) && value.length > 0) || message,
    };
  }

  return { required: message };
}

function normalizeExistingAnswer(question: SurveyQuestion, answer: any) {
  if (answer === undefined || answer === null) return getEmptyAnswer(question);

  if (question.type === "multiple_choice") {
    const validOptions = Array.isArray(question.options) ? question.options : [];
    const selectedOptions = Array.isArray(answer) ? answer : [];
    return selectedOptions.filter((option) => validOptions.includes(option));
  }

  return answer;
}

export default function SurveyRespondScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const user = useAuth((state) => state.user);

  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [existingResponses, setExistingResponses] = useState<SurveyResponse[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm();

  useEffect(() => {
    loadData();
  }, [tripId, user]);

  const loadData = async () => {
    try {
      const qs = await getQuestions(tripId!);
      setQuestions(qs || []);

      const mId = await getMyMemberId(tripId!, user?.id);
      if (mId) {
        setMemberId(mId);
        const resps = await getMyResponses(mId, tripId!);
        setExistingResponses(resps || []);

        reset(
          (qs || []).reduce<Record<string, any>>((defaults, q) => {
            const existing = (resps || []).find((resp) => resp.question_id === q.id);
            defaults[q.id] = normalizeExistingAnswer(q, existing?.answer);
            return defaults;
          }, {}),
        );
      } else {
        reset(
          (qs || []).reduce<Record<string, any>>((defaults, q) => {
            defaults[q.id] = getEmptyAnswer(q);
            return defaults;
          }, {}),
        );
      }
    } catch (error) {
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถโหลดข้อมูลแบบสอบถามได้");
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: Record<string, any>) => {
    if (!memberId) {
      Alert.alert("ข้อผิดพลาด", "คุณไม่ได้เป็นสมาชิกของทริปนี้");
      return;
    }

    try {
      const responsesToSubmit = Object.entries(data).map(([questionId, answer]) => ({
        question_id: questionId,
        answer,
      }));

      await submitResponses(memberId, tripId!, responsesToSubmit);
      Alert.alert("บันทึกคำตอบเรียบร้อย", "คุณสามารถกลับมาแก้ไขคำตอบได้ภายหลัง");
      router.back();
    } catch (error) {
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถบันทึกคำตอบได้");
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  if (questions.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-6">
        <Stack.Screen options={{ title: "แบบสอบถาม" }} />
        <AppText className="text-center text-slate-500">
          หัวหน้าทริปยังไม่ได้สร้างแบบสอบถาม
        </AppText>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <Stack.Screen options={{ title: "แบบสอบถาม" }} />
      <ScrollView className="flex-1 p-6" keyboardShouldPersistTaps="handled">
        <AppText className="mb-6 text-slate-500">
          {existingResponses.length > 0
            ? "คุณเคยตอบแบบสอบถามนี้แล้ว แก้ไขคำตอบแล้วกดบันทึกได้เลย"
            : "กรุณาตอบคำถามต่อไปนี้ เพื่อช่วยวางแผนทริปกัน"}
        </AppText>

        {questions.map((q) => (
          <View key={q.id} className="mb-6 rounded-xl bg-white p-5 border border-slate-200 shadow-sm">
            <AppText className="mb-3 text-base font-bold text-slate-900">{q.question}</AppText>

            <Controller
              control={control}
              name={q.id}
              defaultValue={getEmptyAnswer(q)}
              rules={getRequiredRule(q)}
              render={({ field: { onChange, value }, fieldState: { error } }) => {
                if (q.type === "text") {
                  return (
                    <View>
                      <TextInput
                        className="h-12 rounded-lg border border-slate-300 px-4 text-base bg-slate-50"
                        placeholder="คำตอบของคุณ"
                        value={String(value ?? "")}
                        onChangeText={onChange}
                      />
                      {error && <AppText className="mt-1 text-sm text-red-500">{error.message}</AppText>}
                    </View>
                  );
                }

                if (q.type === "multiple_choice") {
                  const opts = Array.isArray(q.options) ? q.options : [];
                  const selectedArr = Array.isArray(value) ? value : [];

                  return (
                    <View>
                      <View className="flex-row flex-wrap">
                        {opts.map((opt: string) => {
                          const isSelected = selectedArr.includes(opt);
                          return (
                            <Pressable
                              key={opt}
                              className={`mr-2 mb-2 rounded-full px-4 py-2 border ${
                                isSelected ? "bg-teal-600 border-teal-600" : "bg-slate-50 border-slate-300"
                              }`}
                              onPress={() => {
                                if (isSelected) {
                                  onChange(selectedArr.filter((item: string) => item !== opt));
                                } else {
                                  onChange([...selectedArr, opt]);
                                }
                              }}
                            >
                              <AppText className={`font-medium ${isSelected ? "text-white" : "text-slate-700"}`}>
                                {opt}
                              </AppText>
                            </Pressable>
                          );
                        })}
                      </View>
                      {error && <AppText className="mt-1 text-sm text-red-500">{error.message}</AppText>}
                    </View>
                  );
                }

                return (
                  <View>
                    <TextInput
                      className="h-12 rounded-lg border border-slate-300 px-4 text-base bg-slate-50"
                      placeholder={`Enter ${q.type.replace("_", " ")}`}
                      value={String(value ?? "")}
                      onChangeText={onChange}
                    />
                    {error && <AppText className="mt-1 text-sm text-red-500">{error.message}</AppText>}
                  </View>
                );
              }}
            />
          </View>
        ))}
      </ScrollView>

      <View className="border-t border-slate-200 bg-white p-4 pb-8">
        <Pressable
          className="h-14 items-center justify-center rounded-lg bg-teal-600"
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <AppText className="text-lg font-semibold text-white">บันทึกคำตอบ</AppText>
          )}
        </Pressable>
      </View>
    </View>
  );
}
