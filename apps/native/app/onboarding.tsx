import { useRef, useState, useCallback } from "react";
import {
  FlatList,
  Image,
  Dimensions,
  StyleSheet,
  View,
  Pressable,
  type ViewToken,
} from "react-native";
import { Text } from "tamagui";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    id: "1",
    title: "Diverse & sparkling food.",
    subtitle:
      "We use the best local ingredients to create fresh and delicious food and drinks.",
    image: require("@/assets/images/onboarding/food.png"),
    bgColor: "#FFF0ED",
  },
  {
    id: "2",
    title: "Fast & reliable delivery.",
    subtitle:
      "Get your favorite products delivered to your doorstep in no time with our trusted delivery.",
    image: require("@/assets/images/onboarding/delivery.png"),
    bgColor: "#E8F5E9",
  },
  {
    id: "3",
    title: "Easy & simple ordering.",
    subtitle:
      "Browse thousands of products, add to cart, and checkout in just a few taps.",
    image: require("@/assets/images/onboarding/ordering.png"),
    bgColor: "#E3F2FD",
  },
];

export default function Onboarding() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  async function handleGetStarted() {
    await SecureStore.setItemAsync("onboarding_completed", "true");
    router.replace("/");
  }

  function handleNext() {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      handleGetStarted();
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <View style={[styles.imageContainer, { backgroundColor: item.bgColor }]}>
              <Image source={item.image} style={styles.image} resizeMode="contain" />
            </View>
            <View style={styles.textContainer}>
              <Text
                fontSize="$8"
                fontWeight="bold"
                color="#1A1A2E"
                text="center"
                style={{ lineHeight: 36 }}
              >
                {item.title}
              </Text>
              <Text
                fontSize="$4"
                color="#8E8E93"
                text="center"
                mt="$3"
                style={{ lineHeight: 22, paddingHorizontal: 20 }}
              >
                {item.subtitle}
              </Text>
            </View>
          </View>
        )}
      />

      {/* Dot Indicators */}
      <View style={styles.dotsContainer}>
        {SLIDES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              currentIndex === index ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>

      {/* Button */}
      <View style={styles.buttonContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleNext}
        >
          <Text fontSize="$5" fontWeight="bold" color="#fff">
            {currentIndex === SLIDES.length - 1 ? "Get started" : "Next"}
          </Text>
        </Pressable>

        {currentIndex < SLIDES.length - 1 && (
          <Pressable onPress={handleGetStarted} style={styles.skipButton}>
            <Text fontSize="$4" color="#8E8E93">
              Skip
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  slide: {
    width,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  imageContainer: {
    width: width * 0.75,
    height: width * 0.75,
    borderRadius: width * 0.375,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 60,
  },
  image: {
    width: width * 0.6,
    height: width * 0.6,
  },
  textContainer: {
    paddingHorizontal: 40,
    marginTop: 40,
    alignItems: "center",
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 30,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 28,
    backgroundColor: "#F5A623",
  },
  dotInactive: {
    width: 8,
    backgroundColor: "#D8D8D8",
  },
  buttonContainer: {
    paddingHorizontal: 40,
    paddingBottom: 50,
    alignItems: "center",
    gap: 16,
  },
  button: {
    backgroundColor: "#F5A623",
    paddingVertical: 16,
    borderRadius: 30,
    width: "100%",
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  skipButton: {
    paddingVertical: 8,
  },
});
