import { Tabs } from 'expo-router';

import Ionicons from '@expo/vector-icons/Ionicons';

import { useEffect, useState } from 'react';

import { COLORS } from '@/constants/colors';

import { useAuth } from '@/lib/auth';

import type { Role } from '@/lib/profiles';

import { getUserRole } from '@/lib/role';

export default function TabLayout() {
  const { user } = useAuth();

  const [role, setRole] =
    useState<Role | null>(null);

  useEffect(() => {
    let active = true;

    if (!user) {
      setRole(null);
      return;
    }

    getUserRole(user.id).then((userRole) => {
      if (!active) return;

      setRole(userRole);
    });

    return () => {
      active = false;
    };
  }, [user]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        headerStyle: {
          backgroundColor: COLORS.background,
        },
        headerShadowVisible: false,
        headerTintColor: COLORS.textPrimary,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={
                focused
                  ? 'home-sharp'
                  : 'home-outline'
              }
              color={color}
              size={24}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',

          href:
            role === 'teacher'
              ? null
              : '/scan',

          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={
                focused
                  ? 'qr-code'
                  : 'qr-code-outline'
              }
              color={color}
              size={24}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={
                focused
                  ? 'time'
                  : 'time-outline'
              }
              color={color}
              size={24}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="teacher"
        options={{
          title: 'Teacher',

          href:
            role === 'student'
              ? null
              : '/teacher',

          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={
                focused
                  ? 'clipboard'
                  : 'clipboard-outline'
              }
              color={color}
              size={24}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={
                focused
                  ? 'person'
                  : 'person-outline'
              }
              color={color}
              size={24}
            />
          ),
        }}
      />
    </Tabs>
  );
}