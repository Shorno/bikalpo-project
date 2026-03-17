import { useState } from "react";
import {
  View,
  ScrollView,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Text } from "tamagui";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { authClient } from "@/lib/auth-client";

export default function ChangePasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordsMatch = newPassword === confirmPassword;
  const isFormValid =
    currentPassword.length >= 1 &&
    newPassword.length >= 8 &&
    confirmPassword.length >= 1 &&
    passwordsMatch;

  async function handleChangePassword() {
    if (!isFormValid) return;
    setLoading(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });

      if (result.error) {
        Alert.alert("Error", result.error.message || "Failed to change password");
      } else {
        Alert.alert("Success", "Password changed successfully!", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Change Password",
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "#fff" },
        }}
      />
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          {/* Current Password */}
          <View style={styles.inputGroup}>
            <Text fontSize="$3" fontWeight="600" color="#1A1A2E" mb="$1">
              Current Password
            </Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor="#C7C7CC"
                secureTextEntry={!showCurrent}
              />
              <Pressable
                style={styles.eyeIcon}
                onPress={() => setShowCurrent(!showCurrent)}
              >
                <Ionicons
                  name={showCurrent ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#8E8E93"
                />
              </Pressable>
            </View>
          </View>

          {/* New Password */}
          <View style={styles.inputGroup}>
            <Text fontSize="$3" fontWeight="600" color="#1A1A2E" mb="$1">
              New Password
            </Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Min 8 characters"
                placeholderTextColor="#C7C7CC"
                secureTextEntry={!showNew}
              />
              <Pressable
                style={styles.eyeIcon}
                onPress={() => setShowNew(!showNew)}
              >
                <Ionicons
                  name={showNew ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#8E8E93"
                />
              </Pressable>
            </View>
            {newPassword.length > 0 && newPassword.length < 8 && (
              <Text fontSize="$2" color="#DC2626" mt="$1">
                Password must be at least 8 characters
              </Text>
            )}
          </View>

          {/* Confirm Password */}
          <View style={styles.inputGroup}>
            <Text fontSize="$3" fontWeight="600" color="#1A1A2E" mb="$1">
              Confirm New Password
            </Text>
            <TextInput
              style={styles.inputPlain}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter new password"
              placeholderTextColor="#C7C7CC"
              secureTextEntry
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <Text fontSize="$2" color="#DC2626" mt="$1">
                Passwords do not match
              </Text>
            )}
          </View>

          {/* Submit */}
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              !isFormValid && styles.saveButtonDisabled,
              pressed && isFormValid && { opacity: 0.85 },
            ]}
            onPress={handleChangePassword}
            disabled={!isFormValid || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text fontSize="$4" fontWeight="bold" color="#fff">
                Update Password
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  form: { padding: 20, gap: 20 },
  inputGroup: {},
  inputWrapper: {
    position: "relative",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingRight: 44,
    fontSize: 14,
    color: "#1A1A2E",
    backgroundColor: "#FAFAFA",
  },
  inputPlain: {
    borderWidth: 1,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1A1A2E",
    backgroundColor: "#FAFAFA",
  },
  eyeIcon: {
    position: "absolute",
    right: 12,
    top: 12,
    padding: 2,
  },
  saveButton: {
    backgroundColor: "#F5A623",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
});
