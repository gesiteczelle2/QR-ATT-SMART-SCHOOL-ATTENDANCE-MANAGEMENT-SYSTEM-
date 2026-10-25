
import { router } from 'expo-router';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { useTheme } from '@/app/contexts/ThemeContext';

export default function Index() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerContainer}>
          <Header title="QR Attendance" />
        </View>

        <View style={styles.welcomeSection}>
          <Text style={styles.eyebrow}>SMART SCHOOL SYSTEM</Text>

          <Text style={styles.mainTitle}>
            Your Events.
            {'\n'}
            Your Attendance.
          </Text>

          <Text style={styles.subtitle}>
            Make every school activity count. Scan an event QR
            code to record your attendance quickly and easily.
          </Text>
        </View>

        <View style={styles.featureCard}>
          <View style={styles.featureTopRow}>
            <View style={styles.qrIconBox}>
              <Text style={styles.qrIcon}>QR</Text>
            </View>

            <View style={styles.liveBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.liveText}>READY TO SCAN</Text>
            </View>
          </View>

          <Text style={styles.featureTitle}>
            Check in to your event
          </Text>

          <Text style={styles.featureDescription}>
            Scan the QR code provided by your teacher to save
            your attendance record.
          </Text>

          <AppButton
            theme="primary"
            title="Scan QR Code"
            icon="qr-code-outline"
            onPress={() => router.push('/scan')}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <Text style={styles.sectionCaption}>
            Manage your records
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.quickAccessCard,
            pressed && styles.cardPressed,
          ]}
          onPress={() => router.push('/history')}
          accessibilityRole="button"
          accessibilityLabel="Open Attendance History"
        >
          <View style={styles.quickAccessIcon}>
            <Text style={styles.quickIconText}>01</Text>
          </View>

          <View style={styles.quickAccessText}>
            <Text style={styles.quickTitle}>
              Attendance History
            </Text>
            <Text style={styles.quickDescription}>
              View your previous attendance records
            </Text>
          </View>

          <Text style={styles.arrow}>›</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.quickAccessCard,
            pressed && styles.cardPressed,
          ]}
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          accessibilityLabel="Open My Profile"
        >
          <View style={styles.quickAccessIcon}>
            <Text style={styles.quickIconText}>02</Text>
          </View>

          <View style={styles.quickAccessText}>
            <Text style={styles.quickTitle}>My Profile</Text>
            <Text style={styles.quickDescription}>
              View and update your account information
            </Text>
          </View>

          <Text style={styles.arrow}>›</Text>
        </Pressable>

        <View style={styles.tipCard}>
          <View style={styles.tipIconBox}>
            <Text style={styles.tipIcon}>i</Text>
          </View>

          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>Attendance Tip</Text>
            <Text style={styles.tipText}>
              Make sure your camera permission is enabled before
              scanning an event QR code.
            </Text>
          </View>
        </View>

        <Text style={styles.footerText}>
          QR-ATT · SMART SCHOOL ATTENDANCE
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof import('@/app/contexts/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 35,
    },

    headerContainer: {
      marginBottom: 28,
    },

    welcomeSection: {
      marginBottom: 24,
    },

    eyebrow: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 2,
      color: colors.primary,
      marginBottom: 12,
    },

    mainTitle: {
      fontSize: 32,
      lineHeight: 39,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 12,
    },

    subtitle: {
      fontSize: 14,
      lineHeight: 22,
      color: colors.textSecondary,
    },

    featureCard: {
      backgroundColor: colors.glass,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: 20,
      marginBottom: 28,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 14,
      elevation: 5,
    },

    featureTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 22,
    },

    qrIconBox: {
      width: 58,
      height: 58,
      borderRadius: 18,
      backgroundColor: colors.glassLight,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },

    qrIcon: {
      fontSize: 18,
      fontWeight: '900',
      color: colors.primary,
    },

    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.glassLight,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },

    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.success,
      marginRight: 7,
    },

    liveText: {
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.7,
      color: colors.success,
    },

    featureTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 8,
    },

    featureDescription: {
      fontSize: 13,
      lineHeight: 20,
      color: colors.textSecondary,
      marginBottom: 20,
    },

    sectionHeader: {
      marginBottom: 14,
    },

    sectionTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
    },

    sectionCaption: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 5,
    },

    quickAccessCard: {
      minHeight: 86,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.glass,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: 14,
      marginBottom: 12,
    },

    cardPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.98 }],
    },

    quickAccessIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },

    quickIconText: {
      fontSize: 12,
      fontWeight: '900',
      color: colors.primary,
    },

    quickAccessText: {
      flex: 1,
    },

    quickTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textPrimary,
    },

    quickDescription: {
      fontSize: 11,
      lineHeight: 16,
      color: colors.textSecondary,
      marginTop: 5,
    },

    arrow: {
      fontSize: 28,
      color: colors.primary,
      marginLeft: 8,
    },

    tipCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.glassLight,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: 16,
      marginTop: 12,
    },

    tipIconBox: {
      width: 28,
      height: 28,
      borderRadius: 10,
      backgroundColor: colors.glassLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },

    tipIcon: {
      fontSize: 16,
      fontWeight: '900',
      color: colors.primary,
    },

    tipContent: {
      flex: 1,
    },

    tipTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 5,
    },

    tipText: {
      fontSize: 12,
      lineHeight: 19,
      color: colors.textSecondary,
    },

    footerText: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1.5,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 25,
    },
  });
}
