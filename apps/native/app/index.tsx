import { YStack, Text } from "tamagui";

export default function Home() {
  return (
    <YStack flex={1} items="center" justify="center" bg="$background">
      <Text fontSize="$8" fontWeight="bold">
        Bikalpo
      </Text>
      <Text fontSize="$4" color="$gray10" mt="$2">
        Start building your app
      </Text>
    </YStack>
  );
}
