import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Text } from "tamagui";
import { Stack, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { orpc } from "@/utils/orpc";

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  open: { color: "#F5A623", bg: "#FFF5E6", label: "Open" },
  in_progress: { color: "#2196F3", bg: "#E3F2FD", label: "In Progress" },
  resolved: { color: "#4CAF50", bg: "#E8F5E9", label: "Resolved" },
  closed: { color: "#8E8E93", bg: "#F5F5F5", label: "Closed" },
};

const PRIORITY_CONFIG: Record<string, { color: string }> = {
  low: { color: "#8E8E93" },
  medium: { color: "#F5A623" },
  high: { color: "#DC2626" },
};

export default function SupportTicketsScreen() {
  const ticketsQuery = useQuery(orpc.customer.getCustomerTickets.queryOptions());
  const tickets = ticketsQuery.data?.tickets ?? [];

  if (ticketsQuery.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F5A623" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Support Tickets",
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "#fff" },
        }}
      />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {tickets.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-outline" size={64} color="#D8D8D8" />
            <Text fontSize="$5" fontWeight="bold" color="#1A1A2E" mt="$3">
              No tickets yet
            </Text>
            <Text fontSize="$3" color="#8E8E93" mt="$1">
              Need help? Create a support ticket
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {tickets.map((ticket) => {
              const status = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
              const priority = PRIORITY_CONFIG[ticket.priority] ?? PRIORITY_CONFIG.medium;
              const date = new Date(ticket.createdAt).toLocaleDateString("en-BD", {
                day: "numeric",
                month: "short",
              });

              return (
                <Pressable
                  key={ticket.id}
                  style={({ pressed }) => [
                    styles.ticketCard,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: "/account/ticket-detail",
                      params: { ticketId: ticket.id.toString() },
                    })
                  }
                >
                  <View style={styles.ticketHeader}>
                    <Text fontSize="$2" color="#8E8E93">
                      {ticket.ticketNumber}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                      <Text fontSize={11} fontWeight="bold" color={status.color}>
                        {status.label}
                      </Text>
                    </View>
                  </View>
                  <Text fontSize="$4" fontWeight="600" color="#1A1A2E" numberOfLines={2} mt="$1">
                    {ticket.subject}
                  </Text>
                  <View style={styles.ticketFooter}>
                    <View style={styles.infoRow}>
                      <Ionicons name="flag-outline" size={14} color={priority.color} />
                      <Text fontSize="$2" color={priority.color} ml="$1" style={{ textTransform: "capitalize" }}>
                        {ticket.priority}
                      </Text>
                    </View>
                    <Text fontSize="$2" color="#8E8E93">{date}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Floating Create Button */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
        onPress={() => router.push("/account/create-ticket")}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F8F8" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  emptyState: {
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 120,
  },
  list: { padding: 16, gap: 12 },
  ticketCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  ticketFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F5A623",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});
