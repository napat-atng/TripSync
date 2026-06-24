import { Tabs } from "expo-router";
import { Pressable } from "react-native";
import { router } from "expo-router";
import { AppText } from "../../components/AppText";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#4A1B0C" },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontWeight: "700" },
        tabBarActiveTintColor: "#D85A30",
        tabBarStyle: { borderTopColor: "#F5C4B3" },
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
              <AppText className="text-sm font-semibold text-primary-200">โปรไฟล์</AppText>
            </Pressable>
          ),
        }}
      />
    </Tabs>
  );
}
