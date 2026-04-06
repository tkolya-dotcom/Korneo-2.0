import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '../src/context/AuthContext';

export default function RootLayout() {
  const { session, isLoading } = useAuth();

  useEffect(() => {
    console.log('RootLayout session:', session ? 'logged' : 'guest');
  }, [session]);

  if (isLoading) {
    return null; // or Loading screen
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

