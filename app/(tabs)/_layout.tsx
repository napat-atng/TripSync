import { Tabs } from "expo-router";

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
      <Tabs.Screen name="home" options={{ title: "Home" }} />
    </Tabs>
  );
}
