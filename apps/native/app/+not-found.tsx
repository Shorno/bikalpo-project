import { YStack, Text } from "tamagui";
import { Link, Stack } from "expo-router";

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: "Not Found" }} />
      <YStack flex={1} items="center" justify="center" bg="$background" gap="$4">
        <Text fontSize="$6" fontWeight="bold">
          Page not found
        </Text>
        <Link href="/">
          <Text color="$blue10" fontSize="$4">
            Go home
          </Text>
        </Link>
      </YStack>
    </>
  );
}
