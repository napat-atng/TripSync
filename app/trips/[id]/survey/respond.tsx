import React, { useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator, Alert, Pressable, TextInput } from "react-native";
import { useLocalSearchParams, Stack, router } from "expo-router";
import { useForm, Controller } from "react-hook-form";

import { AppText } from "../../../../components/AppText";
import { getQuestions, getMyResponses, submitResponses } from "../../../../lib/survey";
import { getMyMemberId } from "../../../../lib/members";
import { useAuth } from "../../../../hooks/useAuth";
import type { SurveyQuestion, SurveyResponse } from "../../../../types/survey";

export default function SurveyRespondScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const user = useAuth((state) => state.user);
  
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [existingResponses, setExistingResponses] = useState<SurveyResponse[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { control, handleSubmit, formState: { isSubmitting } } = useForm();

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
      // Map form data to SurveyResponse payload
      const responsesToSubmit = Object.entries(data).map(([questionId, answer]) => ({
        question_id: questionId,
        answer: answer,
      }));

      await submitResponses(memberId, tripId!, responsesToSubmit);
      Alert.alert("ส่งคำตอบเรียบร้อย", "ขอบคุณที่ตอบคำถาม!");
      router.back();
    } catch (error) {
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถส่งคำตอบได้");
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
        <Stack.Screen options={{ title: "Survey" }} />
        <AppText className="text-center text-slate-500">
          The trip leader hasn't created a survey yet.
        </AppText>
      </View>
    );
  }

  // Read-only Mode
  if (existingResponses.length > 0) {
    return (
      <ScrollView className="flex-1 bg-slate-50 p-6">
        <Stack.Screen options={{ title: "คำตอบของคุณ" }} />
        <View className="mb-6 rounded-xl bg-teal-50 p-4 border border-teal-200">
          <AppText className="text-teal-800 font-semibold text-center">
            คุณส่งคำตอบแบบสอบถามแล้ว!
          </AppText>
        </View>

        {questions.map((q) => {
          const resp = existingResponses.find(r => r.question_id === q.id);
          return (
            <View key={q.id} className="mb-6 rounded-xl bg-white p-5 border border-slate-200 shadow-sm">
              <AppText className="mb-3 text-lg font-bold text-slate-900">{q.question}</AppText>
              <AppText className="text-base text-slate-700">
                {resp ? JSON.stringify(resp.answer) : "ยังไม่ได้ตอบคำถามนี้"}
              </AppText>
            </View>
          );
        })}
      </ScrollView>
    );
  }

  // Edit Mode
  return (
    <View className="flex-1 bg-slate-50">
      <Stack.Screen options={{ title: "แบบสอบถาม" }} />
      <ScrollView className="flex-1 p-6" keyboardShouldPersistTaps="handled">
        <AppText className="mb-6 text-slate-500">
          กรุณาตอบคำถามต่อไปนี้ เพื่อช่วยวางแผนทริปกัน
        </AppText>

        {questions.map((q) => (
          <View key={q.id} className="mb-6 rounded-xl bg-white p-5 border border-slate-200 shadow-sm">
            <AppText className="mb-3 text-base font-bold text-slate-900">{q.question}</AppText>
            
            <Controller
              control={control}
              name={q.id}
              defaultValue=""
              rules={{ required: "กรุณาตอบคำถามนี้" }}
              render={({ field: { onChange, value }, fieldState: { error } }) => {
                
                // Text Response
                if (q.type === "text") {
                  return (
                    <View>
                      <TextInput
                        className="h-12 rounded-lg border border-slate-300 px-4 text-base bg-slate-50"
                        placeholder="คำตอบของคุณ"
                        value={value}
                        onChangeText={onChange}
                      />
                      {error && <AppText className="mt-1 text-sm text-red-500">{error.message}</AppText>}
                    </View>
                  );
                }

                // Multiple Choice (simplified for UI)
                if (q.type === "multiple_choice") {
                  const opts = Array.isArray(q.options) ? q.options : [];
                  const selectedArr = Array.isArray(value) ? value : [];
                  
                  return (
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
                                onChange(selectedArr.filter(item => item !== opt));
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
                  );
                }

                // Fallback for others (Date Range, Budget) for MVP
                return (
                  <View>
                    <TextInput
                      className="h-12 rounded-lg border border-slate-300 px-4 text-base bg-slate-50"
                      placeholder={`Enter ${q.type.replace("_", " ")}`}
                      value={value}
                      onChangeText={onChange}
                    />
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
            <AppText className="text-lg font-semibold text-white">ส่งคำตอบ</AppText>
          )}
        </Pressable>
      </View>
    </View>
  );
}
