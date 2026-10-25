
import { Tabs, Redirect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTheme } from '@/app/contexts/ThemeContext';
import { useAuth } from '@/lib/auth';
import type { Role } from '@/lib/profiles';
import { getUserRole } from '@/lib/role';

export default function TabLayout() {
  const { user } = useAuth();
  const { colors } = useTheme();

  const [role, setRole] = useState<Role | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    let active = true;

    if (!user) {
      setRole(null);
      setRoleLoading(false);
      return;
    }

    setRoleLoading(true);

    getUserRole(user.id)
      .then((userRole) => {
        if (active) {
          setRole(userRole);
        }
      })
      .catch((error) => {
        console.error('Failed to load user role:', error);
        if (active) {
          setRole(null);
        }
      })
      .finally(() => {
        if (active) {
          setRoleLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [user]);

  const styles = createStyles(colors);

  if (roleLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (role === 'admin') {
    return <Redirect href="/admin" />;
  }

  const isStudent = role === 'student';
  const isTeacher = role === 'teacher';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        tabBarHideOnKeyboard: true,
        tabBarBackground: () => (
          <View style={styles.tabBackground} />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          href: isStudent ? '/' : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              color={color}
              size={23}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          href: isStudent ? '/scan' : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'qr-code' : 'qr-code-outline'}
              color={color}
              size={23}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          href: isStudent || isTeacher ? '/history' : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'time' : 'time-outline'}
              color={color}
              size={23}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="teacher"
        options={{
          title: 'Teacher',
          href: isTeacher ? '/teacher' : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'clipboard' : 'clipboard-outline'}
              color={color}
              size={23}
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
              name={focused ? 'person' : 'person-outline'}
              color={color}
              size={23}
            />
          ),
        }}
      />
    </Tabs>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    tabBackground: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 22,
    },
    tabBar: {
      position: 'absolute',
      left: 14,
      right: 14,
      bottom: 12,
      height: 66,
      paddingTop: 7,
      paddingBottom: 7,
      paddingHorizontal: 5,
      backgroundColor: colors.backgroundSecondary,
      borderTopWidth: 1,
      borderTopColor: colors.glassBorder,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: 22,
      elevation: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
    },
    tabLabel: {
      fontSize: 10,
      fontWeight: '700',
      marginTop: 2,
    },
    tabItem: {
      paddingVertical: 2,
    },
  });
}
