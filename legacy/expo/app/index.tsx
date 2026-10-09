import { Redirect } from "expo-router";

import { useAuthStore } from "../store/authStore";

export default function IndexScreen() {
  const session = useAuthStore((state) => state.session);

  if (session) {
    return <Redirect href="/(tabs)/home" />;
  }

  return <Redirect href="/(auth)/login" />;
}
