
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { useTheme } from '@/app/contexts/ThemeContext';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  getAttendanceHistory,
  getStudentEventHistory,
  getTeacherEventSummary,
  getTeacherEventAttendees,
  getTeacherEventRoster,
  type AttendanceRecord,
  type StudentEventHistoryRecord,
  type TeacherEventSummary,
  type TeacherEventAttendee,
  type TeacherEventRoster,
  type TeacherRosterStudent,
} from '@/lib/attendance';
import { getUserRole } from '@/lib/role';
import type { Role } from '@/lib/profiles';
import { buildQRPayload } from '@/lib/qr';

type SavedEvent = {
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
};

type RosterFilter =
  | 'All'
  | 'Present'
  | 'Absent'
  | 'Not yet scanned'
  | 'Other Attendees';

type StudentFilter =
  | 'All'
  | 'Present'
  | 'Absent'
  | 'Upcoming'
  | 'Not yet scanned';

type EventTypeFilter = 'All' | 'classroom' | 'school_event';

const EVENT_TYPE_FILTERS: {
  label: string;
  value: EventTypeFilter;
}[] = [
  { label: 'All', value: 'All' },
  { label: 'Classroom', value: 'classroom' },
  { label: 'School Events', value: 'school_event' },
];

function getEventTypeLabel(eventType: string | null | undefined) {
  return eventType === 'classroom'
    ? 'CLASSROOM ATTENDANCE'
    : 'SCHOOL EVENT';
}

function matchesEventType(
  eventType: string | null | undefined,
  filter: EventTypeFilter
) {
  if (filter === 'All') return true;
  return (eventType ?? 'school_event') === filter;
}

/**
 * Displays approved profile photos from the Supabase "avatars" bucket.
 * Supports storage paths and existing HTTP/HTTPS image URLs.
 */
function ApprovedStudentAvatar({
  avatarUrl,
  status,
  size = 42,
}: {
  avatarUrl?: string | null;
  status?: string | null;
  size?: number;
}) {
  const { colors } = useTheme();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAvatar() {
      
      setImageUri(null);
      setImageFailed(false);
      

      const value = avatarUrl?.trim();

      console.log('AVATAR DEBUG:', { avatarUrl, status });

      if (!value || status?.trim().toLowerCase() !== 'approved') {
        return;
      }

      try {
        // Remove accidental quotes around the stored value.
        const cleanedValue = value
          .replace(/^[\s"'`]+|[\s"'`]+$/g, '');

        if (!cleanedValue) return;

        // Use an existing HTTP/HTTPS image URL directly.
        if (/^https?:\/\//i.test(cleanedValue)) {
          if (!cancelled) {
            setImageUri(cleanedValue);
          }
          return;
        }

        // Normalize a plain storage path.
        let storagePath = cleanedValue
          .split('?')[0]
          .trim()
          .replace(/^[\s"'`]+|[\s"'`]+$/g, '')
          .replace(/^\/+/, '')
          .replace(/^(public\/)?avatars\//i, '');

        try {
          storagePath = decodeURIComponent(storagePath);
          
const { data: userData } = await supabase.auth.getUser();

console.log('AVATAR ACCESS CHECK:', {
  currentUserId: userData.user?.id,
  avatarFolderId: storagePath.split('/')[0],
  isSameUser: userData.user?.id === storagePath.split('/')[0],
});

        } catch {
          console.error('Invalid avatar path encoding.');
          return;
        }

        if (
          !storagePath ||
          storagePath.includes('..') ||
          storagePath.includes('"') ||
          storagePath.includes("'")
        ) {
          console.error('Invalid avatar storage path:', storagePath);
          return;
        }

        console.log('AVATAR PATH CHECK:', {
          storagePath,
          bucket: 'avatars',
          pathLength: storagePath.length,
          firstCharCode: storagePath.charCodeAt(0),
          lastCharCode: storagePath.charCodeAt(storagePath.length - 1),
        });

        // Generate the signed URL only once.
        const { data, error } = await supabase.storage
          .from('avatars')
          .createSignedUrl(storagePath, 3600);

        console.log('AVATAR SIGN RESULT:', {
          signedUrlCreated: !!data?.signedUrl,
          error: error?.message,
        });

        if (error) {
          console.error('Avatar URL error:', error.message, storagePath);
          return;
        }

        if (!cancelled && data?.signedUrl) {
          setImageUri(data.signedUrl);
        }
      } catch (error) {
        console.error('Avatar loading error:', error);
      }
    }

    void loadAvatar();

    return () => {
      cancelled = true;
    };
  }, [avatarUrl, status]);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.card,
      }}
    >
      {imageUri && !imageFailed ? (
        <Image
          source={{ uri: imageUri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={() => {
            setImageFailed(true);
            console.error('Avatar image failed to display.');
          }}
        />
      ) : (
        <Text style={{ fontSize: size * 0.48 }}>👤</Text>
      )}
    </View>
  );
}

export default function HistoryScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { user } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [studentEvents, setStudentEvents] = useState<
    StudentEventHistoryRecord[]
  >([]);
  const [eventSummaries, setEventSummaries] = useState<
    TeacherEventSummary[]
  >([]);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [studentFilter, setStudentFilter] =
    useState<StudentFilter>('All');
  const [eventTypeFilter, setEventTypeFilter] =
    useState<EventTypeFilter>('All');


  const [selectedEvent, setSelectedEvent] = useState<SavedEvent | null>(
    null
  );
  const [qrPayload, setQrPayload] = useState('');
  const [loadingQR, setLoadingQR] = useState(false);

  const [attendees, setAttendees] = useState<TeacherEventAttendee[]>([]);
  const [selectedAttendeeEvent, setSelectedAttendeeEvent] =
    useState<TeacherEventSummary | null>(null);
  const [loadingAttendees, setLoadingAttendees] = useState(false);

  const [roster, setRoster] = useState<TeacherEventRoster | null>(null);
  const [selectedRosterEvent, setSelectedRosterEvent] =
    useState<TeacherEventSummary | null>(null);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>('All');

  const loadHistory = useCallback(
    async (showLoader = true) => {
      if (!user) {
        setRecords([]);
        setStudentEvents([]);
        setEventSummaries([]);
        setRole(null);
        setLoading(false);
        return;
      }

      if (showLoader) setLoading(true);

      try {
        const userRole = await getUserRole(user.id);
        setRole(userRole);

        if (userRole === 'teacher') {
          const summaries = await getTeacherEventSummary(user.id);
          setEventSummaries(summaries);
          setRecords([]);
          setStudentEvents([]);
        } else if (userRole === 'student') {
          const [rows, eventRows] = await Promise.all([
            getAttendanceHistory(user.id),
            getStudentEventHistory(user.id),
          ]);

          setRecords(rows);
          setStudentEvents(eventRows);
          setEventSummaries([]);
        } else {
          setRecords([]);
          setStudentEvents([]);
          setEventSummaries([]);
        }
      } catch (error) {
        console.error('Failed to load attendance history:', error);
        Alert.alert(
          'Unable to Load History',
          error instanceof Error
            ? error.message
            : 'Please check your connection and try again.'
        );
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [user]
  );

  useFocusEffect(
    useCallback(() => {
      void loadHistory(true);
    }, [loadHistory])
  );

  const handleRefresh = useCallback(async () => {
    if (refreshing || loading) return;

    setRefreshing(true);
    try {
      await loadHistory(false);
    } finally {
      setRefreshing(false);
    }
  }, [loadHistory, refreshing, loading]);

  const isTeacher = role === 'teacher';
  const isStudent = role === 'student';

  const filteredEventSummaries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return eventSummaries.filter((item) => {
      const matchesType = matchesEventType(item.eventType, eventTypeFilter);
      const matchesSearch = [
        item.title,
        item.eventCode,
        item.eventId,
        item.eventType,
        item.classSection,
      ].some((value) =>
        String(value ?? '').toLowerCase().includes(query)
      );

      return matchesType && matchesSearch;
    });
  }, [eventSummaries, searchQuery, eventTypeFilter]);

  const filteredStudentEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return studentEvents.filter((item) => {
      const matchesType = matchesEventType(item.eventType, eventTypeFilter);

      const matchesSearch = [
        item.eventTitle,
        item.eventCode,
        item.classSection,
        item.eventType,
        item.attendanceStatus,
        item.startTime ? formatDate(item.startTime) : '',
        item.endTime ? formatDate(item.endTime) : '',
        item.scannedAt ? formatDate(item.scannedAt) : '',
      ].some((value) =>
        String(value ?? '').toLowerCase().includes(query)
      );

      const matchesStatus =
        studentFilter === 'All' ||
        item.attendanceStatus === studentFilter;

      return matchesType && matchesSearch && matchesStatus;
    });
  }, [studentEvents, searchQuery, studentFilter, eventTypeFilter]);

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

  const rosterCounts = useMemo(() => {
    const students = roster?.students ?? [];

    return {
      total: students.length,
      present: students.filter((s) => s.status === 'Present').length,
      absent: students.filter((s) => s.status === 'Absent').length,
      notYetScanned: students.filter(
        (s) => s.status === 'Not yet scanned'
      ).length,
      otherAttendees: roster?.otherAttendees.length ?? 0,
    };
  }, [roster]);

  const studentCounts = useMemo(() => {
    const events = studentEvents.filter((event) =>
      matchesEventType(event.eventType, eventTypeFilter)
    );

    return {
      total: events.length,
      present: events.filter(
        (event) => event.attendanceStatus === 'Present'
      ).length,
      absent: events.filter(
        (event) => event.attendanceStatus === 'Absent'
      ).length,
      upcoming: events.filter(
        (event) => event.attendanceStatus === 'Upcoming'
      ).length,
      notYetScanned: events.filter(
        (event) => event.attendanceStatus === 'Not yet scanned'
      ).length,
    };
  }, [studentEvents, eventTypeFilter]);

  const teacherCounts = useMemo(() => {
    const events = eventSummaries.filter((event) =>
      matchesEventType(event.eventType, eventTypeFilter)
    );

    return {
      total: events.length,
      classroom: events.filter(
        (event) => event.eventType === 'classroom'
      ).length,
      schoolEvents: events.filter(
        (event) => (event.eventType ?? 'school_event') === 'school_event'
      ).length,
    };
  }, [eventSummaries, eventTypeFilter]);

  const attendanceRate =
    rosterCounts.total > 0
      ? Math.round((rosterCounts.present / rosterCounts.total) * 100)
      : 0;

  const totalRecords = isTeacher
    ? teacherCounts.total
    : studentCounts.total;

  const filteredCount = isTeacher
    ? filteredEventSummaries.length
    : filteredStudentEvents.length;

  const openAttendees = async (item: TeacherEventSummary) => {
    if (!user || loadingAttendees) return;

    setSelectedAttendeeEvent(item);
    setAttendees([]);
    setLoadingAttendees(true);

    try {
      const rows = await getTeacherEventAttendees(user.id, item.eventId);
      setAttendees(rows);
    } catch (error) {
      Alert.alert(
        'Unable to Load Attendees',
        error instanceof Error ? error.message : 'Please try again.'
      );
      setSelectedAttendeeEvent(null);
    } finally {
      setLoadingAttendees(false);
    }
  };

  const closeAttendees = () => {
    setSelectedAttendeeEvent(null);
    setAttendees([]);
  };

  const openRoster = async (item: TeacherEventSummary) => {
    if (!user || loadingRoster) return;

    setSelectedRosterEvent(item);
    setRoster(null);
    setRosterSearch('');
    setRosterFilter('All');
    setLoadingRoster(true);

    try {
      const result = await getTeacherEventRoster(user.id, item.eventId);
      setRoster(result);
    } catch (error) {
      Alert.alert(
        'Unable to Load Attendance Roster',
        error instanceof Error
          ? error.message
          : 'Please check your connection and try again.'
      );
      setSelectedRosterEvent(null);
    } finally {
      setLoadingRoster(false);
    }
  };

  const closeRoster = () => {
    setSelectedRosterEvent(null);
    setRoster(null);
    setRosterSearch('');
    setRosterFilter('All');
  };

  const openEventQR = async (item: TeacherEventSummary) => {
    if (!user || loadingQR) return;

    setLoadingQR(true);

    try {
      const { data, error } = await supabase
        .from('events')
        .select('event_code, title, start_time, end_time, venue')
        .eq('event_code', item.eventCode)
        .eq('created_by', user.id)
        .single();

      if (error || !data) {
        Alert.alert(
          'Unable to Open QR Code',
          'We could not retrieve this saved event. Please try again.'
        );
        return;
      }

      const savedEvent: SavedEvent = {
        event_code: data.event_code,
        title: data.title,
        start_time: data.start_time,
        end_time: data.end_time,
        venue: data.venue ?? null,
      };

      const payload = buildQRPayload({
        eventId: savedEvent.event_code,
        title: savedEvent.title,
        start: savedEvent.start_time ?? undefined,
        end: savedEvent.end_time ?? undefined,
      });

      setSelectedEvent(savedEvent);
      setQrPayload(payload);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Something went wrong while opening the event QR code.'
      );
    } finally {
      setLoadingQR(false);
    }
  };

  const closeQR = () => {
    setSelectedEvent(null);
    setQrPayload('');
  };

  const renderTeacherItem = ({
    item,
  }: {
    item: TeacherEventSummary;
  }) => (
    <View style={styles.card}>
      <Pressable
        onPress={() => openEventQR(item)}
        disabled={loadingQR}
        accessibilityRole="button"
        accessibilityLabel={`Open QR code for ${item.title}`}
      >
        <View style={styles.cardTop}>
          <View style={styles.iconBox}>
            <Text style={styles.iconText}>
              {item.eventType === 'classroom' ? 'CL' : 'EV'}
            </Text>
          </View>

          <View
            style={[
              styles.typeBadge,
              item.eventType === 'classroom'
                ? styles.classroomBadge
                : styles.schoolEventBadge,
            ]}
          >
            <Text
              style={[
                styles.typeBadgeText,
                item.eventType === 'classroom'
                  ? styles.classroomBadgeText
                  : styles.schoolEventBadgeText,
              ]}
            >
              {item.eventType === 'classroom'
                ? 'CLASSROOM'
                : 'SCHOOL EVENT'}
            </Text>
          </View>
        </View>

        <Text style={styles.eventTitle}>{item.title}</Text>

        {item.eventType === 'classroom' && item.classSection ? (
          <View style={styles.sectionInfo}>
            <Text style={styles.metaLabel}>CLASS / SECTION</Text>
            <Text style={styles.eventCode}>{item.classSection}</Text>
          </View>
        ) : null}

        <Text style={styles.metaLabel}>EVENT CODE</Text>
        <Text style={styles.eventCode}>{item.eventCode}</Text>

        <View style={styles.cardDivider} />

        <View style={styles.attendeeRow}>
          <View>
            <Text style={styles.metaLabel}>ATTENDANCE</Text>
            <Text style={styles.attendeeNumber}>{item.attendeeCount}</Text>
          </View>
          <View style={styles.attendeeBadge}>
            <Text style={styles.attendeeBadgeText}>
              {item.attendeeCount === 1 ? 'Attendee' : 'Attendees'}
            </Text>
          </View>
        </View>

        <View style={styles.openQRRow}>
          <Text style={styles.openQRText}>▦ Tap to reopen QR code</Text>
          <Text style={styles.openQRArrow}>›</Text>
        </View>
      </Pressable>

      <Pressable
        style={styles.viewAttendeesButton}
        onPress={() => openAttendees(item)}
        disabled={loadingAttendees || loadingRoster}
      >
        <Text style={styles.viewAttendeesButtonText}>
          View Present Attendees ({item.attendeeCount})
        </Text>
      </Pressable>

      <Pressable
        style={styles.viewRosterButton}
        onPress={() => openRoster(item)}
        disabled={loadingRoster || loadingAttendees}
      >
        <Text style={styles.viewRosterButtonText}>
          View Attendance Roster
        </Text>
      </Pressable>
    </View>
  );

  const renderStudentItem = ({
    item,
  }: {
    item: StudentEventHistoryRecord;
  }) => {
    const statusStyle =
      item.attendanceStatus === 'Present'
        ? styles.presentBadge
        : item.attendanceStatus === 'Absent'
          ? styles.absentBadge
          : item.attendanceStatus === 'Upcoming'
            ? styles.upcomingBadge
            : styles.notScannedBadge;

    const statusTextStyle =
      item.attendanceStatus === 'Present'
        ? styles.presentText
        : item.attendanceStatus === 'Absent'
          ? styles.absentText
          : item.attendanceStatus === 'Upcoming'
            ? styles.upcomingText
            : styles.notScannedText;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.iconBox}>
            <Text style={styles.iconText}>
              {item.eventType === 'classroom' ? 'CL' : 'QR'}
            </Text>
          </View>

          <View
            style={[
              styles.typeBadge,
              item.eventType === 'classroom'
                ? styles.classroomBadge
                : styles.schoolEventBadge,
            ]}
          >
            <Text
              style={[
                styles.typeBadgeText,
                item.eventType === 'classroom'
                  ? styles.classroomBadgeText
                  : styles.schoolEventBadgeText,
              ]}
            >
              {item.eventType === 'classroom'
                ? 'CLASSROOM'
                : 'SCHOOL EVENT'}
            </Text>
          </View>
        </View>

        <View style={styles.studentCardTitleRow}>
          <Text style={[styles.eventTitle, styles.studentEventTitle]}>
            {item.eventTitle}
          </Text>

          <View style={[styles.rosterStatusBadge, statusStyle]}>
            <Text style={[styles.rosterStatusText, statusTextStyle]}>
              {item.attendanceStatus.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.metaLabel}>EVENT CODE</Text>
        <Text style={styles.eventCode}>
          {item.eventCode || 'Not specified'}
        </Text>

        {item.classSection ? (
          <View style={styles.sectionInfo}>
            <Text style={styles.metaLabel}>TARGET CLASS / SECTION</Text>
            <Text style={styles.dateText}>{item.classSection}</Text>
          </View>
        ) : null}

        <View style={styles.cardDivider} />

        <Text style={styles.metaLabel}>
          {item.attendanceStatus === 'Present'
            ? 'ATTENDANCE RECORDED'
            : item.attendanceStatus === 'Absent'
              ? 'EVENT ENDED'
              : item.attendanceStatus === 'Upcoming'
                ? 'EVENT STARTS'
                : 'EVENT SCHEDULE'}
        </Text>

        <Text style={styles.dateText}>
          {item.attendanceStatus === 'Present' && item.scannedAt
            ? formatDate(item.scannedAt)
            : item.attendanceStatus === 'Absent'
              ? item.endTime
                ? formatDate(item.endTime)
                : 'Event closed'
              : item.startTime
                ? formatDate(item.startTime)
                : 'Schedule not specified'}
        </Text>

        {item.attendanceStatus === 'Absent' ? (
          <Text style={styles.statusHint}>
            You did not record attendance for this event.
          </Text>
        ) : item.attendanceStatus === 'Upcoming' ? (
          <Text style={styles.statusHint}>
            This event has not started yet.
          </Text>
        ) : item.attendanceStatus === 'Not yet scanned' ? (
          <Text style={styles.statusHint}>
            Attendance has not been recorded yet.
          </Text>
        ) : null}
      </View>
    );
  };

  const renderRosterStudent = ({
    item,
    index,
  }: {
    item: TeacherRosterStudent;
    index: number;
  }) => (
    <View style={styles.rosterStudentCard}>
      <View style={styles.attendeeIndex}>
        <Text style={styles.attendeeIndexText}>{index + 1}</Text>
      </View>

      <ApprovedStudentAvatar
  avatarUrl={item.avatarUrl}
  status={item.avatarStatus}
/>

      <View style={styles.rosterStudentDetails}>
        <Text style={styles.attendeeName}>{item.studentName}</Text>

        <Text style={styles.attendeeMeta}>
          Education: {formatEducationLevel(item.educationLevel)}
        </Text>

        {item.program ? (
          <Text style={styles.attendeeMeta}>
            Program/Strand: {item.program}
          </Text>
        ) : null}

        <Text style={styles.attendeeMeta}>
          Section/Block: {item.block || 'Not specified'}
        </Text>

        <Text style={styles.attendeeMeta}>
          Year Level: {item.yearLevel || 'Not specified'}
        </Text>

        {item.scannedAt ? (
          <Text style={styles.attendeeScanTime}>
            Scanned: {formatDate(item.scannedAt)}
          </Text>
        ) : null}

        <View
          style={[
            styles.rosterStatusBadge,
            item.status === 'Present'
              ? styles.presentBadge
              : item.status === 'Absent'
                ? styles.absentBadge
                : styles.notScannedBadge,
          ]}
        >
          <Text
            style={[
              styles.rosterStatusText,
              item.status === 'Present'
                ? styles.presentText
                : item.status === 'Absent'
                  ? styles.absentText
                  : styles.notScannedText,
            ]}
          >
            {rosterFilter === 'Other Attendees'
              ? 'OTHER ATTENDEE'
              : item.status.toUpperCase()}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.headerIcon}
          onPress={handleRefresh}
          disabled={refreshing || loading}
          accessibilityRole="button"
          accessibilityLabel="Refresh attendance history"
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.headerIconText}>↻</Text>
          )}
        </Pressable>

        <View style={styles.headerTextContainer}>
          <Text style={styles.eyebrow}>YOUR ACTIVITY</Text>
          <Text style={styles.title}>Attendance History</Text>
          <Text style={styles.subtitle}>
            {isTeacher
              ? 'Separate classroom records from school event attendance.'
              : 'View classroom attendance and school event records.'}
          </Text>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryLabel}>
            {isTeacher ? 'FILTERED EVENTS' : 'ELIGIBLE EVENTS'}
          </Text>
          <Text style={styles.summaryNumber}>
            {loading ? '—' : totalRecords}
          </Text>
          <Text style={styles.summaryCaption}>
            {isTeacher
              ? `${teacherCounts.classroom} classroom · ${teacherCounts.schoolEvents} school events`
              : 'Events relevant to you'}
          </Text>
        </View>

        <View style={styles.summaryIcon}>
          <Text style={styles.summaryIconText}>
            {isTeacher ? 'EV' : 'QR'}
          </Text>
        </View>
      </View>

      <View style={styles.typeFilterContainer}>
        <Text style={styles.filterHeading}>ATTENDANCE TYPE</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeFilterRow}
        >
          {EVENT_TYPE_FILTERS.map((filter) => {
            const selected = eventTypeFilter === filter.value;

            return (
              <Pressable
                key={filter.value}
                onPress={() => setEventTypeFilter(filter.value)}
                style={[
                  styles.typeFilterButton,
                  selected && styles.typeFilterButtonSelected,
                ]}
              >
                <Text
                  style={[
                    styles.typeFilterButtonText,
                    selected && styles.typeFilterButtonTextSelected,
                  ]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {isStudent && !loading && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.studentSummaryScroll}
          contentContainerStyle={styles.studentSummaryRow}
        >
          {(
            [
              ['All', studentCounts.total],
              ['Present', studentCounts.present],
              ['Absent', studentCounts.absent],
              ['Upcoming', studentCounts.upcoming],
              ['Not yet scanned', studentCounts.notYetScanned],
            ] as [StudentFilter, number][]
          ).map(([filter, count]) => {
            const selected = studentFilter === filter;

            return (
              <Pressable
                key={filter}
                onPress={() => setStudentFilter(filter)}
                style={[
                  styles.studentFilterCard,
                  selected && styles.studentFilterCardSelected,
                ]}
              >
                <Text
                  style={[
                    styles.studentFilterNumber,
                    selected && styles.studentFilterTextSelected,
                  ]}
                >
                  {count}
                </Text>

                <Text
                  style={[
                    styles.studentFilterLabel,
                    selected && styles.studentFilterTextSelected,
                  ]}
                >
                  {filter}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeadingText}>
          <Text style={styles.sectionTitle}>
            {isTeacher ? 'Your Events' : 'Your Records'}
          </Text>
          <Text style={styles.sectionSubtitle}>
            {isTeacher
              ? 'Open QR codes, view attendees, and check rosters'
              : 'Filter by event type and attendance status'}
          </Text>
        </View>

        {!loading && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{filteredCount}</Text>
          </View>
        )}
      </View>

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>⌕</Text>

        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={
            isTeacher
              ? 'Search title, code, or section...'
              : 'Search event, section, or status...'
          }
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search attendance history"
        />

        {searchQuery.length > 0 && (
          <Pressable
            onPress={() => setSearchQuery('')}
            style={styles.clearButton}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Text style={styles.clearButtonText}>×</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.emptyTitle}>Loading history</Text>
          <Text style={styles.emptyText}>
            Please wait while we retrieve your records.
          </Text>
        </View>
      ) : !isTeacher && !isStudent ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Unable to load history</Text>
          <Text style={styles.emptyText}>
            We could not determine your account role.
          </Text>
        </View>
      ) : filteredCount === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBox}>
            <Text style={styles.emptyIcon}>QR</Text>
          </View>

          <Text style={styles.emptyTitle}>
            {searchQuery
              ? 'No matching results'
              : isTeacher
                ? 'No events found'
                : studentFilter === 'Absent'
                  ? 'No missed events'
                  : 'No events found'}
          </Text>

          <Text style={styles.emptyText}>
            {searchQuery
              ? 'Try another search term or change your filters.'
              : eventTypeFilter === 'classroom'
                ? 'No classroom attendance records are available for this filter.'
                : eventTypeFilter === 'school_event'
                  ? 'No school event records are available for this filter.'
                  : 'Relevant attendance records will appear here when available.'}
          </Text>

          {(searchQuery ||
            eventTypeFilter !== 'All' ||
            studentFilter !== 'All') && (
            <Pressable
              style={styles.resetSearchButton}
              onPress={() => {
                setSearchQuery('');
                setEventTypeFilter('All');
                setStudentFilter('All');
              }}
            >
              <Text style={styles.resetSearchText}>Reset Filters</Text>
            </Pressable>
          )}
        </View>
      ) : isTeacher ? (
        <FlatList<TeacherEventSummary>
          data={filteredEventSummaries}
          keyExtractor={(item) => String(item.eventId)}
          renderItem={renderTeacherItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <FlatList<StudentEventHistoryRecord>
          data={filteredStudentEvents}
          keyExtractor={(item) => String(item.eventId)}
          renderItem={renderStudentItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Present attendees modal */}
      <Modal
        visible={!!selectedAttendeeEvent}
        transparent
        animationType="fade"
        onRequestClose={closeAttendees}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.listModalCard]}>
            <Pressable
              style={styles.modalCloseButton}
              onPress={closeAttendees}
            >
              <Text style={styles.modalCloseText}>×</Text>
            </Pressable>

            <View style={styles.listModalContent}>
              <Text style={styles.modalEyebrow}>EVENT ATTENDANCE</Text>
              <Text style={styles.modalTitle}>
                {selectedAttendeeEvent?.title ?? 'Attendees'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {loadingAttendees
                  ? 'Retrieving attendance records...'
                  : `${attendees.length} student(s) recorded attendance`}
              </Text>

              {loadingAttendees ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : (
                <FlatList<TeacherEventAttendee>
                  data={attendees}
                  keyExtractor={(item) => item.id}
                  style={styles.modalList}
                  renderItem={({ item, index }) => (
                    <View style={styles.attendeeCard}>
                      <View style={styles.attendeeIndex}>
                        <Text style={styles.attendeeIndexText}>
                          {index + 1}
                        </Text>
                      </View>

                      <ApprovedStudentAvatar
  avatarUrl={item.avatarUrl}
  status={item.avatarStatus}
/>

                      <View style={styles.attendeeDetails}>
                        <Text style={styles.attendeeName}>
                          {item.studentName}
                        </Text>
                        <Text style={styles.attendeeMeta}>
                          Education: {formatEducationLevel(item.educationLevel)}
                        </Text>
                        <Text style={styles.attendeeMeta}>
                          Section/Block: {item.block || 'Not specified'}
                        </Text>
                        <Text style={styles.attendeeMeta}>
                          Year Level: {item.yearLevel || 'Not specified'}
                        </Text>
                        <Text style={styles.attendeeScanTime}>
                          Scanned: {formatDate(item.scannedAt)}
                        </Text>
                      </View>
                    </View>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>No attendees yet.</Text>
                  }
                />
              )}

              <Pressable style={styles.doneButton} onPress={closeAttendees}>
                <Text style={styles.doneButtonText}>Close Attendee List</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full attendance roster modal */}
      <Modal
        visible={!!selectedRosterEvent}
        transparent
        animationType="fade"
        onRequestClose={closeRoster}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.rosterModalCard]}>
            <Pressable
              style={styles.modalCloseButton}
              onPress={closeRoster}
            >
              <Text style={styles.modalCloseText}>×</Text>
            </Pressable>

            <View style={styles.rosterModalContent}>
              <Text style={styles.modalEyebrow}>FULL ATTENDANCE ROSTER</Text>
              <Text style={styles.modalTitle}>
                {selectedRosterEvent?.title ?? 'Attendance Roster'}
              </Text>

              {loadingRoster ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : roster ? (
                <>
                  <Text style={styles.modalSubtitle}>
                    {roster.eventType === 'classroom'
                      ? `Class section: ${roster.classSection || 'Not specified'}`
                      : 'School event'}
                  </Text>

                  <View style={styles.rosterSummaryGrid}>
                    {[
                      ['TOTAL', rosterCounts.total],
                      ['PRESENT', rosterCounts.present],
                      ['ABSENT', rosterCounts.absent],
                      ['PENDING', rosterCounts.notYetScanned],
                    ].map(([label, count]) => (
                      <View
                        key={String(label)}
                        style={styles.rosterSummaryCard}
                      >
                        <Text style={styles.rosterSummaryNumber}>
                          {count}
                        </Text>
                        <Text style={styles.rosterSummaryLabel}>
                          {label}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {roster.eventType === 'classroom' && (
                    <Pressable
                      onPress={() => setRosterFilter('Other Attendees')}
                      style={styles.otherAttendeesSummary}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.attendeeName}>
                          Other Attendees
                        </Text>
                        <Text style={styles.attendeeMeta}>
                          Students outside the target section who scanned
                        </Text>
                      </View>
                      <Text style={styles.otherAttendeesSummaryNumber}>
                        {rosterCounts.otherAttendees}
                      </Text>
                    </Pressable>
                  )}

                  <View style={styles.rateContainer}>
                    <Text style={styles.rateLabel}>Attendance rate</Text>
                    <Text style={styles.rateValue}>{attendanceRate}%</Text>
                  </View>

                  <View style={styles.searchContainer}>
                    <Text style={styles.searchIcon}>⌕</Text>
                    <TextInput
                      style={styles.searchInput}
                      value={rosterSearch}
                      onChangeText={setRosterSearch}
                      placeholder="Search students..."
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterScroll}
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
                    ).map((filter) => (
                      <Pressable
                        key={filter}
                        onPress={() => setRosterFilter(filter)}
                        style={[
                          styles.filterButton,
                          rosterFilter === filter &&
                            styles.filterButtonSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterButtonText,
                            rosterFilter === filter &&
                              styles.filterButtonTextSelected,
                          ]}
                        >
                          {filter}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <Text style={styles.rosterResultCount}>
                    Showing {filteredRoster.length} student(s)
                  </Text>

                  <FlatList<TeacherRosterStudent>
                    data={filteredRoster}
                    keyExtractor={(item) => item.id}
                    renderItem={renderRosterStudent}
                    style={styles.rosterList}
                    nestedScrollEnabled
                    ListEmptyComponent={
                      <Text style={styles.emptyText}>
                        No students found for this filter.
                      </Text>
                    }
                  />
                </>
              ) : (
                <Text style={styles.emptyText}>Roster unavailable.</Text>
              )}

              <Pressable style={styles.doneButton} onPress={closeRoster}>
                <Text style={styles.doneButtonText}>
                  Close Attendance Roster
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reopened event QR modal */}
      <Modal
        visible={!!selectedEvent && !!qrPayload}
        transparent
        animationType="fade"
        onRequestClose={closeQR}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Pressable style={styles.modalCloseButton} onPress={closeQR}>
              <Text style={styles.modalCloseText}>×</Text>
            </Pressable>

            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.modalEyebrow}>EVENT ATTENDANCE</Text>
              <Text style={styles.modalTitle}>{selectedEvent?.title}</Text>
              <Text style={styles.modalSubtitle}>
                Let students scan this code to record attendance.
              </Text>

              <View style={styles.qrContainer}>
                {qrPayload ? (
                  <QRCode
                    value={qrPayload}
                    size={220}
                    backgroundColor="#FFFFFF"
                    color="#102044"
                    ecl="H"
                  />
                ) : null}
              </View>

              <Text style={styles.modalCodeLabel}>EVENT CODE</Text>
              <Text style={styles.modalCode}>
                {selectedEvent?.event_code}
              </Text>

              <Text style={styles.venueLabel}>EVENT VENUE</Text>
              <Text style={styles.venueValue}>
                {selectedEvent?.venue || 'No venue specified'}
              </Text>

              <View style={styles.modalDivider} />

              <Text style={styles.dateText}>
                Starts:{' '}
                {selectedEvent?.start_time
                  ? formatDate(selectedEvent.start_time)
                  : 'Not specified'}
              </Text>
              <Text style={styles.dateText}>
                Ends:{' '}
                {selectedEvent?.end_time
                  ? formatDate(selectedEvent.end_time)
                  : 'Not specified'}
              </Text>

              <Pressable style={styles.doneButton} onPress={closeQR}>
                <Text style={styles.doneButtonText}>Close QR Code</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {loadingQR && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Opening event QR code...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function formatEducationLevel(level: string | null | undefined) {
  if (!level) return 'Not specified';

  const normalized = level.trim().toLowerCase();

  if (normalized === 'shs' || normalized === 'senior high school') {
    return 'Senior High School';
  }

  if (normalized === 'college') return 'College';

  return level;
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

function createStyles(
  colors: ReturnType<typeof useTheme>['colors']
) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 18,
    },
    headerIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: 'rgba(71,125,255,0.16)',
      borderWidth: 1,
      borderColor: colors.glassBorder,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 13,
    },
    headerIconText: { fontSize: 29, color: colors.primary },
    headerTextContainer: { flex: 1 },
    eyebrow: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 2,
      color: colors.primary,
      marginBottom: 4,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 18,
      marginTop: 4,
    },
    summaryCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: 22,
      padding: 18,
      marginBottom: 14,
    },
    summaryLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.5,
      color: colors.textSecondary,
    },
    summaryNumber: {
      fontSize: 34,
      fontWeight: '800',
      color: colors.textPrimary,
      marginTop: 5,
    },
    summaryCaption: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    summaryIcon: {
      width: 56,
      height: 56,
      borderRadius: 19,
      backgroundColor: 'rgba(71,125,255,0.18)',
      borderWidth: 1,
      borderColor: colors.glassBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    summaryIconText: {
      fontSize: 16,
      fontWeight: '900',
      color: colors.primary,
    },
    typeFilterContainer: { marginBottom: 14 },
    filterHeading: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.4,
      color: colors.textSecondary,
      marginBottom: 9,
    },
    typeFilterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 2,
    },
    typeFilterButton: {
      paddingHorizontal: 15,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glass,
    },
    typeFilterButtonSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    typeFilterButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    typeFilterButtonTextSelected: { color: colors.textOnPrimary },
    studentSummaryScroll: {
      flexGrow: 0,
      flexShrink: 0,
      width: '100%',
      marginBottom: 18,
      overflow: 'visible',
    },
    studentSummaryRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 8,
      paddingVertical: 3,
      paddingHorizontal: 1,
    },
    studentFilterCard: {
      width: 105,
      minHeight: 78,
      borderRadius: 13,
      paddingVertical: 12,
      paddingHorizontal: 8,
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    studentFilterCardSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    studentFilterNumber: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '900',
      color: colors.textPrimary,
      includeFontPadding: false,
      textAlign: 'center',
    },
    studentFilterLabel: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '700',
      color: colors.textSecondary,
      marginTop: 5,
      textAlign: 'center',
      flexShrink: 0,
    },
    studentFilterTextSelected: { color: colors.textOnPrimary },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    sectionHeadingText: { flex: 1 },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    sectionSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    countBadge: {
      minWidth: 32,
      height: 32,
      paddingHorizontal: 8,
      borderRadius: 12,
      backgroundColor: 'rgba(71,125,255,0.16)',
      borderWidth: 1,
      borderColor: colors.glassBorder,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 10,
    },
    countBadgeText: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.primary,
    },
    searchContainer: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: 15,
      paddingHorizontal: 12,
      marginBottom: 14,
    },
    searchIcon: {
      fontSize: 25,
      color: colors.primary,
      marginRight: 9,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 12,
      fontSize: 13,
      color: colors.textPrimary,
    },
    clearButton: {
      width: 30,
      height: 30,
      borderRadius: 10,
      backgroundColor: 'rgba(71,125,255,0.14)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    clearButtonText: { fontSize: 23, color: colors.primary },
    list: { paddingBottom: 30 },
    card: {
      backgroundColor: colors.glass,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: 17,
      marginBottom: 13,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
      gap: 8,
    },
    iconBox: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: 'rgba(71,125,255,0.16)',
      borderWidth: 1,
      borderColor: colors.glassBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconText: {
      fontSize: 13,
      fontWeight: '900',
      color: colors.primary,
    },
    typeBadge: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 10,
      maxWidth: '75%',
    },
    classroomBadge: { backgroundColor: 'rgba(71,125,255,0.14)' },
    schoolEventBadge: { backgroundColor: 'rgba(56,217,169,0.12)' },
    typeBadgeText: {
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.5,
    },
    classroomBadgeText: { color: colors.primary },
    schoolEventBadgeText: { color: colors.success },
    eventTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 13,
    },
    studentCardTitleRow: { gap: 8, marginBottom: 5 },
    studentEventTitle: { marginBottom: 4 },
    metaLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.2,
      color: colors.textSecondary,
      marginBottom: 5,
    },
    sectionInfo: { marginBottom: 12 },
    eventCode: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    cardDivider: {
      height: 1,
      backgroundColor: colors.glassBorder,
      marginVertical: 14,
    },
    attendeeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    attendeeNumber: {
      fontSize: 25,
      fontWeight: '800',
      color: colors.success,
    },
    attendeeBadge: {
      backgroundColor: 'rgba(56,217,169,0.10)',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    attendeeBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.success,
    },
    openQRRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 17,
      paddingTop: 13,
      borderTopWidth: 1,
      borderTopColor: colors.glassBorder,
    },
    openQRText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    openQRArrow: { fontSize: 26, color: colors.primary },
    viewAttendeesButton: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 13,
      marginTop: 15,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    viewAttendeesButtonText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textOnPrimary,
      textAlign: 'center',
    },
    viewRosterButton: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 13,
      marginTop: 9,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    viewRosterButtonText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.primary,
      textAlign: 'center',
    },
    dateText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
      lineHeight: 20,
    },
    statusHint: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
      marginTop: 10,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingBottom: 40,
    },
    emptyIconBox: {
      width: 64,
      height: 64,
      borderRadius: 22,
      backgroundColor: 'rgba(71,125,255,0.13)',
      borderWidth: 1,
      borderColor: colors.glassBorder,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    emptyIcon: {
      fontSize: 22,
      fontWeight: '900',
      color: colors.primary,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
      marginTop: 10,
    },
    emptyText: {
      fontSize: 13,
      lineHeight: 20,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 7,
    },
    resetSearchButton: {
      marginTop: 16,
      backgroundColor: colors.primary,
      paddingHorizontal: 18,
      paddingVertical: 11,
      borderRadius: 12,
    },
    resetSearchText: {
      color: colors.textOnPrimary,
      fontSize: 12,
      fontWeight: '800',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    modalCard: {
      width: '100%',
      maxWidth: 420,
      maxHeight: '92%',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: 24,
      overflow: 'hidden',
    },
    listModalCard: { height: '85%' },
    rosterModalCard: { height: '92%' },
    modalCloseButton: {
      position: 'absolute',
      top: 10,
      right: 10,
      zIndex: 2,
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.glass,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalCloseText: { fontSize: 27, color: colors.textPrimary },
    listModalContent: {
      flex: 1,
      minHeight: 0,
      paddingTop: 50,
      paddingHorizontal: 18,
      paddingBottom: 15,
    },
    modalEyebrow: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 2,
      color: colors.primary,
      textAlign: 'center',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
      marginTop: 8,
    },
    modalSubtitle: {
      fontSize: 12,
      lineHeight: 19,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 8,
      marginBottom: 15,
    },
    modalList: {
      flex: 1,
      minHeight: 0,
      marginTop: 8,
    },
    attendeeCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: 14,
      padding: 12,
      marginBottom: 9,
    },
    attendeeIndex: {
      width: 32,
      height: 32,
      borderRadius: 11,
      backgroundColor: 'rgba(71,125,255,0.16)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
      flexShrink: 0,
    },
    attendeeIndexText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.primary,
    },
    attendeeDetails: { flex: 1, minWidth: 0 },
    attendeeName: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 5,
    },
    attendeeMeta: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
      marginBottom: 3,
    },
    attendeeScanTime: {
      fontSize: 11,
      lineHeight: 17,
      fontWeight: '600',
      color: colors.primary,
      marginTop: 4,
    },
    doneButton: {
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 46,
      backgroundColor: colors.primary,
      borderRadius: 13,
      marginTop: 14,
      flexShrink: 0,
    },
    doneButtonText: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.textOnPrimary,
    },
    rosterModalContent: {
      flex: 1,
      minHeight: 0,
      paddingTop: 50,
      paddingHorizontal: 15,
      paddingBottom: 14,
    },
    rosterSummaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
      marginBottom: 10,
    },
    rosterSummaryCard: {
      flexGrow: 1,
      flexBasis: '22%',
      minWidth: 60,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    rosterSummaryNumber: {
      fontSize: 20,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    rosterSummaryLabel: {
      fontSize: 9,
      fontWeight: '800',
      color: colors.textSecondary,
      marginTop: 4,
    },
    otherAttendeesSummary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      marginBottom: 10,
    },
    otherAttendeesSummaryNumber: {
      fontSize: 21,
      fontWeight: '900',
      color: colors.primary,
      marginLeft: 10,
    },
    rateContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 11,
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: 12,
      marginBottom: 10,
    },
    rateLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    rateValue: {
      fontSize: 17,
      fontWeight: '900',
      color: colors.primary,
    },
    filterScroll: {
      flexGrow: 0,
      marginBottom: 8,
    },
    filterButton: {
      paddingHorizontal: 11,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glass,
      marginRight: 6,
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
    filterButtonTextSelected: { color: colors.textOnPrimary },
    rosterResultCount: {
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: 7,
    },
    rosterList: {
      flex: 1,
      minHeight: 0,
    },
    rosterStudentCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: 14,
      padding: 11,
      marginBottom: 8,
    },
    rosterStudentDetails: { flex: 1, minWidth: 0 },
    rosterStatusBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 8,
      marginTop: 7,
    },
    presentBadge: { backgroundColor: 'rgba(56,217,169,0.12)' },
    absentBadge: { backgroundColor: 'rgba(255,100,100,0.12)' },
    notScannedBadge: { backgroundColor: 'rgba(245,183,64,0.13)' },
    upcomingBadge: { backgroundColor: 'rgba(71,125,255,0.14)' },
    rosterStatusText: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.4,
    },
    presentText: { color: colors.success },
    absentText: { color: '#E65B5B' },
    notScannedText: { color: '#C58B18' },
    upcomingText: { color: colors.primary },
    modalContent: {
      alignItems: 'center',
      paddingHorizontal: 22,
      paddingTop: 50,
      paddingBottom: 22,
    },
    qrContainer: {
      width: 260,
      height: 260,
      maxWidth: '100%',
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 18,
      marginVertical: 18,
    },
    modalCodeLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.5,
      color: colors.textSecondary,
      marginTop: 6,
    },
    modalCode: {
      fontSize: 17,
      fontWeight: '900',
      color: colors.primary,
      marginTop: 6,
      textAlign: 'center',
    },
    venueLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.5,
      color: colors.textSecondary,
      marginTop: 16,
      marginBottom: 5,
    },
    venueValue: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    modalDivider: {
      height: 1,
      backgroundColor: colors.glassBorder,
      alignSelf: 'stretch',
      marginVertical: 16,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    loadingCard: {
      backgroundColor: colors.background,
      borderRadius: 18,
      paddingHorizontal: 24,
      paddingVertical: 22,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    loadingText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 12,
    },
  });
}
