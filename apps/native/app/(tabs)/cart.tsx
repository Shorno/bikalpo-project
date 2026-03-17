import { View, StyleSheet } from "react-native";
import { Text } from "tamagui";
import { Ionicons } from "@expo/vector-icons";

export default function CartScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text fontSize="$7" fontWeight="bold" color="#1A1A2E">
          Cart
        </Text>
      </View>

      <View style={styles.emptyState}>
        <Ionicons name="cart-outline" size={64} color="#D8D8D8" />
        <Text fontSize="$5" fontWeight="bold" color="#1A1A2E" mt="$3">
          Your cart is empty
        </Text>
        <Text fontSize="$3" color="#8E8E93" mt="$1">
          Browse products and add items to your cart
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 160,
  },
});
