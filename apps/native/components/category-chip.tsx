import { View, Image, StyleSheet, Pressable } from "react-native";
import { Text } from "tamagui";

interface CategoryChipProps {
  name: string;
  image: string;
  onPress?: () => void;
}

export function CategoryChip({ name, image, onPress }: CategoryChipProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && { opacity: 0.7 }]}
      onPress={onPress}
    >
      <View style={styles.imageWrapper}>
        <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
      </View>
      <Text fontSize="$2" color="#1A1A2E" text="center" numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    width: 72,
    gap: 6,
  },
  imageWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FFF5E6",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
});
