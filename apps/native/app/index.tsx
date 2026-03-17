import { Pressable, StyleSheet } from "react-native";
import { YStack, Text } from "tamagui";
import { router } from "expo-router";

import { authClient } from "@/lib/auth-client";

export default function Home() {
  const { data: session } = authClient.useSession();

  return (
    <YStack flex={1} items="center" justify="center" bg="$background" gap="$3">
      <Text fontSize="$8" fontWeight="bold">
        Bikalpo
      </Text>

      {session?.user ? (
        <>
          <Text fontSize="$4" color="$gray10">
            Welcome, {session.user.name}!
          </Text>
          <Text fontSize="$3" color="$gray10">
            {session.user.email}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.signOutButton, pressed && { opacity: 0.8 }]}
            onPress={() => authClient.signOut()}
          >
            <Text fontSize="$4" fontWeight="600" color="#DC2626">
              Sign Out
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text fontSize="$4" color="$gray10">
            Browse products or sign in
          </Text>
          <Pressable
            style={({ pressed }) => [styles.signInButton, pressed && { opacity: 0.85 }]}
            onPress={() => router.push("/login")}
          >
            <Text fontSize="$4" fontWeight="bold" color="#fff">
              Sign in
            </Text>
          </Pressable>
        </>
      )}
    </YStack>
  );
}

const styles = StyleSheet.create({
  signInButton: {
    backgroundColor: "#F5A623",
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 30,
    marginTop: 8,
  },
  signOutButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#DC2626",
    marginTop: 8,
  },
});
