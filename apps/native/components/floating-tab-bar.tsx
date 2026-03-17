import React, { useEffect } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
} from "react-native";
import { Text } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SPRING_CONFIG = {
  damping: 18,
  stiffness: 200,
  mass: 0.8,
};

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  index: { active: "home", inactive: "home-outline" },
  categories: { active: "grid", inactive: "grid-outline" },
  cart: { active: "cart", inactive: "cart-outline" },
  account: { active: "person", inactive: "person-outline" },
};

const TAB_LABELS: Record<string, string> = {
  index: "Home",
  categories: "Categories",
  cart: "Cart",
  account: "Account",
};

const ACCENT = "#F5A623";
const ACCENT_BG = "rgba(245, 166, 35, 0.12)";
const INACTIVE_COLOR = "#8E8E93";

export const TAB_BAR_HEIGHT = 100;

interface AnimatedTabProps {
  route: BottomTabBarProps["state"]["routes"][0];
  index: number;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  badgeCount?: number;
}

function AnimatedTab({
  route,
  isFocused,
  onPress,
  onLongPress,
  badgeCount,
}: AnimatedTabProps) {
  const scale = useSharedValue(1);
  const pillWidth = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    pillWidth.value = withSpring(isFocused ? 1 : 0, SPRING_CONFIG);
  }, [isFocused, pillWidth]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillWidth.value,
    transform: [{ scale: 0.85 + pillWidth.value * 0.15 }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const icons = TAB_ICONS[route.name] ?? {
    active: "ellipse",
    inactive: "ellipse-outline",
  };
  const label = TAB_LABELS[route.name] ?? route.name;
  const iconName = isFocused ? icons.active : icons.inactive;

  const handlePress = () => {
    scale.value = withSpring(0.85, { damping: 10, stiffness: 400 }, () => {
      scale.value = withSpring(1, SPRING_CONFIG);
    });

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    onPress();
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      onPress={handlePress}
      onLongPress={onLongPress}
      style={styles.tabButton}
      activeOpacity={0.7}
    >
      {/* Pill background */}
      <Animated.View
        style={[
          styles.pill,
          pillStyle,
          { backgroundColor: isFocused ? ACCENT_BG : "transparent" },
        ]}
      />

      {/* Icon + label (column layout — icon always centered) */}
      <Animated.View style={[styles.tabContent, iconStyle]}>
        <View style={styles.iconContainer}>
          <Ionicons
            name={iconName as any}
            size={22}
            color={isFocused ? ACCENT : INACTIVE_COLOR}
          />
          {/* Badge */}
          {badgeCount != null && badgeCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {badgeCount > 99 ? "99+" : badgeCount}
              </Text>
            </View>
          )}
        </View>
        <Animated.Text
          style={[
            styles.label,
            {
              color: isFocused ? ACCENT : INACTIVE_COLOR,
              opacity: isFocused ? 1 : 0.7,
              fontWeight: isFocused ? "700" : "500",
            },
          ]}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export function FloatingTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomPadding }]}>
      <BlurView intensity={80} tint="light" style={styles.blurContainer}>
        <View style={styles.innerContainer}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: "tabLongPress",
                target: route.key,
              });
            };

            // Cart badge support — pass a badge count via options.tabBarBadge
            const badgeCount =
              route.name === "cart" && options.tabBarBadge != null
                ? Number(options.tabBarBadge)
                : undefined;

            return (
              <AnimatedTab
                key={route.key}
                route={route}
                index={index}
                isFocused={isFocused}
                onPress={onPress}
                onLongPress={onLongPress}
                badgeCount={badgeCount}
              />
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  blurContainer: {
    width: "100%",
    borderRadius: 28,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  innerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    position: "relative",
  },
  pill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    marginHorizontal: 4,
  },
  tabContent: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    zIndex: 1,
  },
  iconContainer: {
    position: "relative",
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter",
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -10,
    backgroundColor: "#FF3B30",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
});
