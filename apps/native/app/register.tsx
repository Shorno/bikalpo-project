import { useState } from "react";
import {
  Image,
  Dimensions,
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Text } from "tamagui";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { authClient } from "@/lib/auth-client";

const { width } = Dimensions.get("window");

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSignUp() {
    if (!form.name || !form.email || !form.password) {
      setError("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    setError(null);

    await authClient.signUp.email(
      {
        name: form.name,
        email: form.email,
        password: form.password,
      },
      {
        onError(err) {
          setError(err.error?.message || "Failed to create account");
          setIsLoading(false);
        },
        onSuccess() {
          setForm({ name: "", email: "", password: "" });
          router.replace("/");
        },
        onFinished() {
          setIsLoading(false);
        },
      },
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo Area */}
        <View style={styles.logoContainer}>
          <View style={styles.logoBg}>
            <Image
              source={require("@/assets/images/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Welcome Text */}
        <Text
          fontSize="$8"
          fontWeight="bold"
          color="#1A1A2E"
          text="center"
          mt="$4"
        >
          Create Account
        </Text>
        <Text fontSize="$4" color="#8E8E93" text="center" mt="$2">
          Sign up to get started!
        </Text>
        <Pressable onPress={() => router.back()}>
          <Text fontSize="$4" text="center" mt="$1">
            Already have an account?{" "}
            <Text color="#F5A623" fontWeight="600">
              Sign in
            </Text>
          </Text>
        </Pressable>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text fontSize="$3" color="#DC2626">
              {error}
            </Text>
          </View>
        )}

        {/* Form */}
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#C7C7CC"
              value={form.name}
              onChangeText={(val) => setForm((prev) => ({ ...prev, name: val }))}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#C7C7CC"
              value={form.email}
              onChangeText={(val) => setForm((prev) => ({ ...prev, email: val }))}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#C7C7CC"
              value={form.password}
              onChangeText={(val) =>
                setForm((prev) => ({ ...prev, password: val }))
              }
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <Pressable
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#C7C7CC"
              />
            </Pressable>
          </View>
        </View>

        {/* Sign Up Button */}
        <Pressable
          style={({ pressed }) => [
            styles.signUpButton,
            pressed && styles.buttonPressed,
            isLoading && styles.buttonDisabled,
          ]}
          onPress={handleSignUp}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text fontSize="$5" fontWeight="bold" color="#fff">
              Create Account
            </Text>
          )}
        </Pressable>

        {/* OR Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text fontSize="$3" color="#C7C7CC" mx="$3">
            OR
          </Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social Login Buttons */}
        <Pressable
          style={({ pressed }) => [
            styles.socialButton,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Ionicons name="logo-facebook" size={22} color="#1877F2" />
          <Text fontSize="$4" fontWeight="600" color="#1A1A2E" ml="$3">
            Connect with Facebook
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.socialButton,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Ionicons name="logo-google" size={22} color="#EA4335" />
          <Text fontSize="$4" fontWeight="600" color="#1A1A2E" ml="$3">
            Connect with Google
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 60,
  },
  logoBg: {
    width: width * 0.35,
    height: width * 0.35,
    borderRadius: width * 0.175,
    backgroundColor: "#FFF5E6",
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: width * 0.22,
    height: width * 0.22,
  },
  errorContainer: {
    backgroundColor: "rgba(220, 38, 38, 0.08)",
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  formContainer: {
    marginTop: 28,
    gap: 14,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F8F8",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EFEFEF",
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 18,
    fontSize: 15,
    color: "#1A1A2E",
    fontFamily: "Inter",
  },
  eyeIcon: {
    paddingHorizontal: 16,
  },
  signUpButton: {
    backgroundColor: "#F5A623",
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
    marginTop: 24,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#EFEFEF",
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    backgroundColor: "#FAFAFA",
    marginBottom: 12,
  },
});
