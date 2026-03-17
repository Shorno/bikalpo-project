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
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "@/utils/orpc";

export default function CreateTicketScreen() {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");

  const createMutation = useMutation({
    mutationFn: () =>
      client.customer.createSupportTicket({ subject, message, priority }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer"] });
      Alert.alert("Success", "Support ticket created!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.message || "Failed to create ticket");
    },
  });

  const isFormValid = subject.trim().length > 0 && message.trim().length > 0;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "New Ticket",
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
          {/* Priority */}
          <View>
            <Text fontSize="$3" fontWeight="600" color="#1A1A2E" mb="$2">
              Priority
            </Text>
            <View style={styles.priorityRow}>
              {(["low", "medium", "high"] as const).map((p) => (
                <Pressable
                  key={p}
                  style={[
                    styles.priorityChip,
                    priority === p && styles.priorityChipActive,
                    priority === p && p === "high" && { backgroundColor: "#DC2626", borderColor: "#DC2626" },
                    priority === p && p === "low" && { backgroundColor: "#8E8E93", borderColor: "#8E8E93" },
                  ]}
                  onPress={() => setPriority(p)}
                >
                  <Text
                    fontSize="$3"
                    fontWeight={priority === p ? "bold" : "400"}
                    color={priority === p ? "#fff" : "#1A1A2E"}
                    style={{ textTransform: "capitalize" }}
                  >
                    {p}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Subject */}
          <View>
            <Text fontSize="$3" fontWeight="600" color="#1A1A2E" mb="$1">
              Subject
            </Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="Brief description of your issue"
              placeholderTextColor="#C7C7CC"
              maxLength={200}
            />
          </View>

          {/* Message */}
          <View>
            <Text fontSize="$3" fontWeight="600" color="#1A1A2E" mb="$1">
              Message
            </Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={message}
              onChangeText={setMessage}
              placeholder="Describe your issue in detail..."
              placeholderTextColor="#C7C7CC"
              multiline
              numberOfLines={6}
            />
          </View>

          {/* Submit */}
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              !isFormValid && styles.submitButtonDisabled,
              pressed && isFormValid && { opacity: 0.85 },
            ]}
            onPress={() => createMutation.mutate()}
            disabled={!isFormValid || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text fontSize="$4" fontWeight="bold" color="#fff">
                Submit Ticket
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
  priorityRow: {
    flexDirection: "row",
    gap: 10,
  },
  priorityChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#F0F0F0",
    alignItems: "center",
  },
  priorityChipActive: {
    backgroundColor: "#F5A623",
    borderColor: "#F5A623",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1A1A2E",
    backgroundColor: "#FAFAFA",
  },
  inputMultiline: {
    minHeight: 140,
    textAlignVertical: "top",
  },
  submitButton: {
    backgroundColor: "#F5A623",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
});
