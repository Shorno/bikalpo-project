import { View, StyleSheet, Pressable } from "react-native";
import { Text } from "tamagui";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { authClient } from "@/lib/auth-client";

export default function AccountScreen() {
  const { data: session } = authClient.useSession();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text fontSize="$7" fontWeight="bold" color="#1A1A2E">
          Account
        </Text>
      </View>

      {session?.user ? (
        <View style={styles.content}>
          {/* User Info */}
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text fontSize="$7" fontWeight="bold" color="#F5A623">
                {session.user.name?.charAt(0)?.toUpperCase() ?? "U"}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text fontSize="$5" fontWeight="bold" color="#1A1A2E">
                {session.user.name}
              </Text>
              <Text fontSize="$3" color="#8E8E93">
                {session.user.email}
              </Text>
            </View>
          </View>

          {/* Menu Items */}
          <View style={styles.menuSection}>
            <MenuItem icon="receipt-outline" label="My Orders" />
            <MenuItem icon="heart-outline" label="Wishlist" />
            <MenuItem icon="location-outline" label="Delivery Address" />
            <MenuItem icon="card-outline" label="Payment Methods" />
            <MenuItem icon="settings-outline" label="Settings" />
          </View>

          {/* Sign Out */}
          <Pressable
            style={({ pressed }) => [styles.signOutButton, pressed && { opacity: 0.8 }]}
            onPress={() => authClient.signOut()}
          >
            <Ionicons name="log-out-outline" size={20} color="#DC2626" />
            <Text fontSize="$4" fontWeight="600" color="#DC2626" ml="$2">
              Sign Out
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.guestContent}>
          <Ionicons name="person-circle-outline" size={80} color="#D8D8D8" />
          <Text fontSize="$5" fontWeight="bold" color="#1A1A2E" mt="$3">
            Welcome to Bikalpo
          </Text>
          <Text fontSize="$3" color="#8E8E93" mt="$1">
            Sign in to access your account
          </Text>
          <Pressable
            style={({ pressed }) => [styles.signInButton, pressed && { opacity: 0.85 }]}
            onPress={() => router.push("/login")}
          >
            <Text fontSize="$4" fontWeight="bold" color="#fff">
              Sign in
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.registerButton, pressed && { opacity: 0.85 }]}
            onPress={() => router.push("/register")}
          >
            <Text fontSize="$4" fontWeight="600" color="#F5A623">
              Create Account
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function MenuItem({ icon, label }: { icon: string; label: string }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: "#F8F8F8" }]}
    >
      <View style={styles.menuItemLeft}>
        <Ionicons name={icon as any} size={22} color="#1A1A2E" />
        <Text fontSize="$4" color="#1A1A2E" ml="$3">
          {label}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
    </Pressable>
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF9F0",
    borderRadius: 16,
    padding: 16,
    gap: 14,
    marginBottom: 24,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFF0D4",
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  menuSection: {
    gap: 2,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    marginTop: 32,
  },
  guestContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingBottom: 100,
  },
  signInButton: {
    backgroundColor: "#F5A623",
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 30,
    marginTop: 24,
    width: "100%",
    alignItems: "center",
  },
  registerButton: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#F5A623",
    marginTop: 12,
    width: "100%",
    alignItems: "center",
  },
});
