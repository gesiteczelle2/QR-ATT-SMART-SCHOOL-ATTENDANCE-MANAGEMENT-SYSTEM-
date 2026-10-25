
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';

import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { useTheme } from '@/app/contexts/ThemeContext';
import { signOut } from '@/lib/auth';

export default function AdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();

  const styles = createStyles(colors);

  const handleLogout = async () => {
    try {
      const { error } = await signOut();

      if (error) {
        Alert.alert('Logout Failed', error.message);
        return;
      }

      router.replace('/login');
    } catch (error: any) {
      Alert.alert(
        'Logout Failed',
        error?.message || 'Please try again.'
      );
    }
  };

  const openUsers = () => router.push('/admin-users');
  const openEvents = () => router.push('/admin-events');
  const openAttendance = () => router.push('/admin-attendance');
  const openPhotos = () => router.push('/admin-photos');
  const openReports = () => router.navigate('/admin-reports');
  const openTeacherApprovals = () =>
    router.push('/admin-teachers');

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Header title="Administrator" />

        <View style={styles.welcome}>
          <Text style={styles.title}>Admin Dashboard</Text>

          <Text style={styles.subtitle}>
            Manage users, teacher registrations, events, attendance records, and uniform photos.
          </Text>
        </View>

        {/* Dark Mode */}
        <View style={styles.themeCard}>
          <View style={styles.themeTextContainer}>
            <Text style={styles.themeTitle}>Dark Mode</Text>

            <Text style={styles.themeSubtitle}>
              {isDark
                ? 'Dark theme is enabled'
                : 'Light theme is enabled'}
            </Text>
          </View>

          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{
              false: colors.border,
              true: colors.primary,
            }}
            thumbColor={colors.card}
            accessibilityLabel="Toggle dark mode"
          />
        </View>

        {/* Teacher Registration Approval */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Teacher Registration Approval
          </Text>

          <Text style={styles.cardText}>
            Review new teacher registrations and approve or reject their requests.
          </Text>

          <AppButton
            theme="primary"
            title="Review Teacher Requests"
            icon="person-add-outline"
            onPress={openTeacherApprovals}
          />
        </View>

        {/* Manage Users */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Manage Users</Text>

          <Text style={styles.cardText}>
            View and manage student, teacher, and administrator accounts.
          </Text>

          <AppButton
            theme="primary"
            title="Manage Users"
            icon="people-outline"
            onPress={openUsers}
          />
        </View>

        {/* Manage Events */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Manage Events</Text>

          <Text style={styles.cardText}>
            Create, search, edit, and manage school events.
          </Text>

          <AppButton
            theme="primary"
            title="Manage Events"
            icon="calendar-outline"
            onPress={openEvents}
          />
        </View>

        {/* Attendance Records */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Attendance Records</Text>

          <Text style={styles.cardText}>
            View student attendance records for school events.
          </Text>

          <AppButton
            theme="primary"
            title="View Attendance"
            icon="clipboard-outline"
            onPress={openAttendance}
          />
        </View>

        {/* Uniform Photo Approval */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Uniform Photo Approval
          </Text>

          <Text style={styles.cardText}>
            Review student profile photos and approve or reject uniform photos.
          </Text>

          <AppButton
            theme="primary"
            title="Review Uniform Photos"
            icon="image-outline"
            onPress={openPhotos}
          />
        </View>

        {/* Reports */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reports</Text>

          <Text style={styles.cardText}>
            View attendance summaries and event reports.
          </Text>

          <AppButton
            theme="primary"
            title="View Reports"
            icon="bar-chart-outline"
            onPress={openReports}
          />
        </View>

        {/* Logout */}
        <View style={styles.logoutContainer}>
          <AppButton
            theme="primary"
            title="Logout"
            icon="log-out-outline"
            onPress={handleLogout}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(
  colors: ReturnType<typeof useTheme>['colors']
) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    content: {
      paddingHorizontal: 20,
      paddingBottom: 40,
    },

    welcome: {
      marginTop: 20,
      marginBottom: 20,
    },

    title: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 6,
    },

    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 21,
    },

    themeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: 14,
      padding: 16,
      marginBottom: 20,
    },

    themeTextContainer: {
      flex: 1,
      marginRight: 12,
    },

    themeTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    themeSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 4,
    },

    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 18,
      marginBottom: 16,
    },

    cardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 6,
    },

    cardText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 16,
    },

    logoutContainer: {
      marginTop: 8,
      marginBottom: 20,
    },
  });
}
