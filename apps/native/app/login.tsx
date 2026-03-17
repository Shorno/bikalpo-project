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

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSignIn() {
    if (!form.email || !form.password) {
      setError("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    setError(null);

    await authClient.signIn.email(
      {
        email: form.email,
        password: form.password,
      },
      {
        onError(err) {
          setError(err.error?.message || "Failed to sign in");
          setIsLoading(false);
        },
        onSuccess() {
          setForm({ email: "", password: "" });
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
          Welcome Back
        </Text>
        <Text fontSize="$4" color="#8E8E93" text="center" mt="$2">
          Hello, sign in to continue!
        </Text>
        <Pressable onPress={() => router.push("/register")}>
          <Text fontSize="$4" text="center" mt="$1">
            Or{" "}
            <Text color="#F5A623" fontWeight="600">
              Create new account
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
              placeholder="Username or Email"
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
              onChangeText={(val) => setForm((prev) => ({ ...prev, password: val }))}
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

        {/* Sign In Button */}
        <Pressable
          style={({ pressed }) => [
            styles.signInButton,
            pressed && styles.buttonPressed,
            isLoading && styles.buttonDisabled,
          ]}
          onPress={handleSignIn}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text fontSize="$5" fontWeight="bold" color="#fff">
              Sign in
            </Text>
          )}
        </Pressable>

        {/* Forgot Password */}
        <Pressable style={styles.forgotPassword}>
          <Text fontSize="$3" color="#F5A623" fontWeight="600">
            Forgot Password?
          </Text>
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
    width: width * 0.45,
    height: width * 0.45,
    borderRadius: width * 0.225,
    backgroundColor: "#FFF5E6",
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: width * 0.3,
    height: width * 0.3,
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
  signInButton: {
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
  forgotPassword: {
    alignItems: "center",
    marginTop: 16,
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
