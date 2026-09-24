import { useFocusEffect } from 'expo-router';

import { useCallback, useState } from 'react';

import {
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';

import { useAuth } from '@/lib/auth';

import {
  getAttendanceHistory,
  getTeacherEventSummary,
  type AttendanceRecord,
  type TeacherEventSummary,
} from '@/lib/attendance';

import { getUserRole } from '@/lib/role';

import type { Role } from '@/lib/profiles';

export default function HistoryScreen() {
  const [records, setRecords] =
    useState<AttendanceRecord[]>([]);

  const [eventSummaries, setEventSummaries] =
    useState<TeacherEventSummary[]>([]);

  const [role, setRole] =
    useState<Role | null>(null);

  const [loading, setLoading] =
    useState(true);

  const { user } = useAuth();

  const loadHistory = useCallback(async () => {
    if (!user) {
      setRecords([]);
      setEventSummaries([]);
      setRole(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const userRole = await getUserRole(user.id);

    setRole(userRole);

    if (userRole === 'teacher') {
      const summaries =
        await getTeacherEventSummary(user.id);

      setEventSummaries(summaries);
      setRecords([]);
    } else if (userRole === 'student') {
      const rows =
        await getAttendanceHistory(user.id);

      setRecords(rows);
      setEventSummaries([]);
    } else {
      setRecords([]);
      setEventSummaries([]);
    }

    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Attendance History
      </Text>

      {role === 'teacher' && (
        <Text style={styles.roleText}>
          Teacher Event Summary
        </Text>
      )}

      {role === 'student' && (
        <Text style={styles.roleText}>
          My Attendance Records
        </Text>
      )}

      {loading ? (
        <Text style={styles.subtitle}>
          Loading records...
        </Text>
      ) : role === 'teacher' ? (
        eventSummaries.length === 0 ? (
          <Text style={styles.subtitle}>
            No events yet.
          </Text>
        ) : (
          <FlatList
            data={eventSummaries}
            keyExtractor={(item) =>
              String(item.eventId)
            }
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.eventTitle}>
                  {item.title}
                </Text>

                <Text style={styles.eventMeta}>
                  {item.eventCode}
                </Text>

                <Text style={styles.count}>
                  {item.attendeeCount} attendee
                  {item.attendeeCount !== 1
                    ? 's'
                    : ''}
                </Text>
              </View>
            )}
          />
        )
      ) : role === 'student' ? (
        records.length === 0 ? (
          <Text style={styles.subtitle}>
            No records yet.
          </Text>
        ) : (
          <FlatList
            data={records}
            keyExtractor={(item) =>
              String(item.id)
            }
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.eventTitle}>
                  {item.eventTitle}
                </Text>

                <Text style={styles.eventMeta}>
                  {item.eventId}
                </Text>

                <Text style={styles.eventMeta}>
                  {formatDate(item.scannedAt)}
                </Text>
              </View>
            )}
          />
        )
      ) : (
        <Text style={styles.subtitle}>
          Unable to determine your account role.
        </Text>
      )}
    </View>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },

  roleText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 32,
  },

  list: {
    paddingBottom: 24,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,

    shadowColor: COLORS.shadow,

    shadowOffset: {
      width: 0,
      height: 2,
    },

    shadowOpacity: 0.1,
    shadowRadius: 4,

    elevation: 3,
  },

  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },

  eventMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  count: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
    marginTop: 8,
  },
});