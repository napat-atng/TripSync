import { Tabs } from "expo-router";
import { Pressable } from "react-native";
import { router } from "expo-router";
import { AppText } from "../../components/AppText";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#0f172a" },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontWeight: "700" },
        tabBarActiveTintColor: "#0f766e",
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "หน้าหลัก",
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/profile")}
              className="mr-4"
            >
              <AppText className="text-sm font-semibold text-teal-300">โปรไฟล์</AppText>
            </Pressable>
          ),
        }}
      />
    </Tabs>
  );
}
