
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/app/contexts/ThemeContext';

type AttendanceRow = {
  id: string;
  student_id: string;
  event_id: string;
  scanned_at: string;
  studentName: string;
  educationLevel: string;
  program: string;
  block: string;
  yearLevel: string;
  eventTitle: string;
  eventCode: string;
};

type ProfileInfo = {
  id: string;
  full_name: string | null;
  education_level: string | null;
  program: string | null;
  block: string | null;
  year_level: string | null;
};

function formatEducationLevel(value: string | null | undefined) {
  const level = (value ?? '').trim();

  if (!level) return 'Not specified';

  const normalized = level.toLowerCase();

  if (
    normalized === 'shs' ||
    normalized === 'senior high' ||
    normalized === 'senior high school'
  ) {
    return 'Senior High School';
  }

  if (
    normalized === 'college' ||
    normalized === 'college level'
  ) {
    return 'College';
  }

  return level;
}

function HighlightedText({
  text,
  search,
  style,
  highlightedStyle,
}: {
  text: string;
  search: string;
  style?: any;
  highlightedStyle?: any;
}) {
  const term = search.trim();

  if (!term) {
    return <Text style={style}>{text}</Text>;
  }

  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escapedTerm})`, 'gi'));

  return (
    <Text style={style}>
      {parts.map((part, index) => {
        const matched = part.toLowerCase() === term.toLowerCase();

        return (
          <Text
            key={`${index}-${part}`}
            style={matched ? highlightedStyle : undefined}
          >
            {part}
          </Text>
        );
      })}
    </Text>
  );
}

export default function AdminAttendanceScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const { data: attendanceData, error: attendanceError } =
        await supabase
          .from('attendance')
          .select(`
            id,
            student_id,
            event_id,
            scanned_at,
            events (
              title,
              event_code
            )
          `)
          .order('scanned_at', { ascending: false });

      if (attendanceError) throw attendanceError;

      const attendanceRows = attendanceData ?? [];

      if (attendanceRows.length === 0) {
        setRecords([]);
        return;
      }

      const studentIds = [
        ...new Set(
          attendanceRows.map((item) => item.student_id).filter(Boolean)
        ),
      ];

      const { data: profilesData, error: profilesError } =
        await supabase
          .from('profiles')
          .select(
            'id, full_name, education_level, program, block, year_level'
          )
          .in('id', studentIds);

      if (profilesError) throw profilesError;

      const profiles = (profilesData ?? []) as ProfileInfo[];

      const profileMap = new Map(
        profiles.map((profile) => [profile.id, profile])
      );

      const formattedRecords: AttendanceRow[] = attendanceRows.map(
        (item: any) => {
          const profile = profileMap.get(item.student_id);
          const event = Array.isArray(item.events)
            ? item.events[0]
            : item.events;

          return {
            id: item.id,
            student_id: item.student_id,
            event_id: item.event_id,
            scanned_at: item.scanned_at,
            studentName: profile?.full_name || 'Unknown Student',
            educationLevel: formatEducationLevel(
              profile?.education_level
            ),
            program: profile?.program || 'Not specified',
            block: profile?.block || 'Not specified',
            yearLevel: profile?.year_level || 'Not specified',
            eventTitle: event?.title || 'Unknown Event',
            eventCode: event?.event_code || 'N/A',
          };
        }
      );

      setRecords(formattedRecords);
    } catch (error: any) {
      console.error('Error loading attendance:', error);
      setErrorMessage(
        error?.message || 'Unable to load attendance records.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAttendance();
    }, [loadAttendance])
  );

  const normalizedSearch = search.trim().toLowerCase();

  const filteredRecords = records.filter((record) => {
    const searchableFields = [
      record.studentName,
      record.student_id,
      record.program,
      record.educationLevel,
      record.block,
      record.yearLevel,
      record.eventTitle,
      record.eventCode,
    ];

    return searchableFields.some((field) =>
      field.toLowerCase().includes(normalizedSearch)
    );
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) return dateString;

    return date.toLocaleString();
  };

  return (
    <View style={styles.container}>
      <Header title="Attendance Records" />

      <View style={styles.content}>
        <Pressable
          style={styles.backButton}
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace('/')
          }
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </Pressable>

        <Text style={styles.title}>View Attendance</Text>

        <Text style={styles.subtitle}>
          Search by student name, program, section, year level, or event.
        </Text>

        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>⌕</Text>

          <TextInput
            style={styles.searchInput}
            placeholder="Search student or section..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />

          {search.length > 0 && (
            <Pressable
              onPress={() => setSearch('')}
              style={styles.clearButton}
            >
              <Text style={styles.clearButtonText}>×</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.resultCount}>
          {normalizedSearch
            ? `${filteredRecords.length} matching record(s)`
            : `${records.length} attendance record(s)`}
        </Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>
              Loading attendance records...
            </Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{errorMessage}</Text>

            <Pressable
              style={styles.retryButton}
              onPress={loadAttendance}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={filteredRecords}
            keyExtractor={(item) => item.id}
            contentContainerStyle={
              filteredRecords.length === 0
                ? styles.emptyList
                : styles.listContent
            }
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.studentName}>
                  <HighlightedText
                    text={item.studentName}
                    search={search}
                    highlightedStyle={styles.highlightedText}
                  />
                </Text>

                <View style={styles.divider} />

                <InfoRow
                  label="Student ID"
                  value={item.student_id}
                  search={search}
                  colors={colors}
                  styles={styles}
                />

                <InfoRow
                  label="Education Level"
                  value={item.educationLevel}
                  search={search}
                  colors={colors}
                  styles={styles}
                />

                <InfoRow
                  label="Program"
                  value={item.program}
                  search={search}
                  colors={colors}
                  styles={styles}
                />

                <InfoRow
                  label="Year Level"
                  value={item.yearLevel}
                  search={search}
                  colors={colors}
                  styles={styles}
                />

                <InfoRow
                  label="Block / Section"
                  value={item.block}
                  search={search}
                  colors={colors}
                  styles={styles}
                />

                <InfoRow
                  label="Event"
                  value={item.eventTitle}
                  search={search}
                  colors={colors}
                  styles={styles}
                />

                <InfoRow
                  label="Event Code"
                  value={item.eventCode}
                  search={search}
                  colors={colors}
                  styles={styles}
                />

                <View style={styles.dateContainer}>
                  <Text style={styles.dateLabel}>Scanned At</Text>
                  <Text style={styles.dateValue}>
                    {formatDate(item.scanned_at)}
                  </Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>
                  No attendance records found
                </Text>
                <Text style={styles.emptySubtitle}>
                  Try another name, program, or section.
                </Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}

function InfoRow({
  label,
  value,
  search,
  colors,
  styles,
}: {
  label: string;
  value: string;
  search: string;
  colors: ReturnType<typeof useTheme>['colors'];
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>

      <View style={styles.infoValueContainer}>
        <HighlightedText
          text={value}
          search={search}
          style={styles.infoValue}
          highlightedStyle={styles.highlightedText}
        />
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      width: '100%',
      maxWidth: 900,
      alignSelf: 'center',
      paddingHorizontal: 18,
      paddingTop: 12,
    },
    backButton: {
      alignSelf: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 4,
      marginBottom: 8,
    },
    backButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    title: {
      fontSize: 25,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 5,
      marginBottom: 16,
      lineHeight: 20,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      minHeight: 50,
    },
    searchIcon: {
      fontSize: 24,
      color: colors.textSecondary,
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.textPrimary,
      paddingVertical: 12,
      outlineStyle: 'none',
    } as any,
    clearButton: {
      width: 30,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clearButtonText: {
      fontSize: 25,
      color: colors.textSecondary,
    },
    resultCount: {
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: 12,
      marginBottom: 10,
    },
    listContent: {
      paddingBottom: 28,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      elevation: 2,
    },
    studentName: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 12,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginBottom: 8,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingVertical: 6,
      gap: 12,
    },
    infoLabel: {
      color: colors.textSecondary,
      fontSize: 13,
      flex: 1,
    },
    infoValueContainer: {
      flex: 1.5,
      alignItems: 'flex-end',
    },
    infoValue: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'right',
    },
    highlightedText: {
      fontWeight: '900',
      color: colors.primary,
       backgroundColor: colors.surfaceLight,
    },
    dateContainer: {
      marginTop: 10,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    dateLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      marginBottom: 4,
    },
    dateValue: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '600',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    loadingText: {
      marginTop: 10,
      color: colors.textSecondary,
      fontSize: 14,
    },
    errorText: {
      color: colors.danger,
      textAlign: 'center',
      fontSize: 14,
    },
    retryButton: {
      marginTop: 14,
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
    },
    retryButtonText: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    emptyList: {
      flexGrow: 1,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 28,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 6,
      textAlign: 'center',
    },
  });
}
