import { useMemo } from "react";
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Text } from "tamagui";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export default function AccountScreen() {
  const { data: session } = authClient.useSession();
  const isLoggedIn = !!session?.user;

  // Only query when logged in
  const ordersQuery = useQuery({
    ...orpc.customer.getMyOrders.queryOptions(),
    enabled: isLoggedIn,
  });

  const profileQuery = useQuery({
    ...orpc.customer.getProfile.queryOptions(),
    enabled: isLoggedIn,
  });

  const announcementsQuery = useQuery(
    orpc.customer.getAnnouncements.queryOptions(),
  );

  // Order status counts
  const orderCounts = useMemo(() => {
    const orders = ordersQuery.data?.orders ?? [];
    return {
      toPay: orders.filter((o) => o.status === "pending").length,
      toReceive: orders.filter((o) =>
        ["confirmed", "processing", "shipped"].includes(o.status),
      ).length,
      toReview: orders.filter((o) => o.status === "delivered").length,
      total: orders.length,
    };
  }, [ordersQuery.data]);

  const profile = profileQuery.data?.profile;
  const announcements = announcementsQuery.data?.announcements ?? [];

  if (!isLoggedIn) {
    return <GuestView />;
  }

  return (
    <View style={styles.container}>
      {/* Sticky Header */}
      <View style={styles.header}>
        <Text fontSize="$7" fontWeight="bold" color="#1A1A2E">
          Profile
        </Text>
        <Pressable style={styles.settingsIcon}>
          <Ionicons name="settings-outline" size={22} color="#1A1A2E" />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text fontSize="$8" fontWeight="bold" color="#F5A623">
            {session.user.name?.charAt(0)?.toUpperCase() ?? "U"}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text fontSize="$6" fontWeight="bold" color="#1A1A2E">
            Hello, {profile?.name ?? session.user.name}!
          </Text>
          <Text fontSize="$3" color="#8E8E93">
            {profile?.email ?? session.user.email}
          </Text>
          {profile?.phoneNumber && (
            <Text fontSize="$2" color="#8E8E93">
              {profile.phoneNumber}
            </Text>
          )}
        </View>
      </View>

      {/* Announcement Card */}
      {announcements.length > 0 && (
        <View style={styles.section}>
          <View style={styles.announcementCard}>
            <View style={styles.announcementContent}>
              <Text fontSize="$4" fontWeight="bold" color="#1A1A2E">
                📢 {announcements[0].title}
              </Text>
              <Text fontSize="$2" color="#8E8E93" numberOfLines={2} mt="$1">
                {announcements[0].content}
              </Text>
            </View>
            <Ionicons name="arrow-forward-circle" size={28} color="#F5A623" />
          </View>
        </View>
      )}

      {/* My Orders */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text fontSize="$5" fontWeight="bold" color="#1A1A2E">
            My Orders
          </Text>
          {orderCounts.total > 0 && (
            <Pressable onPress={() => router.push("/account/orders")}>
              <Text fontSize="$3" color="#F5A623" fontWeight="600">
                View all
              </Text>
            </Pressable>
          )}
        </View>
        <View style={styles.orderChips}>
          <OrderChip
            label="To Pay"
            count={orderCounts.toPay}
            icon="wallet-outline"
            onPress={() => router.push("/account/orders")}
          />
          <OrderChip
            label="To Receive"
            count={orderCounts.toReceive}
            icon="cube-outline"
            onPress={() => router.push("/account/orders")}
          />
          <OrderChip
            label="To Review"
            count={orderCounts.toReview}
            icon="star-outline"
            onPress={() => router.push("/account/orders")}
          />
        </View>
      </View>

      {/* General */}
      <View style={styles.menuGroup}>
        <Text fontSize="$3" fontWeight="bold" color="#8E8E93" mb="$2" ml="$1">
          General
        </Text>
        <View style={styles.menuCard}>
          <MenuItem
            icon="person-outline"
            label="Account Information"
            subtitle="View and edit your profile"
            onPress={() => router.push("/account/edit-profile")}
          />
          <MenuItem
            icon="location-outline"
            label="Delivery Addresses"
            subtitle="Manage your delivery locations"
            onPress={() => router.push("/account/addresses")}
          />
          <MenuItem
            icon="card-outline"
            label="Payment Methods"
            subtitle="Add or remove payment cards"
          />
          <MenuItem
            icon="lock-closed-outline"
            label="Change Password"
            subtitle="Update your account password"
            onPress={() => router.push("/account/change-password")}
          />
        </View>
      </View>

      {/* Support */}
      <View style={styles.menuGroup}>
        <Text fontSize="$3" fontWeight="bold" color="#8E8E93" mb="$2" ml="$1">
          Support
        </Text>
        <View style={styles.menuCard}>
          <MenuItem
            icon="chatbubble-outline"
            label="Support Tickets"
            subtitle="Get help with your orders"
            onPress={() => router.push("/account/tickets")}
          />
          <MenuItem
            icon="help-circle-outline"
            label="FAQ"
            subtitle="Frequently asked questions"
            onPress={() => router.push("/account/faq")}
          />
          <MenuItem
            icon="megaphone-outline"
            label="Announcements"
            subtitle="Latest news and updates"
            badge={announcements.length > 0 ? announcements.length : undefined}
          />
        </View>
      </View>

      {/* More */}
      <View style={styles.menuGroup}>
        <Text fontSize="$3" fontWeight="bold" color="#8E8E93" mb="$2" ml="$1">
          More
        </Text>
        <View style={styles.menuCard}>
          <MenuItem
            icon="star-outline"
            label="Rate Us"
            subtitle="Share your feedback"
          />
          <MenuItem
            icon="share-social-outline"
            label="Invite Friends"
            subtitle="Spread the word!"
          />
        </View>
      </View>

      {/* Sign Out */}
      <View style={styles.section}>
        <Pressable
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => authClient.signOut()}
        >
          <Ionicons name="log-out-outline" size={20} color="#DC2626" />
          <Text fontSize="$4" fontWeight="600" color="#DC2626" ml="$2">
            Sign Out
          </Text>
        </Pressable>
      </View>

      <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function OrderChip({
  label,
  count,
  icon,
  onPress,
}: {
  label: string;
  count: number;
  icon: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.orderChip,
        pressed && { opacity: 0.8 },
      ]}
      onPress={onPress}
    >
      <View style={styles.orderChipIconWrapper}>
        <Ionicons name={icon as any} size={20} color="#F5A623" />
        {count > 0 && (
          <View style={styles.badge}>
            <Text fontSize={9} fontWeight="bold" color="#fff">
              {count}
            </Text>
          </View>
        )}
      </View>
      <Text fontSize="$2" color="#1A1A2E" mt="$1">
        {label}
      </Text>
    </Pressable>
  );
}

function MenuItem({
  icon,
  label,
  subtitle,
  badge,
  onPress,
}: {
  icon: string;
  label: string;
  subtitle: string;
  badge?: number;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuItem,
        pressed && { backgroundColor: "#FAFAFA" },
      ]}
      onPress={onPress}
    >
      <View style={styles.menuItemIcon}>
        <Ionicons name={icon as any} size={20} color="#F5A623" />
      </View>
      <View style={styles.menuItemContent}>
        <Text fontSize="$4" fontWeight="600" color="#1A1A2E">
          {label}
        </Text>
        <Text fontSize="$2" color="#8E8E93">
          {subtitle}
        </Text>
      </View>
      <View style={styles.menuItemRight}>
        {badge !== undefined && (
          <View style={styles.menuBadge}>
            <Text fontSize={10} fontWeight="bold" color="#fff">
              {badge}
            </Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
      </View>
    </Pressable>
  );
}

function GuestView() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text fontSize="$7" fontWeight="bold" color="#1A1A2E">
          Account
        </Text>
      </View>
      <View style={styles.guestContent}>
        <Ionicons name="person-circle-outline" size={80} color="#D8D8D8" />
        <Text fontSize="$5" fontWeight="bold" color="#1A1A2E" mt="$3">
          Welcome to Bikalpo
        </Text>
        <Text fontSize="$3" color="#8E8E93" mt="$1">
          Sign in to access your account
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.signInButton,
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => router.push("/login")}
        >
          <Text fontSize="$4" fontWeight="bold" color="#fff">
            Sign in
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.registerButton,
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => router.push("/register")}
        >
          <Text fontSize="$4" fontWeight="600" color="#F5A623">
            Create Account
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F8F8",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: "#fff",
  },
  settingsIcon: {
    padding: 4,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    marginBottom: 8,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FFF0D4",
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
  },
  announcementCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF9F0",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FFE8C0",
  },
  announcementContent: {
    flex: 1,
    marginRight: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  orderChips: {
    flexDirection: "row",
    gap: 12,
  },
  orderChip: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  orderChipIconWrapper: {
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -10,
    backgroundColor: "#F5A623",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  menuGroup: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  menuCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  menuItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFF5E6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  menuItemContent: {
    flex: 1,
    gap: 1,
  },
  menuItemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  menuBadge: {
    backgroundColor: "#F5A623",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
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
    marginTop: 16,
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
