import { useState, useRef, useEffect } from "react";
import {
  View,
  ScrollView,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Text } from "tamagui";
import { Stack, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { orpc, client } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  open: { color: "#F5A623", bg: "#FFF5E6", label: "Open" },
  in_progress: { color: "#2196F3", bg: "#E3F2FD", label: "In Progress" },
  resolved: { color: "#4CAF50", bg: "#E8F5E9", label: "Resolved" },
  closed: { color: "#8E8E93", bg: "#F5F5F5", label: "Closed" },
};

export default function TicketDetailScreen() {
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>();
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);
  const [replyText, setReplyText] = useState("");
  const { data: session } = authClient.useSession();

  const ticketQuery = useQuery(
    orpc.customer.getTicketDetails.queryOptions({
      input: { ticketId: Number(ticketId) },
    }),
  );

  const replyMutation = useMutation({
    mutationFn: () =>
      client.customer.addTicketReply({
        ticketId: Number(ticketId),
        message: replyText,
      }),
    onSuccess: () => {
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["customer"] });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
    },
  });

  const ticket = ticketQuery.data?.ticket;
  const replies = ticket?.replies ?? [];

  if (ticketQuery.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F5A623" />
      </View>
    );
  }

  if (!ticket) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Ticket" }} />
        <View style={styles.emptyState}>
          <Text fontSize="$4" color="#8E8E93">Ticket not found</Text>
        </View>
      </>
    );
  }

  const status = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
  const canReply = ticket.status !== "closed";

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: ticket.ticketNumber,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "#fff" },
        }}
      />
      <KeyboardAvoidingView
        style={styles.wrapper}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* Ticket Info */}
          <View style={styles.ticketInfo}>
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <Text fontSize="$3" fontWeight="bold" color={status.color}>
                {status.label}
              </Text>
            </View>
            <Text fontSize="$5" fontWeight="bold" color="#1A1A2E" mt="$2">
              {ticket.subject}
            </Text>
            <Text fontSize="$2" color="#8E8E93" mt="$1">
              {new Date(ticket.createdAt).toLocaleDateString("en-BD", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </Text>
          </View>

          {/* Original Message */}
          <View style={styles.messageSection}>
            <View style={[styles.messageBubble, styles.userBubble]}>
              <Text fontSize="$2" color="#F5A623" fontWeight="600" mb="$1">
                You
              </Text>
              <Text fontSize="$3" color="#1A1A2E">
                {ticket.message}
              </Text>
            </View>

            {/* Replies */}
            {replies.map((reply) => {
              const isStaff = reply.isStaffReply;
              return (
                <View
                  key={reply.id}
                  style={[
                    styles.messageBubble,
                    isStaff ? styles.staffBubble : styles.userBubble,
                  ]}
                >
                  <Text
                    fontSize="$2"
                    color={isStaff ? "#2196F3" : "#F5A623"}
                    fontWeight="600"
                    mb="$1"
                  >
                    {isStaff ? (reply.user?.name ?? "Support") : "You"}
                  </Text>
                  <Text fontSize="$3" color="#1A1A2E">
                    {reply.message}
                  </Text>
                  <Text fontSize={10} color="#C7C7CC" mt="$1">
                    {new Date(reply.createdAt).toLocaleString("en-BD", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Reply Input */}
        {canReply && (
          <View style={styles.replyBar}>
            <TextInput
              style={styles.replyInput}
              value={replyText}
              onChangeText={setReplyText}
              placeholder="Type your reply..."
              placeholderTextColor="#C7C7CC"
              multiline
            />
            <Pressable
              style={({ pressed }) => [
                styles.sendButton,
                (!replyText.trim() || replyMutation.isPending) && { opacity: 0.4 },
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => replyMutation.mutate()}
              disabled={!replyText.trim() || replyMutation.isPending}
            >
              {replyMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#F8F8F8" },
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  ticketInfo: {
    backgroundColor: "#fff",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    alignItems: "flex-start",
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
  },
  messageSection: {
    padding: 16,
    gap: 12,
  },
  messageBubble: {
    padding: 14,
    borderRadius: 14,
    maxWidth: "85%",
  },
  userBubble: {
    backgroundColor: "#FFF9F0",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: "#FFE8C0",
  },
  staffBubble: {
    backgroundColor: "#E3F2FD",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#BBDEFB",
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#fff",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    gap: 10,
  },
  replyInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1A1A2E",
    backgroundColor: "#FAFAFA",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5A623",
    justifyContent: "center",
    alignItems: "center",
  },
});
