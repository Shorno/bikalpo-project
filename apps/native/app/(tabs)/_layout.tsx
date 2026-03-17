import { Tabs } from "expo-router";
import { FloatingTabBar } from "../../components/floating-tab-bar";

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: "#fff",
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="categories" options={{ title: "Categories" }} />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          // Uncomment and set dynamically when you have cart state:
          // tabBarBadge: cartItemCount,
        }}
      />
      <Tabs.Screen name="account" options={{ title: "Account" }} />
    </Tabs>
  );
}

