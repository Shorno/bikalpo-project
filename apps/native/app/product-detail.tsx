import { useState, useCallback, useRef } from "react";
import {
  View,
  ScrollView,
  Image,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  FlatList,
  type ViewToken,
} from "react-native";
import { Text } from "tamagui";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";

import { orpc } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_HEIGHT = SCREEN_WIDTH * 0.95;

const ACCENT = "#F5A623";
const BLUE = "#2563EB";
const DARK = "#1A1A2E";
const GREY = "#8E8E93";

export default function ProductDetailScreen() {
  const params = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();

  // expo-router can return string | string[] — normalize to string
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);

  const { data: session } = authClient.useSession();
  const isLoggedIn = !!session?.user;

  const imageListRef = useRef<FlatList>(null);
  console.log(slug);

  const { data, isLoading, isError } = useQuery({
    ...orpc.customer.getProductDetails.queryOptions({
      input: { slug: slug ?? "" },
    }),
    enabled: !!slug && slug.length > 0,
  });

  const onImageViewableChange = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setImageIndex(viewableItems[0].index);
      }
    },
    [],
  );
  const imageViewConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={GREY} />
        <Text fontSize="$4" color={GREY} mt="$3">
          Product not found
        </Text>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text fontSize="$3" color={ACCENT} fontWeight="600">
            Go back
          </Text>
        </Pressable>
      </View>
    );
  }

  const { product, variants, reviewStats } = data;

  // Build image list: main image + additional images
  const allImages = [
    product.image,
    ...(product.images?.map((img) => img.imageUrl) ?? []),
  ].filter(Boolean);

  const selectedVariant = variants[selectedVariantIndex];
  const displayPrice = selectedVariant
    ? selectedVariant.price
    : product.price;

  // Quantity constraints from variant
  const orderMin = selectedVariant
    ? Number(selectedVariant.orderMin)
    : 1;
  const orderMax = selectedVariant?.orderMax
    ? Number(selectedVariant.orderMax)
    : 999;
  const orderIncrement = selectedVariant
    ? Number(selectedVariant.orderIncrement)
    : 1;

  const handleDecrement = () => {
    setQuantity((prev) => Math.max(orderMin, prev - orderIncrement));
  };

  const handleIncrement = () => {
    setQuantity((prev) => Math.min(orderMax, prev + orderIncrement));
  };

  const handleVariantSelect = (index: number) => {
    setSelectedVariantIndex(index);
    setQuantity(Number(variants[index]?.orderMin ?? 1));
  };

  // Features
  const features =
    (product.features as Array<{ title: string; items: Array<{ key: string; value: string }> }>) ??
    [];

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ── Hero Image Gallery ─────────────────────────── */}
        <View style={styles.heroContainer}>
          <FlatList
            ref={imageListRef}
            data={allImages}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={false}
            onViewableItemsChanged={onImageViewableChange}
            viewabilityConfig={imageViewConfig}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item }) => (
              <Image
                source={{ uri: item }}
                style={styles.heroImage}
                resizeMode="cover"
              />
            )}
          />

          {/* Back button overlay */}
          <Pressable
            style={[styles.overlayButton, { top: insets.top + 8, left: 16 }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color={DARK} />
          </Pressable>

          {/* Share button overlay */}
          <Pressable
            style={[styles.overlayButton, { top: insets.top + 8, right: 16 }]}
          >
            <Ionicons name="share-outline" size={20} color={DARK} />
          </Pressable>

          {/* Image pagination dots */}
          {allImages.length > 1 && (
            <View style={styles.dotsRow}>
              {allImages.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    imageIndex === i ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* ── Price & Info Card ────────────────────────── */}
        <View style={styles.priceCard}>
          <View style={styles.priceRow}>
            <Image
              source={{ uri: product.image }}
              style={styles.thumbnailSmall}
            />
            <View style={styles.priceInfo}>
              <Text fontSize="$8" fontWeight="bold" color={DARK}>
                ৳{Number(displayPrice).toLocaleString()}
              </Text>
              <View style={styles.chipRow}>
                {product.size && (
                  <View style={styles.chip}>
                    <Text fontSize="$2" color="#555">
                      {product.size}
                    </Text>
                  </View>
                )}
                {selectedVariant && (
                  <View style={styles.chip}>
                    <Text fontSize="$2" color="#555">
                      {selectedVariant.unitLabel}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Review summary */}
          {reviewStats.totalReviews > 0 && (
            <View style={styles.reviewRow}>
              <Ionicons name="star" size={16} color="#FFC107" />
              <Text fontSize="$3" fontWeight="600" color={DARK} ml="$1">
                {reviewStats.averageRating.toFixed(1)}
              </Text>
              <Text fontSize="$2" color={GREY} ml="$1">
                ({reviewStats.totalReviews}{" "}
                {reviewStats.totalReviews === 1 ? "review" : "reviews"})
              </Text>
            </View>
          )}
        </View>

        {/* ── Variant Selector ────────────────────────── */}
        {variants.length > 0 && (
          <View style={styles.section}>
            <Text fontSize="$5" fontWeight="bold" color={DARK} mb="$3">
              Variants
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12 }}
            >
              {variants.map((v, i) => {
                const isSelected = i === selectedVariantIndex;
                return (
                  <Pressable
                    key={v.id}
                    style={[
                      styles.variantCard,
                      isSelected && styles.variantCardSelected,
                    ]}
                    onPress={() => handleVariantSelect(i)}
                  >
                    {isSelected && (
                      <View style={styles.variantCheck}>
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={BLUE}
                        />
                      </View>
                    )}
                    <Text
                      fontSize="$3"
                      fontWeight="600"
                      color={isSelected ? BLUE : DARK}
                    >
                      {v.unitLabel}
                    </Text>
                    <Text
                      fontSize="$2"
                      color={isSelected ? BLUE : GREY}
                      mt="$0.5"
                    >
                      ৳{Number(v.price).toLocaleString()}
                    </Text>
                    {v.packType && (
                      <Text fontSize={10} color={GREY} mt="$0.5">
                        {v.packType}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Quantity Stepper ────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.quantityRow}>
            <Text fontSize="$5" fontWeight="bold" color={DARK}>
              Quantity
            </Text>
            <View style={styles.stepper}>
              <Pressable
                style={[
                  styles.stepperBtn,
                  quantity <= orderMin && styles.stepperBtnDisabled,
                ]}
                onPress={handleDecrement}
                disabled={quantity <= orderMin}
              >
                <Ionicons
                  name="remove"
                  size={22}
                  color={quantity <= orderMin ? "#ccc" : BLUE}
                />
              </Pressable>
              <View style={styles.stepperValue}>
                <Text fontSize="$5" fontWeight="bold" color={DARK}>
                  {quantity}
                </Text>
              </View>
              <Pressable
                style={[
                  styles.stepperBtn,
                  quantity >= orderMax && styles.stepperBtnDisabled,
                ]}
                onPress={handleIncrement}
                disabled={quantity >= orderMax}
              >
                <Ionicons
                  name="add"
                  size={22}
                  color={quantity >= orderMax ? "#ccc" : BLUE}
                />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Description ─────────────────────────────── */}
        {product.description && (
          <View style={styles.section}>
            <Text fontSize="$5" fontWeight="bold" color={DARK} mb="$2">
              Description
            </Text>
            <Text fontSize="$3" color="#444" lineHeight={22}>
              {product.description}
            </Text>
          </View>
        )}

        {/* ── Features ────────────────────────────────── */}
        {features.length > 0 &&
          features.map((group, gi) => (
            <View key={gi} style={styles.section}>
              <Text fontSize="$4" fontWeight="bold" color={DARK} mb="$2">
                {group.title}
              </Text>
              {group.items.map((item, ii) => (
                <View key={ii} style={styles.featureRow}>
                  <Text fontSize="$3" color={GREY} style={{ width: "40%" }}>
                    {item.key}
                  </Text>
                  <Text fontSize="$3" color={DARK} style={{ width: "60%" }}>
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          ))}

        {/* ── Product Meta ────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.metaRow}>
            <Ionicons name="pricetag-outline" size={16} color={GREY} />
            <Text fontSize="$2" color={GREY} ml="$1.5">
              Category: {product.category?.name}
            </Text>
          </View>
          {product.brand && (
            <View style={[styles.metaRow, { marginTop: 8 }]}>
              <Ionicons name="briefcase-outline" size={16} color={GREY} />
              <Text fontSize="$2" color={GREY} ml="$1.5">
                Brand: {product.brand.name}
              </Text>
            </View>
          )}
          <View style={[styles.metaRow, { marginTop: 8 }]}>
            <Ionicons
              name={product.inStock ? "checkmark-circle" : "close-circle"}
              size={16}
              color={product.inStock ? "#22C55E" : "#EF4444"}
            />
            <Text
              fontSize="$2"
              color={product.inStock ? "#22C55E" : "#EF4444"}
              ml="$1.5"
              fontWeight="600"
            >
              {product.inStock ? "In Stock" : "Out of Stock"}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ── Sticky Bottom Action Bar ──────────────────── */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.wishlistBtn,
            pressed && { opacity: 0.7 },
          ]}
          onPress={() => {
            if (!isLoggedIn) {
              toast.error("Sign in required", {
                description: "Please sign in to save items to your wishlist",
                action: {
                  label: "Sign in",
                  onClick: () => router.push("/login"),
                },
              });
              return;
            }
            setIsWishlisted((prev) => {
              const next = !prev;
              toast.success(next ? "Added to wishlist" : "Removed from wishlist");
              return next;
            });
          }}
        >
          <Ionicons
            name={isWishlisted ? "heart" : "heart-outline"}
            size={24}
            color={isWishlisted ? "#EF4444" : DARK}
          />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.addToCartBtn,
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => {
            if (!isLoggedIn) {
              toast.error("Sign in required", {
                description: "Please sign in to add items to your cart",
                action: {
                  label: "Sign in",
                  onClick: () => router.push("/login"),
                },
              });
              return;
            }
            toast.success("Added to cart", {
              description: `${product.name} × ${quantity}`,
            });
          }}
        >
          <Text fontSize="$3" fontWeight="bold" color="#fff">
            Add to cart
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.buyNowBtn,
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => {
            if (!isLoggedIn) {
              toast.error("Sign in required", {
                description: "Please sign in to purchase items",
                action: {
                  label: "Sign in",
                  onClick: () => router.push("/login"),
                },
              });
              return;
            }
            toast.success("Proceeding to checkout", {
              description: `${product.name} × ${quantity}`,
            });
          }}
        >
          <Text fontSize="$3" fontWeight="bold" color="#fff">
            Buy now
          </Text>
        </Pressable>
      </View>
    </View>
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
  backButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },

  // ── Hero ──
  heroContainer: {
    position: "relative",
    backgroundColor: "#F8F8F8",
  },
  heroImage: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
  },
  overlayButton: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dotsRow: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 20,
    backgroundColor: ACCENT,
  },
  dotInactive: {
    width: 6,
    backgroundColor: "rgba(255,255,255,0.7)",
  },

  // ── Price Card ──
  priceCard: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: "#F5F0FF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  thumbnailSmall: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#eee",
  },
  priceInfo: {
    flex: 1,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  chip: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },

  // ── Sections ──
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // ── Variants ──
  variantCard: {
    backgroundColor: "#F8F8F8",
    borderRadius: 14,
    padding: 14,
    minWidth: 100,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
    position: "relative",
  },
  variantCardSelected: {
    borderColor: BLUE,
    backgroundColor: "#EFF6FF",
  },
  variantCheck: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#fff",
    borderRadius: 12,
  },

  // ── Quantity ──
  quantityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: BLUE,
    justifyContent: "center",
    alignItems: "center",
  },
  stepperBtnDisabled: {
    borderColor: "#E5E5E5",
  },
  stepperValue: {
    minWidth: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },

  // ── Features ──
  featureRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },

  // ── Meta ──
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  // ── Bottom Bar ──
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    paddingHorizontal: 16,
    gap: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  wishlistBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E5E5E5",
    justifyContent: "center",
    alignItems: "center",
  },
  addToCartBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: DARK,
    justifyContent: "center",
    alignItems: "center",
  },
  buyNowBtn: {
    flex: 1.2,
    height: 52,
    borderRadius: 14,
    backgroundColor: BLUE,
    justifyContent: "center",
    alignItems: "center",
  },
});
