import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { TamaguiProvider } from "tamagui";
import * as SecureStore from "expo-secure-store";

import { queryClient } from "@/utils/orpc";
import { tamaguiConfig } from "../tamagui.config";

SplashScreen.preventAutoHideAsync();

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
});

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [fontsLoaded] = useFonts({
    Inter: require("@tamagui/font-inter/otf/Inter-Medium.otf"),
    InterBold: require("@tamagui/font-inter/otf/Inter-Bold.otf"),
  });

  useEffect(() => {
    async function checkOnboarding() {
      const completed = await SecureStore.getItemAsync("onboarding_completed");
      setShowOnboarding(completed !== "true");
      setIsReady(true);
    }
    checkOnboarding();
  }, []);

  useEffect(() => {
    if (fontsLoaded && isReady) {
      SplashScreen.hideAsync();
      if (showOnboarding) {
        router.replace("/onboarding");
      }
    }
  }, [fontsLoaded, isReady, showOnboarding]);

  if (!fontsLoaded || !isReady) {
    return null;
  }

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <GestureHandlerRootView style={styles.container}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#fff" },
              animation: "fade",
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="login" />
            <Stack.Screen name="register" />
            <Stack.Screen name="account/orders" />
            <Stack.Screen name="account/order-detail" />
            <Stack.Screen name="account/addresses" />
            <Stack.Screen name="account/address-form" />
            <Stack.Screen name="account/edit-profile" />
            <Stack.Screen name="account/tickets" />
            <Stack.Screen name="account/ticket-detail" />
            <Stack.Screen name="account/create-ticket" />
            <Stack.Screen name="account/faq" />
            <Stack.Screen name="account/change-password" />
          </Stack>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </TamaguiProvider>
  );
}
