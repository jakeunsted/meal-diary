import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#1A1F2E' } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="registration/step-1" />
      <Stack.Screen name="registration/step-2" />
    </Stack>
  );
}
