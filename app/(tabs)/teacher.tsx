import { useCallback, useState } from 'react';

import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useFocusEffect } from 'expo-router';

import Ionicons from '@expo/vector-icons/Ionicons';

import QRCode from 'react-native-qrcode-svg';

import AppButton from '@/components/AppButton';

import { COLORS } from '@/constants/colors';

import { useAuth } from '@/lib/auth';

import {
  createEvent,
  type Event,
} from '@/lib/events';

import type { Role } from '@/lib/profiles';

import { getUserRole } from '@/lib/role';

import { buildQRPayload } from '@/lib/qr';

export default function TeacherScreen() {
  const { user } = useAuth();

  const [role, setRole] =
    useState<Role | null>(null);

  const [roleLoading, setRoleLoading] =
    useState(true);

  const [eventTitle, setEventTitle] =
    useState('');

  const [eventCreated, setEventCreated] =
    useState(false);

  const [payload, setPayload] =
    useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      setRoleLoading(true);

      if (!user) {
        setRole(null);
        setRoleLoading(false);

        return () => {
          active = false;
        };
      }

      getUserRole(user.id).then((userRole) => {
        if (!active) return;

        setRole(userRole);
        setRoleLoading(false);
      });

      return () => {
        active = false;
      };
    }, [user])
  );

  const handleCreateEvent = async () => {
    const title = eventTitle.trim();

    if (!title) {
      return;
    }

    const event: Event = {
      eventId: `EVT-${Date.now()}`,
      title: title,
      start: new Date().toISOString(),
      end: new Date(
        Date.now() + 60 * 60 * 1000
      ).toISOString(),
    };

    const { error } = await createEvent(event);

    if (error) {
      setEventCreated(false);
      setPayload(null);
      return;
    }

    setEventCreated(true);
    setPayload(buildQRPayload(event));
  };

  if (roleLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />

        <Text style={styles.loadingText}>
          Checking your account...
        </Text>
      </View>
    );
  }

  if (role !== 'teacher') {
    return (
      <View style={styles.centerContainer}>
        <Ionicons
          name="lock-closed-outline"
          size={56}
          color={COLORS.textSecondary}
        />

        <Text style={styles.lockTitle}>
          Teachers Only
        </Text>

        <Text style={styles.lockText}>
          Only teacher accounts can create events.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Create Event
      </Text>

      <Text style={styles.subtitle}>
        Enter the name of your attendance event.
      </Text>

      <Text style={styles.label}>
        Event Name
      </Text>

      <TextInput
        value={eventTitle}
        onChangeText={setEventTitle}
        placeholder="e.g. BSIT Seminar"
        placeholderTextColor={COLORS.textSecondary}
        style={styles.input}
      />

      <AppButton
        theme="primary"
        title="Create Event"
        icon="add-circle-outline"
        onPress={handleCreateEvent}
      />

      {eventCreated && payload && (
        <View style={styles.qrContainer}>
          <Text style={styles.eventCreatedText}>
            {eventTitle}
          </Text>

          <Text style={styles.scanText}>
            Students can scan this QR code
          </Text>

          <View style={styles.qrBox}>
            <QRCode
              value={payload}
              size={220}
              backgroundColor="white"
              color="black"
            />
          </View>

          <Text style={styles.eventCode}>
            Event created successfully!
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  centerContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: COLORS.textSecondary,
  },

  lockTitle: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  lockText: {
    marginTop: 8,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: COLORS.textSecondary,
    marginBottom: 24,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },

  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 16,
  },

  qrContainer: {
    alignItems: 'center',
    marginTop: 24,
  },

  eventCreatedText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },

  scanText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: 16,
  },

  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
  },

  eventCode: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
    marginTop: 12,
  },
});