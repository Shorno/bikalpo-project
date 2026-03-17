import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Text } from "tamagui";
import { router, Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { orpc } from "@/utils/orpc";

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: "#F5A623", bg: "#FFF5E6", label: "Pending" },
  confirmed: { color: "#2196F3", bg: "#E3F2FD", label: "Confirmed" },
  processing: { color: "#9C27B0", bg: "#F3E5F5", label: "Processing" },
  shipped: { color: "#00BCD4", bg: "#E0F7FA", label: "Shipped" },
  delivered: { color: "#4CAF50", bg: "#E8F5E9", label: "Delivered" },
  cancelled: { color: "#DC2626", bg: "#FEF2F2", label: "Cancelled" },
};

export default function OrdersScreen() {
  const ordersQuery = useQuery(orpc.customer.getMyOrders.queryOptions());
  const orders = ordersQuery.data?.orders ?? [];

  if (ordersQuery.isLoading) {
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
          title: "My Orders",
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "#fff" },
        }}
      />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color="#D8D8D8" />
            <Text fontSize="$5" fontWeight="bold" color="#1A1A2E" mt="$3">
              No orders yet
            </Text>
            <Text fontSize="$3" color="#8E8E93" mt="$1">
              Your orders will appear here
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {orders.map((order) => {
              const status = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
              const date = new Date(order.createdAt).toLocaleDateString("en-BD", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });

              return (
                <Pressable
                  key={order.id}
                  style={({ pressed }) => [
                    styles.orderCard,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: "/account/order-detail",
                      params: { orderNumber: order.orderNumber },
                    })
                  }
                >
                  <View style={styles.orderHeader}>
                    <Text fontSize="$4" fontWeight="bold" color="#1A1A2E">
                      {order.orderNumber}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                      <Text fontSize={11} fontWeight="bold" color={status.color}>
                        {status.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.orderInfo}>
                    <View style={styles.infoRow}>
                      <Ionicons name="calendar-outline" size={14} color="#8E8E93" />
                      <Text fontSize="$2" color="#8E8E93" ml="$1">
                        {date}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Ionicons name="cube-outline" size={14} color="#8E8E93" />
                      <Text fontSize="$2" color="#8E8E93" ml="$1">
                        {order.items?.length ?? 0} items
                      </Text>
                    </View>
                  </View>

                  <View style={styles.orderFooter}>
                    <Text fontSize="$5" fontWeight="bold" color="#1A1A2E">
                      ৳{order.total}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        <View style={{ height: 30 }} />
      </ScrollView>
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
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 120,
  },
  list: { padding: 16, gap: 12 },
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  orderInfo: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F5F5F5",
    paddingTop: 12,
  },
});
