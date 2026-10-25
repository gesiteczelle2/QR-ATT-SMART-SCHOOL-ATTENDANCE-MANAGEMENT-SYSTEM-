
import { useEffect } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

import * as NavigationBar from 'expo-navigation-bar';
import { Stack, Redirect, useSegments } from 'expo-router';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { ThemeProvider } from '@/app/contexts/ThemeContext';

export default function RootLayout() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const path = segments[0];

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    NavigationBar.setVisibilityAsync('hidden').catch((error) => {
      console.warn('Could not hide navigation bar:', error);
    });
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />
      </View>
    );
  }

  const publicRoutes = [
    'login',
    'register',
    'reset-password',
  ];

  if (!session && !publicRoutes.includes(path as string)) {
    return <Redirect href="/login" />;
  }

  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="admin-users" />
        <Stack.Screen name="admin-events" />
        <Stack.Screen name="admin-attendance" />
        <Stack.Screen name="admin-reports" />
        <Stack.Screen name="admin-photos" />
      </Stack>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
});
