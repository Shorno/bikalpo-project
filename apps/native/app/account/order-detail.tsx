import { useState } from "react";
import {
  View,
  ScrollView,
  Image,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Text } from "tamagui";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { orpc, client } from "@/utils/orpc";

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: "#F5A623", bg: "#FFF5E6", label: "Pending" },
  confirmed: { color: "#2196F3", bg: "#E3F2FD", label: "Confirmed" },
  processing: { color: "#9C27B0", bg: "#F3E5F5", label: "Processing" },
  shipped: { color: "#00BCD4", bg: "#E0F7FA", label: "Shipped" },
  delivered: { color: "#4CAF50", bg: "#E8F5E9", label: "Delivered" },
  cancelled: { color: "#DC2626", bg: "#FEF2F2", label: "Cancelled" },
};

export default function OrderDetailScreen() {
  const { orderNumber } = useLocalSearchParams<{ orderNumber: string }>();
  const queryClient = useQueryClient();

  const orderQuery = useQuery(
    orpc.customer.getOrderByNumber.queryOptions({
      input: { orderNumber: orderNumber ?? "" },
    }),
  );

  const cancelMutation = useMutation({
    mutationFn: (orderId: number) => client.customer.cancelOrder({ orderId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer"] });
      Alert.alert("Success", "Order cancelled successfully");
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.message || "Failed to cancel order");
    },
  });

  const orderData = orderQuery.data?.order;
  const deliveryInfo = orderQuery.data?.deliveryInfo;

  if (orderQuery.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F5A623" />
      </View>
    );
  }

  if (!orderData) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Order Detail" }} />
        <View style={styles.emptyState}>
          <Text fontSize="$4" color="#8E8E93">
            Order not found
          </Text>
        </View>
      </>
    );
  }

  const status = STATUS_CONFIG[orderData.status] ?? STATUS_CONFIG.pending;
  const canCancel = orderData.status === "pending";
  const date = new Date(orderData.createdAt).toLocaleDateString("en-BD", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  function handleCancel() {
    Alert.alert(
      "Cancel Order",
      "Are you sure you want to cancel this order?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: () => cancelMutation.mutate(orderData.id),
        },
      ],
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: orderData.orderNumber,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "#fff" },
        }}
      />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={[styles.statusBadgeLarge, { backgroundColor: status.bg }]}>
            <Text fontSize="$4" fontWeight="bold" color={status.color}>
              {status.label}
            </Text>
          </View>
          <Text fontSize="$2" color="#8E8E93" mt="$2">
            {date}
          </Text>
          {deliveryInfo && (
            <Text fontSize="$3" color="#1A1A2E" mt="$1">
              Delivery: {deliveryInfo.status.replace(/_/g, " ")}
            </Text>
          )}
        </View>

        {/* Items */}
        <View style={styles.section}>
          <Text fontSize="$4" fontWeight="bold" color="#1A1A2E" mb="$3">
            Items ({orderData.items?.length ?? 0})
          </Text>
          {orderData.items?.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Image
                source={{ uri: item.productImage }}
                style={styles.itemImage}
                resizeMode="cover"
              />
              <View style={styles.itemInfo}>
                <Text fontSize="$3" fontWeight="600" color="#1A1A2E" numberOfLines={2}>
                  {item.productName}
                </Text>
                <Text fontSize="$2" color="#8E8E93">
                  {item.productSize} × {item.quantity}
                </Text>
              </View>
              <Text fontSize="$3" fontWeight="bold" color="#1A1A2E">
                ৳{item.totalPrice}
              </Text>
            </View>
          ))}
        </View>

        {/* Shipping Info */}
        <View style={styles.section}>
          <Text fontSize="$4" fontWeight="bold" color="#1A1A2E" mb="$3">
            Shipping Information
          </Text>
          <InfoRow icon="person-outline" label={orderData.shippingName} />
          <InfoRow icon="call-outline" label={orderData.shippingPhone} />
          <InfoRow
            icon="location-outline"
            label={`${orderData.shippingAddress}, ${orderData.shippingCity}${orderData.shippingArea ? `, ${orderData.shippingArea}` : ""}`}
          />
          {orderData.paymentMethod && (
            <InfoRow
              icon="card-outline"
              label={orderData.paymentMethod.replace(/_/g, " ").toUpperCase()}
            />
          )}
        </View>

        {/* Pricing */}
        <View style={styles.section}>
          <View style={styles.priceRow}>
            <Text fontSize="$3" color="#8E8E93">Subtotal</Text>
            <Text fontSize="$3" color="#1A1A2E">৳{orderData.subtotal}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text fontSize="$3" color="#8E8E93">Shipping</Text>
            <Text fontSize="$3" color="#1A1A2E">৳{orderData.shippingCost}</Text>
          </View>
          {Number(orderData.discount) > 0 && (
            <View style={styles.priceRow}>
              <Text fontSize="$3" color="#4CAF50">Discount</Text>
              <Text fontSize="$3" color="#4CAF50">-৳{orderData.discount}</Text>
            </View>
          )}
          <View style={[styles.priceRow, styles.totalRow]}>
            <Text fontSize="$5" fontWeight="bold" color="#1A1A2E">Total</Text>
            <Text fontSize="$5" fontWeight="bold" color="#F5A623">৳{orderData.total}</Text>
          </View>
        </View>

        {/* Cancel Button */}
        {canCancel && (
          <View style={styles.section}>
            <Pressable
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && { opacity: 0.8 },
              ]}
              onPress={handleCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <ActivityIndicator color="#DC2626" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
                  <Text fontSize="$4" fontWeight="600" color="#DC2626" ml="$2">
                    Cancel Order
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </>
  );
}

function InfoRow({ icon, label }: { icon: string; label: string | null }) {
  if (!label) return null;
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={16} color="#8E8E93" />
      <Text fontSize="$3" color="#1A1A2E" ml="$2">
        {label}
      </Text>
    </View>
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
  },
  statusCard: {
    backgroundColor: "#fff",
    padding: 20,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  statusBadgeLarge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  section: {
    backgroundColor: "#fff",
    padding: 16,
    marginTop: 8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
    gap: 12,
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#F8F8F8",
  },
  itemInfo: { flex: 1, gap: 2 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    paddingTop: 12,
    marginTop: 6,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
  },
});
