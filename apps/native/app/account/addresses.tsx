import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator, Alert } from "react-native";
import { Text } from "tamagui";
import { Stack, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { orpc, client } from "@/utils/orpc";

export default function AddressesScreen() {
  const queryClient = useQueryClient();
  const addressesQuery = useQuery(orpc.customer.getMyAddresses.queryOptions());
  const addresses = addressesQuery.data?.addresses ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: number) => client.customer.deleteAddress({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer"] });
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.message || "Failed to delete address");
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: number) => client.customer.setDefaultAddress({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer"] });
    },
  });

  function handleDelete(id: number) {
    Alert.alert("Delete Address", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteMutation.mutate(id),
      },
    ]);
  }

  if (addressesQuery.isLoading) {
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
          title: "Delivery Addresses",
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "#fff" },
        }}
      />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {addresses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="location-outline" size={64} color="#D8D8D8" />
            <Text fontSize="$5" fontWeight="bold" color="#1A1A2E" mt="$3">
              No addresses yet
            </Text>
            <Text fontSize="$3" color="#8E8E93" mt="$1">
              Add a delivery address to get started
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {addresses.map((addr) => (
              <View key={addr.id} style={styles.addressCard}>
                <View style={styles.addressHeader}>
                  <View style={styles.labelRow}>
                    <Ionicons
                      name={addr.label === "Home" ? "home-outline" : "business-outline"}
                      size={18}
                      color="#F5A623"
                    />
                    <Text fontSize="$4" fontWeight="bold" color="#1A1A2E" ml="$2">
                      {addr.label}
                    </Text>
                    {addr.isDefault && (
                      <View style={styles.defaultBadge}>
                        <Text fontSize={10} fontWeight="bold" color="#4CAF50">
                          Default
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.actionButtons}>
                    <Pressable
                      style={styles.iconBtn}
                      onPress={() =>
                        router.push({
                          pathname: "/account/address-form",
                          params: { addressId: addr.id.toString() },
                        })
                      }
                    >
                      <Ionicons name="create-outline" size={18} color="#8E8E93" />
                    </Pressable>
                    <Pressable
                      style={styles.iconBtn}
                      onPress={() => handleDelete(addr.id)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#DC2626" />
                    </Pressable>
                  </View>
                </View>

                <Text fontSize="$3" color="#1A1A2E" mt="$1">
                  {addr.recipientName}
                </Text>
                <Text fontSize="$2" color="#8E8E93" mt="$1">
                  {addr.phone}
                </Text>
                <Text fontSize="$2" color="#8E8E93" mt="$1" numberOfLines={2}>
                  {addr.address}, {addr.city}
                  {addr.area ? `, ${addr.area}` : ""}
                  {addr.postalCode ? ` - ${addr.postalCode}` : ""}
                </Text>

                {!addr.isDefault && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.setDefaultBtn,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => setDefaultMutation.mutate(addr.id)}
                  >
                    <Text fontSize="$2" color="#F5A623" fontWeight="600">
                      Set as default
                    </Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Floating Add Button */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
        onPress={() => router.push("/account/address-form")}
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
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 120,
  },
  list: { padding: 16, gap: 12 },
  addressCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  addressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  defaultBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 6,
  },
  iconBtn: {
    padding: 6,
  },
  setDefaultBtn: {
    marginTop: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
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
