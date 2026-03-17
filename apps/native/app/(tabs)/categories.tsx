import { View, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { Text } from "tamagui";
import { useQuery } from "@tanstack/react-query";

import { CategoryChip } from "@/components/category-chip";
import { orpc } from "@/utils/orpc";

export default function CategoriesScreen() {
  const categories = useQuery(orpc.category.getActive.queryOptions());
  const categoryList = categories.data ?? [];

  if (categories.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F5A623" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={styles.header}>
        <Text fontSize="$7" fontWeight="bold" color="#1A1A2E">
          Categories
        </Text>
      </View>

      <View style={styles.grid}>
        {categoryList.map((cat) => (
          <View key={cat.id} style={styles.item}>
            <CategoryChip name={cat.name} image={cat.image} />
          </View>
        ))}
      </View>

      {categoryList.length === 0 && (
        <View style={styles.emptyState}>
          <Text fontSize="$4" color="#8E8E93">
            No categories available
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 20,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    gap: 20,
  },
  item: {
    width: "28%",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
  },
});
