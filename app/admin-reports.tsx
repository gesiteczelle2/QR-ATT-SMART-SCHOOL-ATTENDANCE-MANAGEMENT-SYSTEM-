
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import Header from '@/components/Header';
import { useTheme } from '@/app/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

type EventType = 'classroom' | 'school_event';

type EventItem = {
  id: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  description: string | null;
  status: string | null;
  event_type: string | null;
  class_section: string | null;
  created_at?: string;
};

type AttendanceItem = {
  id: string;
  event_id: string;
};

type ReportItem = EventItem & {
  attendeeCount: number;
};

type StatusFilter = 'All' | 'Open' | 'Closed';
type TypeFilter = 'All' | EventType;

export default function AdminReportsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('All');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadReports = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const [eventsResult, attendanceResult] = await Promise.all([
        supabase
          .from('events')
          .select(
            'id, event_code, title, start_time, end_time, venue, description, status, event_type, class_section, created_at'
          )
          .order('created_at', { ascending: false }),

        supabase.from('attendance').select('id, event_id'),
      ]);

      if (eventsResult.error) throw eventsResult.error;
      if (attendanceResult.error) throw attendanceResult.error;

      const events = (eventsResult.data ?? []) as EventItem[];
      const attendance = (attendanceResult.data ?? []) as AttendanceItem[];

      const attendanceCounts: Record<string, number> = {};

      attendance.forEach((record) => {
        attendanceCounts[record.event_id] =
          (attendanceCounts[record.event_id] ?? 0) + 1;
      });

      setReports(
        events.map((event) => ({
          ...event,
          attendeeCount: attendanceCounts[event.id] ?? 0,
        }))
      );
    } catch (error) {
      console.error('Error loading attendance reports:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load attendance reports.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadReports();
    }, [loadReports])
  );

  const getStatus = (status: string | null): 'Open' | 'Closed' =>
    (status ?? 'Open').toLowerCase() === 'closed' ? 'Closed' : 'Open';

  // Older events without event_type are treated as school events.
  const getEventType = (event: EventItem): EventType =>
    event.event_type === 'classroom' ? 'classroom' : 'school_event';

  const getEventTypeLabel = (event: EventItem) =>
    getEventType(event) === 'classroom'
      ? 'Classroom Attendance'
      : 'School Event Attendance';

  const typeReports = reports.filter(
    (event) => typeFilter === 'All' || getEventType(event) === typeFilter
  );

  const openEvents = typeReports.filter(
    (event) => getStatus(event.status) === 'Open'
  ).length;

  const closedEvents = typeReports.filter(
    (event) => getStatus(event.status) === 'Closed'
  ).length;

  const totalAttendance = typeReports.reduce(
    (total, event) => total + event.attendeeCount,
    0
  );

  const filteredReports = typeReports.filter((event) => {
    const searchText = search.trim().toLowerCase();

    const searchableText = [
      event.title,
      event.event_code,
      event.venue ?? '',
      event.class_section ?? '',
      getStatus(event.status),
      getEventTypeLabel(event),
    ]
      .join(' ')
      .toLowerCase();

    const matchesSearch = searchableText.includes(searchText);
    const matchesStatus =
      filter === 'All' || getStatus(event.status) === filter;

    return matchesSearch && matchesStatus;
  });

  const formatDate = (date: string | null) => {
    if (!date) return 'Not set';

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) return 'Not set';

    return parsedDate.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const openEventDetails = (eventId: string) => {
    router.push({
      pathname: '/admin-event-details',
      params: {
        id: eventId,
        source: 'reports',
      },
    });
  };

  return (
    <View style={styles.container}>
      <Header title="View Reports" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={styles.backButton}
          onPress={() => router.replace('/admin')}
        >
          <Ionicons
            name="arrow-back-outline"
            size={18}
            color={colors.primary}
          />
          <Text style={styles.backText}>Admin Dashboard</Text>
        </Pressable>

        <Text style={styles.pageTitle}>Attendance Reports</Text>

        <Text style={styles.subtitle}>
          View classroom attendance and school event attendance separately.
          Select a report to check its attendance details.
        </Text>

        {/* Attendance type filter */}
        <Text style={styles.filterHeading}>Attendance Type</Text>

        <View style={styles.typeFilterRow}>
          {(
            [
              { label: 'All Reports', value: 'All' },
              { label: 'Classroom', value: 'classroom' },
              { label: 'School Events', value: 'school_event' },
            ] as const
          ).map((item) => {
            const selected = typeFilter === item.value;

            return (
              <Pressable
                key={item.value}
                onPress={() => setTypeFilter(item.value)}
                style={[
                  styles.typeFilterButton,
                  selected && styles.filterButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    selected && styles.filterTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Summary cards follow the selected attendance type */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Ionicons
              name="calendar-outline"
              size={23}
              color={colors.primary}
            />
            <Text style={styles.summaryValue}>{typeReports.length}</Text>
            <Text style={styles.summaryLabel}>Total Reports</Text>
          </View>

          <View style={styles.summaryCard}>
            <Ionicons
              name="checkmark-circle-outline"
              size={23}
              color="#16804A"
            />
            <Text style={styles.summaryValue}>{openEvents}</Text>
            <Text style={styles.summaryLabel}>Open</Text>
          </View>

          <View style={styles.summaryCard}>
            <Ionicons
              name="close-circle-outline"
              size={23}
              color="#B42318"
            />
            <Text style={styles.summaryValue}>{closedEvents}</Text>
            <Text style={styles.summaryLabel}>Closed</Text>
          </View>

          <View style={styles.summaryCard}>
            <Ionicons
              name="people-outline"
              size={23}
              color={colors.primary}
            />
            <Text style={styles.summaryValue}>{totalAttendance}</Text>
            <Text style={styles.summaryLabel}>Attendance Entries</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons
            name="search-outline"
            size={20}
            color={colors.textSecondary}
          />

          <TextInput
            style={styles.searchInput}
            placeholder="Search title, code, class, or venue..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            returnKeyType="search"
          />

          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons
                name="close-circle"
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>
          )}
        </View>

        {/* Status filter */}
        <Text style={styles.filterHeading}>Event Status</Text>

        <View style={styles.filterRow}>
          {(['All', 'Open', 'Closed'] as const).map((item) => {
            const selected = filter === item;

            return (
              <Pressable
                key={item}
                onPress={() => setFilter(item)}
                style={[
                  styles.filterButton,
                  selected && styles.filterButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    selected && styles.filterTextActive,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeadingContainer}>
            <Text style={styles.sectionTitle}>Event Reports</Text>
            <Text style={styles.resultCount}>
              {filteredReports.length} report
              {filteredReports.length === 1 ? '' : 's'} found
            </Text>
          </View>

          <Pressable
            style={styles.refreshButton}
            onPress={() => void loadReports()}
            disabled={loading}
          >
            <Ionicons
              name="refresh-outline"
              size={17}
              color={colors.primary}
            />
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={styles.loader}
          />
        ) : errorMessage ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="alert-circle-outline"
              size={35}
              color={colors.danger}
            />
            <Text style={styles.emptyTitle}>Unable to Load Reports</Text>
            <Text style={styles.emptyText}>{errorMessage}</Text>

            <Pressable
              style={styles.primaryButton}
              onPress={() => void loadReports()}
            >
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </Pressable>
          </View>
        ) : filteredReports.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="document-text-outline"
              size={38}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyTitle}>No Reports Found</Text>
            <Text style={styles.emptyText}>
              {reports.length === 0
                ? 'No events are available for reporting yet.'
                : 'No reports match your selected attendance type, search, or status filter.'}
            </Text>
          </View>
        ) : (
          filteredReports.map((event) => {
            const status = getStatus(event.status);
            const closed = status === 'Closed';
            const isClassroom = getEventType(event) === 'classroom';

            return (
              <Pressable
                key={event.id}
                style={({ pressed }) => [
                  styles.eventCard,
                  pressed && styles.eventCardPressed,
                ]}
                onPress={() => openEventDetails(event.id)}
              >
                <View style={styles.eventHeading}>
                  <View style={styles.eventIcon}>
                    <Ionicons
                      name={
                        isClassroom
                          ? 'school-outline'
                          : 'calendar-outline'
                      }
                      size={22}
                      color={colors.primary}
                    />
                  </View>

                  <View style={styles.eventHeadingText}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventCode}>
                      Code: {event.event_code}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      closed ? styles.closedBadge : styles.openBadge,
                    ]}
                  >
                    <Text style={styles.statusText}>{status}</Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.typeBadge,
                    isClassroom
                      ? styles.classroomBadge
                      : styles.schoolEventBadge,
                  ]}
                >
                  <Ionicons
                    name={isClassroom ? 'school-outline' : 'people-outline'}
                    size={14}
                    color={isClassroom ? '#175CD3' : '#6941C6'}
                  />
                  <Text
                    style={[
                      styles.typeBadgeText,
                      isClassroom
                        ? styles.classroomBadgeText
                        : styles.schoolEventBadgeText,
                    ]}
                  >
                    {getEventTypeLabel(event)}
                  </Text>
                </View>

                {isClassroom && (
                  <View style={styles.eventInfo}>
                    <Ionicons
                      name="people-circle-outline"
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.eventInfoText}>
                      Class/Section: {event.class_section || 'Not specified'}
                    </Text>
                  </View>
                )}

                <View style={styles.eventInfo}>
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.eventInfoText}>
                    Start: {formatDate(event.start_time)}
                  </Text>
                </View>

                <View style={styles.eventInfo}>
                  <Ionicons
                    name="location-outline"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.eventInfoText}>
                    {event.venue || 'Venue not specified'}
                  </Text>
                </View>

                <View style={styles.eventFooter}>
                  <View style={styles.attendanceCount}>
                    <Ionicons
                      name="people-outline"
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={styles.attendanceCountText}>
                      {event.attendeeCount} attendance entries
                    </Text>
                  </View>

                  <View style={styles.viewReport}>
                    <Text style={styles.viewReportText}>View Report</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={17}
                      color={colors.primary}
                    />
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
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
      padding: 18,
      paddingBottom: 110,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: 10,
      marginBottom: 18,
    },
    backText: {
      color: colors.primary,
      fontWeight: '700',
    },
    pageTitle: {
      color: colors.textPrimary,
      fontSize: 25,
      fontWeight: '800',
      marginBottom: 6,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      marginBottom: 20,
    },
    filterHeading: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 9,
    },
    typeFilterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 18,
    },
    typeFilterButton: {
      flexGrow: 1,
      flexBasis: '30%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 11,
      paddingHorizontal: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.card,
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 20,
    },
    summaryCard: {
      width: '48%',
      flexGrow: 1,
      flexBasis: '40%',
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: 14,
      padding: 15,
      minHeight: 120,
    },
    summaryValue: {
      color: colors.textPrimary,
      fontSize: 27,
      fontWeight: '800',
      marginTop: 9,
    },
    summaryLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 3,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: 12,
      paddingHorizontal: 13,
      minHeight: 50,
      marginBottom: 18,
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      paddingVertical: 12,
      fontSize: 14,
      outlineStyle: 'none',
    } as any,
    filterRow: {
      flexDirection: 'row',
      gap: 9,
      marginBottom: 22,
    },
    filterButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.card,
    },
    filterButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
    },
    filterTextActive: {
      color: '#FFFFFF',
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
      gap: 8,
    },
    sectionHeadingContainer: {
      flex: 1,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 19,
      fontWeight: '800',
    },
    resultCount: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 3,
    },
    refreshButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      padding: 8,
    },
    refreshText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 13,
    },
    loader: {
      marginTop: 35,
    },
    eventCard: {
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: 16,
      padding: 16,
      marginBottom: 13,
    },
    eventCardPressed: {
      opacity: 0.75,
    },
    eventHeading: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 12,
    },
    eventIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eventHeadingText: {
      flex: 1,
    },
    eventTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 5,
    },
    eventCode: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    statusBadge: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 20,
    },
    openBadge: {
      backgroundColor: '#16804A',
    },
    closedBadge: {
      backgroundColor: '#B42318',
    },
    statusText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700',
    },
    typeBadge: {
      flexDirection: 'row',
      alignSelf: 'flex-start',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      marginBottom: 13,
    },
    classroomBadge: {
      backgroundColor: '#EFF8FF',
    },
    schoolEventBadge: {
      backgroundColor: '#F4F3FF',
    },
    typeBadgeText: {
      fontSize: 11,
      fontWeight: '800',
    },
    classroomBadgeText: {
      color: '#175CD3',
    },
    schoolEventBadgeText: {
      color: '#6941C6',
    },
    eventInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 9,
    },
    eventInfoText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 13,
    },
    eventFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 13,
      marginTop: 5,
    },
    attendanceCount: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    attendanceCountText: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    viewReport: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    viewReportText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '800',
    },
    emptyCard: {
      alignItems: 'center',
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: 16,
      padding: 25,
      marginTop: 5,
    },
    emptyTitle: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: '800',
      marginTop: 12,
      marginBottom: 6,
    },
    emptyText: {
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      fontSize: 13,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 11,
      borderRadius: 10,
      marginTop: 16,
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
  });
}
