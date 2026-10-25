
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import QRCode from 'react-native-qrcode-svg';

import Header from '@/components/Header';
import { useTheme } from '@/app/contexts/ThemeContext';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { buildQRPayload } from '@/lib/qr';
import { getUserRole } from '@/lib/role';
import {
  getAdminEventRoster,
  type TeacherEventRoster,
  type TeacherRosterStudent,
} from '@/lib/attendance';

type EventInfo = {
  id: string;
  title: string;
  event_code: string;
  start_time: string;
  end_time: string;
  venue: string | null;
  description: string | null;
  status: string | null;
};

type StudentAttendance = {
  id: string;
  student_id: string;
  scanned_at: string;
  studentName: string;
  program: string;
  educationLevel: string;
  yearLevel: string;
  block: string;
  avatarUrl: string | null;
  avatarStatus: string | null;
};

type RosterFilter =
  | 'All'
  | 'Present'
  | 'Absent'
  | 'Not yet scanned'
  | 'Other Attendees';

type StudentProfile = {
  id: string;
  full_name: string | null;
  program: string | null;
  education_level: string | null;
  year_level: string | null;
  block: string | null;
  avatar_url: string | null;
  avatar_status: string | null;
};

export default function AdminEventDetailsScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    id?: string | string[];
    source?: string | string[];
  }>();

  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const source = Array.isArray(params.source)
    ? params.source[0]
    : params.source;

  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { user } = useAuth();

  const [event, setEvent] = useState<EventInfo | null>(null);
  const [attendance, setAttendance] = useState<StudentAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [roster, setRoster] = useState<TeacherEventRoster | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState('');
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterFilter, setRosterFilter] =
    useState<RosterFilter>('All');

  const goBack = useCallback(() => {
    if (source === 'reports') {
      router.replace('/admin-reports');
      return;
    }

    router.replace('/admin-events');
  }, [router, source]);

  const loadDetails = useCallback(async () => {
    if (!id) {
      setError('Event ID is missing.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    setRosterError('');

    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select(
          'id, title, event_code, start_time, end_time, venue, description, status'
        )
        .eq('id', id)
        .single();

      if (eventError) throw eventError;

      setEvent(eventData as EventInfo);

      const { data: attendanceData, error: attendanceError } =
        await supabase
          .from('attendance')
          .select('id, student_id, scanned_at')
          .eq('event_id', id)
          .order('scanned_at', { ascending: false });

      if (attendanceError) throw attendanceError;

      const rows = attendanceData ?? [];
      const studentIds = [
        ...new Set(rows.map((row) => row.student_id).filter(Boolean)),
      ];

      let profileMap = new Map<string, StudentProfile>();

      if (studentIds.length > 0) {
        const { data: profiles, error: profilesError } =
          await supabase
            .from('profiles')
            .select(
              'id, full_name, program, education_level, year_level, block, avatar_url, avatar_status'
            )
            .in('id', studentIds);

        if (profilesError) throw profilesError;

        profileMap = new Map(
          ((profiles ?? []) as StudentProfile[]).map((profile) => [
            profile.id,
            profile,
          ])
        );
      }

      setAttendance(
        rows.map((row) => {
          const profile = profileMap.get(row.student_id);

          return {
            id: row.id,
            student_id: row.student_id,
            scanned_at: row.scanned_at,
            studentName: profile?.full_name || 'Unknown Student',
            program: profile?.program || 'Not specified',
            educationLevel:
              profile?.education_level || 'Not specified',
            yearLevel: profile?.year_level || 'Not specified',
            block: profile?.block || 'Not specified',
            avatarUrl: profile?.avatar_url ?? null,
            avatarStatus: profile?.avatar_status ?? null,
          };
        })
      );

      if (!user?.id) {
        setRoster(null);
      } else {
        const userRole = await getUserRole(user.id);

        if (userRole !== 'admin') {
          setRoster(null);
          setRosterError(
            'Only an admin account can view the full attendance roster.'
          );
        } else {
          try {
            setRosterLoading(true);

            const rosterData = await getAdminEventRoster(id);
            setRoster(rosterData);
          } catch (rosterLoadError) {
            console.error(
              'Load admin attendance roster error:',
              rosterLoadError
            );

            setRoster(null);
            setRosterError(
              rosterLoadError instanceof Error
                ? rosterLoadError.message
                : 'Unable to load the full attendance roster.'
            );
          } finally {
            setRosterLoading(false);
          }
        }
      }
    } catch (err: unknown) {
      console.error('Load event details error:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load event details.'
      );
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadDetails();
    }, [loadDetails])
  );

  const formatDateTime = (value: string) => {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleString();
  };

  const status = event?.status || 'Open';
  const closed = status.toLowerCase() === 'closed';

  const rosterCounts = useMemo(() => {
    const students = roster?.students ?? [];

    return {
      total: students.length,
      present: students.filter(
        (student) => student.status === 'Present'
      ).length,
      absent: students.filter(
        (student) => student.status === 'Absent'
      ).length,
      notYetScanned: students.filter(
        (student) => student.status === 'Not yet scanned'
      ).length,
      otherAttendees: roster?.otherAttendees.length ?? 0,
    };
  }, [roster]);

  const attendanceRate =
    rosterCounts.total > 0
      ? Math.round(
          (rosterCounts.present / rosterCounts.total) * 100
        )
      : 0;

  const filteredRoster = useMemo(() => {
    if (!roster) return [];

    const query = rosterSearch.trim().toLowerCase();

    const sourceStudents =
      rosterFilter === 'Other Attendees'
        ? roster.otherAttendees
        : roster.students;

    return sourceStudents.filter((student) => {
      const matchesSearch = [
        student.studentName,
        student.educationLevel,
        student.program,
        student.block,
        student.yearLevel,
      ].some((value) =>
        String(value ?? '').toLowerCase().includes(query)
      );

      const matchesStatus =
        rosterFilter === 'All' ||
        rosterFilter === 'Other Attendees' ||
        student.status === rosterFilter;

      return matchesSearch && matchesStatus;
    });
  }, [roster, rosterSearch, rosterFilter]);

  const handleRefresh = () => {
    setRosterSearch('');
    setRosterFilter('All');
    void loadDetails();
  };

  const renderRosterStudent = (
    student: TeacherRosterStudent,
    index: number
  ) => {
    const isPresent = student.status === 'Present';
    const isAbsent = student.status === 'Absent';
    const isOther = rosterFilter === 'Other Attendees';

    return (
      <View
        key={`${student.id}-${index}`}
        style={styles.studentCard}
      >
        <View style={styles.studentHeading}>
          <View style={styles.studentIdentity}>
            <StudentAvatar
              path={'avatarUrl' in student ? student.avatarUrl : null}
              status={
                'avatarStatus' in student ? student.avatarStatus : null
              }
            />

            <View style={styles.studentIdentityText}>
              <Text style={styles.studentName}>
                {student.studentName || 'Unknown Student'}
              </Text>

              <View
                style={[
                  styles.rosterBadge,
                  isOther
                    ? styles.otherBadge
                    : isPresent
                      ? styles.presentBadge
                      : isAbsent
                        ? styles.absentBadge
                        : styles.pendingBadge,
                ]}
              >
                <Text
                  style={[
                    styles.rosterBadgeText,
                    isOther
                      ? styles.otherBadgeText
                      : isPresent
                        ? styles.presentBadgeText
                        : isAbsent
                          ? styles.absentBadgeText
                          : styles.pendingBadgeText,
                  ]}
                >
                  {isOther
                    ? 'OTHER ATTENDEE'
                    : student.status.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <Info
          label="Education Level"
          value={student.educationLevel || 'Not specified'}
          colors={colors}
        />
        <Info
          label="Program / Strand"
          value={student.program || 'Not specified'}
          colors={colors}
        />
        <Info
          label="Year Level"
          value={student.yearLevel || 'Not specified'}
          colors={colors}
        />
        <Info
          label="Block / Section"
          value={student.block || 'Not specified'}
          colors={colors}
        />

        {student.scannedAt ? (
          <Info
            label="Scanned At"
            value={formatDateTime(student.scannedAt)}
            colors={colors}
          />
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Event Details" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={styles.backButton} onPress={goBack}>
          <Text style={styles.backText}>
            {source === 'reports'
              ? '‹ Back to Reports'
              : '‹ Back to Events'}
          </Text>
        </Pressable>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={styles.loader}
          />
        ) : error ? (
          <View style={styles.card}>
            <Text style={styles.error}>{error}</Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => void loadDetails()}
            >
              <Text style={styles.retryText}>Try Again</Text>
            </Pressable>
          </View>
        ) : event ? (
          <>
            <View style={styles.card}>
              <View style={styles.headingRow}>
                <Text style={styles.title}>{event.title}</Text>

                <View
                  style={[
                    styles.badge,
                    closed ? styles.closedBadge : styles.openBadge,
                  ]}
                >
                  <Text style={styles.badgeText}>{status}</Text>
                </View>
              </View>

              <Text style={styles.code}>
                Event Code: {event.event_code}
              </Text>

              <Info
                label="Venue"
                value={event.venue || 'Not specified'}
                colors={colors}
              />
              <Info
                label="Start"
                value={formatDateTime(event.start_time)}
                colors={colors}
              />
              <Info
                label="End"
                value={formatDateTime(event.end_time)}
                colors={colors}
              />
              <Info
                label="Description"
                value={event.description || 'No description provided.'}
                colors={colors}
              />

              <View style={styles.divider} />

              <Text style={styles.sectionTitle}>Event QR Code</Text>

              <View style={styles.qrContainer}>
                <QRCode
                  value={buildQRPayload({
                    eventId: event.event_code,
                    title: event.title,
                    start: event.start_time,
                    end: event.end_time,
                  })}
                  size={220}
                />
              </View>

              <Text style={styles.muted}>
                Students can scan this QR code to record their attendance.
              </Text>

              <View style={styles.divider} />

              <Text style={styles.sectionTitle}>Attendance Summary</Text>
              <Text style={styles.total}>{attendance.length}</Text>
              <Text style={styles.muted}>
                Recorded attendance entries
              </Text>
            </View>

            <View style={styles.rosterHeader}>
              <Text style={styles.sectionTitle}>Attendance Roster</Text>
              <Text style={styles.muted}>
                Expected students and their attendance status
              </Text>
            </View>

            {rosterLoading ? (
              <View style={styles.card}>
                <ActivityIndicator
                  size="large"
                  color={colors.primary}
                />
                <Text style={styles.muted}>
                  Loading attendance roster...
                </Text>
              </View>
            ) : rosterError ? (
              <View style={styles.card}>
                <Text style={styles.error}>{rosterError}</Text>
                <Pressable
                  style={styles.retryButton}
                  onPress={() => void loadDetails()}
                >
                  <Text style={styles.retryText}>Try Again</Text>
                </Pressable>
              </View>
            ) : roster ? (
              <>
                <View style={styles.card}>
                  <Text style={styles.rosterContext}>
                    {roster.eventType === 'classroom'
                      ? `Class section: ${roster.classSection || 'Not specified'}`
                      : 'School event'}
                  </Text>

                  <View style={styles.statsGrid}>
                    <View style={styles.statBox}>
                      <Text style={styles.statNumber}>
                        {rosterCounts.total}
                      </Text>
                      <Text style={styles.statLabel}>TOTAL</Text>
                    </View>

                    <View style={[styles.statBox, styles.presentStatBox]}>
                      <Text
                        style={[
                          styles.statNumber,
                          styles.presentBadgeText,
                        ]}
                      >
                        {rosterCounts.present}
                      </Text>
                      <Text style={styles.statLabel}>PRESENT</Text>
                    </View>

                    <View style={[styles.statBox, styles.absentStatBox]}>
                      <Text
                        style={[
                          styles.statNumber,
                          styles.absentBadgeText,
                        ]}
                      >
                        {rosterCounts.absent}
                      </Text>
                      <Text style={styles.statLabel}>ABSENT</Text>
                    </View>

                    <View style={[styles.statBox, styles.pendingStatBox]}>
                      <Text
                        style={[
                          styles.statNumber,
                          styles.pendingBadgeText,
                        ]}
                      >
                        {rosterCounts.notYetScanned}
                      </Text>
                      <Text style={styles.statLabel}>PENDING</Text>
                    </View>
                  </View>

                  <View style={styles.rateContainer}>
                    <Text style={styles.rateLabel}>
                      Class Attendance Rate
                    </Text>
                    <Text style={styles.rateValue}>
                      {attendanceRate}%
                    </Text>
                  </View>

                  <Text style={styles.muted}>
                    The attendance rate is calculated using only the expected
                    students in the roster.
                  </Text>
                </View>

                {roster.eventType === 'classroom' ? (
                  <Pressable
                    style={styles.otherAttendeesCard}
                    onPress={() => setRosterFilter('Other Attendees')}
                  >
                    <View style={styles.otherAttendeesText}>
                      <Text style={styles.otherAttendeesTitle}>
                        Other Attendees
                      </Text>
                      <Text style={styles.muted}>
                        Students from other sections who scanned this event's
                        QR code
                      </Text>
                    </View>

                    <Text style={styles.otherAttendeesCount}>
                      {rosterCounts.otherAttendees}
                    </Text>
                  </Pressable>
                ) : null}

                <View style={styles.searchContainer}>
                  <Text style={styles.searchIcon}>⌕</Text>

                  <TextInput
                    style={styles.searchInput}
                    value={rosterSearch}
                    onChangeText={setRosterSearch}
                    placeholder="Search name, program, or section..."
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                  />

                  {rosterSearch.length > 0 ? (
                    <Pressable
                      onPress={() => setRosterSearch('')}
                      style={styles.clearButton}
                    >
                      <Text style={styles.clearButtonText}>×</Text>
                    </Pressable>
                  ) : null}
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.filterScroll}
                  contentContainerStyle={styles.filterContainer}
                >
                  {(
                    [
                      'All',
                      'Present',
                      'Absent',
                      'Not yet scanned',
                      ...(roster.eventType === 'classroom'
                        ? ['Other Attendees']
                        : []),
                    ] as RosterFilter[]
                  ).map((item) => {
                    const selected = rosterFilter === item;

                    return (
                      <Pressable
                        key={item}
                        onPress={() => setRosterFilter(item)}
                        style={[
                          styles.filterButton,
                          selected && styles.filterButtonSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterButtonText,
                            selected && styles.filterButtonTextSelected,
                          ]}
                        >
                          {item}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Text style={styles.resultCount}>
                  {rosterFilter === 'Other Attendees'
                    ? `Showing ${filteredRoster.length} of ${rosterCounts.otherAttendees} other attendee(s)`
                    : `Showing ${filteredRoster.length} of ${rosterCounts.total} expected student(s)`}
                </Text>

                {filteredRoster.length === 0 ? (
                  <View style={styles.card}>
                    <Text style={styles.emptyTitle}>
                      {rosterFilter === 'Other Attendees'
                        ? 'No other attendees'
                        : 'No students found'}
                    </Text>
                    <Text style={styles.muted}>
                      {rosterFilter === 'Other Attendees'
                        ? "Students outside the target section who scan the event QR code will appear here."
                        : 'Try another search term or attendance filter.'}
                    </Text>
                  </View>
                ) : (
                  filteredRoster.map((student, index) =>
                    renderRosterStudent(student, index)
                  )
                )}
              </>
            ) : (
              <View style={styles.card}>
                <Text style={styles.muted}>
                  The attendance roster is not available for this event.
                </Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>
              Students Who Attended
            </Text>

            {attendance.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.muted}>
                  No attendance records have been recorded for this event.
                </Text>
              </View>
            ) : (
              attendance.map((student) => (
                <View key={student.id} style={styles.studentCard}>
                  <View style={styles.attendanceStudentHeading}>
                    <StudentAvatar
                      path={student.avatarUrl}
                      status={student.avatarStatus}
                    />

                    <View style={styles.attendanceStudentInfo}>
                      <Text style={styles.studentName}>
                        {student.studentName}
                      </Text>
                      <Text style={styles.muted}>
                        {student.program}
                      </Text>
                    </View>
                  </View>

                  <Info
                    label="Student ID"
                    value={student.student_id}
                    colors={colors}
                  />
                  <Info
                    label="Program"
                    value={student.program}
                    colors={colors}
                  />
                  <Info
                    label="Education Level"
                    value={student.educationLevel}
                    colors={colors}
                  />
                  <Info
                    label="Year Level"
                    value={student.yearLevel}
                    colors={colors}
                  />
                  <Info
                    label="Block / Section"
                    value={student.block}
                    colors={colors}
                  />
                  <Info
                    label="Scanned At"
                    value={formatDateTime(student.scanned_at)}
                    colors={colors}
                  />
                </View>
              ))
            )}

            <Pressable
              style={styles.refreshButton}
              onPress={handleRefresh}
            >
              <Text style={styles.refreshText}>Refresh Details</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function StudentAvatar({
  path,
  status,
}: {
  path: string | null | undefined;
  status: string | null | undefined;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    const loadAvatar = async () => {
      setImageUrl(null);
      setFailed(false);

      if (!path?.trim() || status !== 'approved') return;

      try {
        const cleanPath = path.trim().replace(/^\/+/, '');

        const { data, error } = await supabase.storage
          .from('avatars')
          .createSignedUrl(cleanPath, 3600);

        if (error) throw error;

        if (active && data?.signedUrl) {
          setImageUrl(data.signedUrl);
        }
      } catch (err) {
        console.error('Unable to load student avatar:', err);
        if (active) setFailed(true);
      }
    };

    void loadAvatar();

    return () => {
      active = false;
    };
  }, [path, status]);

  return (
    <View style={avatarStyles.container}>
      {imageUrl && !failed && status === 'approved' ? (
        <Image
          source={{ uri: imageUrl }}
          style={avatarStyles.image}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={avatarStyles.placeholder}>👤</Text>
      )}
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  container: {
    width: 54,
    height: 54,
    borderRadius: 27,
    overflow: 'hidden',
    backgroundColor: '#E7EDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 27,
  },
  placeholder: {
    fontSize: 27,
  },
});

function Info({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const styles = createStyles(colors);

  return (
    <View style={styles.infoRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
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
      padding: 18,
      paddingBottom: 40,
    },
    backButton: {
      alignSelf: 'flex-start',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: 10,
      padding: 12,
      marginBottom: 16,
    },
    backText: {
      color: colors.primary,
      fontWeight: '700',
    },
    loader: {
      marginTop: 40,
    },
    card: {
      backgroundColor: colors.glass,
      padding: 18,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      marginBottom: 18,
    },
    headingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 10,
    },
    title: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 23,
      fontWeight: '800',
    },
    code: {
      color: colors.primary,
      marginTop: 8,
      marginBottom: 14,
      fontWeight: '600',
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
    },
    openBadge: {
      backgroundColor: '#16804A',
    },
    closedBadge: {
      backgroundColor: '#B42318',
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 7,
    },
    label: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 13,
    },
    value: {
      flex: 1.5,
      textAlign: 'right',
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '600',
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 14,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 19,
      fontWeight: '800',
      marginBottom: 12,
    },
    qrContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
      padding: 16,
      borderRadius: 12,
      marginVertical: 12,
    },
    total: {
      color: colors.primary,
      fontSize: 32,
      fontWeight: '800',
    },
    muted: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    studentCard: {
      backgroundColor: colors.glass,
      borderRadius: 14,
      padding: 15,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      marginBottom: 10,
    },
    studentHeading: {
      gap: 8,
      marginBottom: 8,
    },
    studentIdentity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    studentIdentityText: {
      flex: 1,
    },
    attendanceStudentHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 10,
    },
    attendanceStudentInfo: {
      flex: 1,
    },
    studentName: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 8,
    },
    error: {
      color: colors.danger,
      lineHeight: 20,
    },
    retryButton: {
      backgroundColor: colors.primary,
      padding: 12,
      borderRadius: 8,
      alignSelf: 'flex-start',
      marginTop: 12,
    },
    retryText: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    refreshButton: {
      backgroundColor: colors.primary,
      padding: 15,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 8,
    },
    refreshText: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    rosterHeader: {
      marginBottom: 14,
    },
    rosterContext: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 14,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 14,
    },
    statBox: {
      flexGrow: 1,
      flexBasis: '22%',
      minWidth: 62,
      paddingVertical: 12,
      paddingHorizontal: 5,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    presentStatBox: {
      backgroundColor: 'rgba(56, 217, 169, 0.10)',
    },
    absentStatBox: {
      backgroundColor: 'rgba(255, 100, 100, 0.10)',
    },
    pendingStatBox: {
      backgroundColor: 'rgba(245, 183, 64, 0.12)',
    },
    statNumber: {
      fontSize: 22,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    statLabel: {
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.4,
      color: colors.textSecondary,
      marginTop: 4,
    },
    rateContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 13,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      marginBottom: 10,
    },
    rateLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    rateValue: {
      fontSize: 20,
      fontWeight: '900',
      color: colors.primary,
    },
    otherAttendeesCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 15,
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: 14,
      marginBottom: 14,
    },
    otherAttendeesText: {
      flex: 1,
      paddingRight: 10,
    },
    otherAttendeesTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 5,
    },
    otherAttendeesCount: {
      fontSize: 24,
      fontWeight: '900',
      color: colors.primary,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 48,
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: 13,
      paddingHorizontal: 12,
      marginBottom: 10,
    },
    searchIcon: {
      fontSize: 25,
      color: colors.primary,
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 12,
      color: colors.textPrimary,
      fontSize: 13,
    },
    clearButton: {
      width: 28,
      height: 28,
      borderRadius: 9,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clearButtonText: {
      fontSize: 22,
      color: colors.primary,
    },
    filterScroll: {
      flexGrow: 0,
      marginBottom: 10,
    },
    filterContainer: {
      flexDirection: 'row',
      gap: 7,
      paddingVertical: 2,
    },
    filterButton: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glass,
    },
    filterButtonSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterButtonText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    filterButtonTextSelected: {
      color: colors.textOnPrimary,
    },
    resultCount: {
      color: colors.textSecondary,
      fontSize: 12,
      marginBottom: 10,
    },
    rosterBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 9,
      marginBottom: 8,
    },
    rosterBadgeText: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.4,
    },
    presentBadge: {
      backgroundColor: 'rgba(56, 217, 169, 0.13)',
    },
    presentBadgeText: {
      color: colors.success,
    },
    absentBadge: {
      backgroundColor: 'rgba(255, 100, 100, 0.12)',
    },
    absentBadgeText: {
      color: '#E65B5B',
    },
    pendingBadge: {
      backgroundColor: 'rgba(245, 183, 64, 0.14)',
    },
    pendingBadgeText: {
      color: '#C58B18',
    },
    otherBadge: {
      backgroundColor: 'rgba(71, 125, 255, 0.14)',
    },
    otherBadgeText: {
      color: colors.primary,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 7,
    },
  });
}
