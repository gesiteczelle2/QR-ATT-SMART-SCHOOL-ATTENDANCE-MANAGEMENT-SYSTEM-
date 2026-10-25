import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import QRCode from 'react-native-qrcode-svg';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { useTheme } from '@/app/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { buildQRPayload } from '@/lib/qr';

type EventType = 'classroom' | 'school_event';
type EventFilter = 'All' | 'Open' | 'Closed';
type EventTypeFilter = 'All' | EventType;

type EventItem = {
  id: string;
  event_code: string;
  title: string;
  start_time: string;
  end_time: string;
  venue: string | null;
  description: string | null;
  status: string | null;
  created_by: string | null;
  created_at: string;
  event_type: string | null;
  class_section: string | null;
};

const EVENT_COLUMNS =
  'id, event_code, title, start_time, end_time, venue, description, status, created_by, created_at, event_type, class_section';

const formatDateForDisplay = (date: Date) =>
  `${String(date.getMonth() + 1).padStart(2, '0')}/${String(
    date.getDate()
  ).padStart(2, '0')}/${date.getFullYear()}`;

const getLocalDatePart = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const formatTimeForInput = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes()
  ).padStart(2, '0')}`;
};

const toTimestamp = (time: string, datePart: string) => {
  const trimmedTime = time.trim();

  if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(trimmedTime)) {
    throw new Error(
      'Enter time in 24-hour format, for example 08:00 or 14:30.'
    );
  }

  const normalizedTime =
    trimmedTime.length === 5 ? `${trimmedTime}:00` : trimmedTime;

  return `${datePart}T${normalizedTime}+08:00`;
};

const getEventStatus = (status: string | null): 'Open' | 'Closed' =>
  status?.toLowerCase() === 'closed' ? 'Closed' : 'Open';

const getEventType = (eventType: string | null): EventType =>
  eventType?.toLowerCase() === 'classroom' ? 'classroom' : 'school_event';

const getEventTypeLabel = (eventType: string | null) =>
  getEventType(eventType) === 'classroom'
    ? 'Classroom Attendance'
    : 'School Event Attendance';

export default function AdminEventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const scrollViewRef = useRef<ScrollView>(null);
  const qrSectionY = useRef(0);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const [searchText, setSearchText] = useState('');
  const [eventFilter, setEventFilter] = useState<EventFilter>('All');
  const [eventTypeFilter, setEventTypeFilter] =
    useState<EventTypeFilter>('All');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [qrEvent, setQrEvent] = useState<EventItem | null>(null);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [pickerTarget, setPickerTarget] = useState<
    'date' | 'start' | 'end'
  >('date');

  const [title, setTitle] = useState('');
  const [eventCode, setEventCode] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');

  const [selectedEventType, setSelectedEventType] =
    useState<EventType>('school_event');
  const [classSection, setClassSection] = useState('');

  const scrollToQR = useCallback(() => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, qrSectionY.current - 12),
        animated: true,
      });
    });
  }, []);

  useEffect(() => {
    if (qrEvent) {
      scrollToQR();
    }
  }, [qrEvent, scrollToQR]);

  const loadEvents = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('events')
        .select(EVENT_COLUMNS)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('LOAD EVENTS ERROR:', error);
        Alert.alert('Unable to Load Events', error.message);
        return;
      }

      setEvents((data ?? []) as EventItem[]);
    } catch (err: any) {
      console.error('LOAD EVENTS EXCEPTION:', err);
      Alert.alert('Error', err?.message ?? 'Unable to load events.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadEvents();
    }, [loadEvents])
  );

  const filteredEvents = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return events.filter((event) => {
      const matchesSearch = [
        event.title,
        event.event_code,
        event.venue ?? '',
        event.status ?? '',
        event.description ?? '',
        event.class_section ?? '',
        getEventTypeLabel(event.event_type),
      ].some((value) => value.toLowerCase().includes(query));

      const matchesStatus =
        eventFilter === 'All' ||
        getEventStatus(event.status) === eventFilter;

      const matchesType =
        eventTypeFilter === 'All' ||
        getEventType(event.event_type) === eventTypeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [events, searchText, eventFilter, eventTypeFilter]);

  const filterCounts = useMemo(
    () => ({
      All: events.length,
      Open: events.filter(
        (event) => getEventStatus(event.status) === 'Open'
      ).length,
      Closed: events.filter(
        (event) => getEventStatus(event.status) === 'Closed'
      ).length,
    }),
    [events]
  );

  const eventTypeCounts = useMemo(
    () => ({
      All: events.length,
      classroom: events.filter(
        (event) => getEventType(event.event_type) === 'classroom'
      ).length,
      school_event: events.filter(
        (event) => getEventType(event.event_type) === 'school_event'
      ).length,
    }),
    [events]
  );

  const clearForm = () => {
    setTitle('');
    setEventCode('');
    setSelectedDate(new Date());
    setStartTime('');
    setEndTime('');
    setVenue('');
    setDescription('');
    setSelectedEventType('school_event');
    setClassSection('');
    setEditingId(null);
    setShowDateTimePicker(false);
  };

  const validateForm = () => {
    if (
      !title.trim() ||
      !eventCode.trim() ||
      !startTime.trim() ||
      !endTime.trim() ||
      !venue.trim()
    ) {
      Alert.alert(
        'Missing Information',
        'Please fill in the event title, event code, start time, end time, and venue.'
      );
      return false;
    }

    if (
      selectedEventType === 'classroom' &&
      !classSection.trim()
    ) {
      Alert.alert(
        'Missing Class Section',
        'Please enter the class section for classroom attendance.'
      );
      return false;
    }

    try {
      const start = new Date(
        toTimestamp(startTime, getLocalDatePart(selectedDate))
      );
      const end = new Date(
        toTimestamp(endTime, getLocalDatePart(selectedDate))
      );

      if (end <= start) {
        Alert.alert(
          'Invalid Time',
          'The end time must be later than the start time.'
        );
        return false;
      }
    } catch (err: any) {
      Alert.alert(
        'Invalid Time',
        err?.message ?? 'Please check the start and end times.'
      );
      return false;
    }

    return true;
  };

  const handleCreateEvent = async () => {
    if (saving) return;

    if (!user) {
      Alert.alert('Login Required', 'Please sign in again.');
      return;
    }

    if (!validateForm()) return;

    setSaving(true);

    try {
      const eventData = {
        title: title.trim(),
        event_code: eventCode.trim(),
        start_time: toTimestamp(
          startTime,
          getLocalDatePart(selectedDate)
        ),
        end_time: toTimestamp(
          endTime,
          getLocalDatePart(selectedDate)
        ),
        venue: venue.trim(),
        description: description.trim() || null,
        event_type: selectedEventType,
        class_section:
          selectedEventType === 'classroom'
            ? classSection.trim()
            : null,
        status: 'Open',
        created_by: user.id,
      };

      const { data, error } = await supabase
        .from('events')
        .insert(eventData)
        .select(EVENT_COLUMNS)
        .single();

      if (error) {
        console.error('CREATE EVENT ERROR:', error);
        Alert.alert('Create Event Failed', error.message);
        return;
      }

      if (data) {
        const createdEvent = data as EventItem;

        setEvents((previous) => [
          createdEvent,
          ...previous.filter((event) => event.id !== createdEvent.id),
        ]);

        setQrEvent(createdEvent);
      } else {
        await loadEvents();
      }

      clearForm();
      setShowForm(false);

      if (Platform.OS === 'web') {
        window.alert(
          'Event created successfully. Your event QR code is ready.'
        );
      } else {
        Alert.alert('Success', 'Event created successfully.');
      }
    } catch (err: any) {
      console.error('CREATE EVENT EXCEPTION:', err);
      Alert.alert(
        'Create Event Failed',
        err?.message ?? 'Something went wrong while creating the event.'
      );
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (event: EventItem) => {
    setEditingId(event.id);
    setTitle(event.title);
    setEventCode(event.event_code);
    setStartTime(formatTimeForInput(event.start_time));
    setEndTime(formatTimeForInput(event.end_time));
    setSelectedEventType(getEventType(event.event_type));
    setClassSection(event.class_section ?? '');

    const eventDate = new Date(event.start_time);
    setSelectedDate(
      Number.isNaN(eventDate.getTime()) ? new Date() : eventDate
    );

    setVenue(event.venue ?? '');
    setDescription(event.description ?? '');
    setShowDateTimePicker(false);
    setShowForm(true);
    setQrEvent(null);
  };

  const handleUpdateEvent = async () => {
    if (saving || !editingId) return;

    if (!user) {
      Alert.alert('Login Required', 'Please sign in again.');
      return;
    }

    if (!validateForm()) return;

    setSaving(true);

    try {
      const { data, error } = await supabase
        .from('events')
        .update({
          title: title.trim(),
          event_code: eventCode.trim(),
          start_time: toTimestamp(
            startTime,
            getLocalDatePart(selectedDate)
          ),
          end_time: toTimestamp(
            endTime,
            getLocalDatePart(selectedDate)
          ),
          venue: venue.trim(),
          description: description.trim() || null,
          event_type: selectedEventType,
          class_section:
            selectedEventType === 'classroom'
              ? classSection.trim()
              : null,
        })
        .eq('id', editingId)
        .select(EVENT_COLUMNS)
        .single();

      if (error) {
        console.error('UPDATE EVENT ERROR:', error);
        Alert.alert('Update Event Failed', error.message);
        return;
      }

      if (data) {
        setEvents((previous) =>
          previous.map((event) =>
            event.id === editingId ? (data as EventItem) : event
          )
        );
      } else {
        await loadEvents();
      }

      clearForm();
      setShowForm(false);

      if (Platform.OS === 'web') {
        window.alert('Event updated successfully.');
      } else {
        Alert.alert('Success', 'Event updated successfully.');
      }
    } catch (err: any) {
      console.error('UPDATE EVENT EXCEPTION:', err);
      Alert.alert(
        'Update Event Failed',
        err?.message ?? 'Something went wrong while updating the event.'
      );
    } finally {
      setSaving(false);
    }
  };

  const updateEventStatus = async (event: EventItem) => {
    if (actionId || saving) return;

    if (!user) {
      if (Platform.OS === 'web') {
        window.alert('Please sign in again.');
      } else {
        Alert.alert('Login Required', 'Please sign in again.');
      }
      return;
    }

    setActionId(event.id);

    try {
      const { data, error } = await supabase
        .from('events')
        .update({ status: 'Closed' })
        .eq('id', event.id)
        .select(EVENT_COLUMNS)
        .maybeSingle();

      if (error) {
        console.error('CLOSE EVENT ERROR:', error);
        const message = `Close Event Failed: ${error.message}`;

        if (Platform.OS === 'web') {
          window.alert(message);
        } else {
          Alert.alert('Close Event Failed', error.message);
        }
        return;
      }

      if (!data) {
        const message =
          'No event was updated. Check the event ID and your Supabase UPDATE policy.';

        if (Platform.OS === 'web') {
          window.alert(message);
        } else {
          Alert.alert('Close Event Failed', message);
        }
        return;
      }

      setEvents((previous) =>
        previous.map((item) =>
          item.id === event.id ? (data as EventItem) : item
        )
      );

      if (Platform.OS === 'web') {
        window.alert('The event has been closed.');
      } else {
        Alert.alert('Success', 'The event has been closed.');
      }
    } catch (err: any) {
      console.error('CLOSE EVENT EXCEPTION:', err);
      const message = err?.message ?? 'Unable to close the event.';

      if (Platform.OS === 'web') {
        window.alert(`Close Event Failed: ${message}`);
      } else {
        Alert.alert('Close Event Failed', message);
      }
    } finally {
      setActionId(null);
    }
  };

  const handleCloseEvent = (event: EventItem) => {
    if (actionId || saving) return;

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `Are you sure you want to close "${event.title}"?`
      );

      if (confirmed) void updateEventStatus(event);
      return;
    }

    Alert.alert(
      'Close Event',
      `Are you sure you want to close "${event.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close Event',
          style: 'destructive',
          onPress: () => void updateEventStatus(event),
        },
      ]
    );
  };

  const openPicker = (target: 'date' | 'start' | 'end') => {
    setPickerTarget(target);
    setPickerMode(target === 'date' ? 'date' : 'time');
    setShowDateTimePicker(true);
  };

  const handlePickerChange = (_event: any, value?: Date) => {
    if (!value) {
      setShowDateTimePicker(false);
      return;
    }

    if (pickerTarget === 'date') {
      setSelectedDate(value);
    } else {
      const formattedTime = `${String(value.getHours()).padStart(
        2,
        '0'
      )}:${String(value.getMinutes()).padStart(2, '0')}`;

      if (pickerTarget === 'start') setStartTime(formattedTime);
      if (pickerTarget === 'end') setEndTime(formattedTime);
    }

    setShowDateTimePicker(false);
  };

  const handleCancelForm = () => {
    if (saving) return;
    clearForm();
    setShowForm(false);
  };

  const openEventDetails = (eventId: string) => {
    router.push({
      pathname: '/admin-event-details',
      params: { id: eventId },
    });
  };

  const handleWebDateChange = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);

    if (year && month && day) {
      setSelectedDate(new Date(year, month - 1, day));
    }
  };

  const webDateTimeInput = (
    type: 'date' | 'time',
    value: string,
    onChange: (value: string) => void
  ) =>
    createElement('input' as any, {
      type,
      value,
      disabled: saving,
      onChange: (event: any) => onChange(event.target.value),
      style: {
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: colors.backgroundSecondary,
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        padding: '11px 12px',
        fontSize: 14,
        color: colors.textPrimary,
        height: 44,
      },
    });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Header title="Manage Events" />

        <Pressable
          style={styles.backButton}
          onPress={() => router.replace('/admin')}
          accessibilityRole="button"
          accessibilityLabel="Back to Admin Dashboard"
        >
          <Text style={styles.backButtonText}>‹ Back to Dashboard</Text>
        </Pressable>

        <View style={styles.headerSection}>
          <Text style={styles.title}>Attendance Management</Text>
          <Text style={styles.subtitle}>
            Create and manage classroom attendance and school event attendance separately.
          </Text>
        </View>

        {qrEvent && (
          <View
            style={styles.formCard}
            onLayout={(event) => {
              qrSectionY.current = event.nativeEvent.layout.y;
              scrollToQR();
            }}
          >
            <Text style={styles.formTitle}>Attendance QR Code</Text>
            <Text style={styles.subtitle}>{qrEvent.title}</Text>

            <View style={styles.eventTypeBadge}>
              <Text style={styles.eventTypeBadgeText}>
                {getEventTypeLabel(qrEvent.event_type)}
              </Text>
            </View>

            {getEventType(qrEvent.event_type) === 'classroom' &&
              qrEvent.class_section && (
                <Text style={styles.eventInfo}>
                  Class Section: {qrEvent.class_section}
                </Text>
              )}

            <View style={styles.qrContainer}>
              <QRCode
                value={buildQRPayload({
                  eventId: qrEvent.event_code,
                  title: qrEvent.title,
                  start: qrEvent.start_time,
                  end: qrEvent.end_time,
                })}
                size={220}
              />
            </View>

            <Text style={styles.eventCode}>
              Event Code: {qrEvent.event_code}
            </Text>

            <Text style={styles.qrHint}>
              Students can scan this QR code to record attendance for this event.
            </Text>

            <Pressable
              style={styles.cancelButton}
              onPress={() => setQrEvent(null)}
            >
              <Text style={styles.cancelButtonText}>Hide QR Code</Text>
            </Pressable>
          </View>
        )}

        {!showForm && (
          <>
            <View style={styles.searchContainer}>
              <Text style={styles.searchIcon}>⌕</Text>

              <TextInput
                style={styles.searchInput}
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Search title, code, venue, section, or type..."
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="Search attendance events"
              />

              {searchText.length > 0 && (
                <Pressable
                  onPress={() => setSearchText('')}
                  style={styles.clearSearch}
                  accessibilityLabel="Clear event search"
                >
                  <Text style={styles.clearSearchText}>×</Text>
                </Pressable>
              )}
            </View>

            <Text style={styles.filterHeading}>Attendance Type</Text>

            <View style={styles.filterRow}>
              {(
                [
                  { value: 'All', label: 'All Types', count: eventTypeCounts.All },
                  {
                    value: 'classroom',
                    label: 'Classroom',
                    count: eventTypeCounts.classroom,
                  },
                  {
                    value: 'school_event',
                    label: 'School Events',
                    count: eventTypeCounts.school_event,
                  },
                ] as const
              ).map((filter) => (
                <Pressable
                  key={filter.value}
                  style={[
                    styles.filterButton,
                    eventTypeFilter === filter.value &&
                      styles.activeFilterButton,
                  ]}
                  onPress={() => setEventTypeFilter(filter.value)}
                >
                  <Text
                    style={[
                      styles.filterText,
                      eventTypeFilter === filter.value &&
                        styles.activeFilterText,
                    ]}
                  >
                    {filter.label} ({filter.count})
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.filterHeading}>Event Status</Text>

            <View style={styles.filterRow}>
              {(['All', 'Open', 'Closed'] as const).map((filter) => (
                <Pressable
                  key={filter}
                  style={[
                    styles.filterButton,
                    eventFilter === filter && styles.activeFilterButton,
                  ]}
                  onPress={() => setEventFilter(filter)}
                >
                  <Text
                    style={[
                      styles.filterText,
                      eventFilter === filter && styles.activeFilterText,
                    ]}
                  >
                    {filter} ({filterCounts[filter]})
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.resultCount}>
              {filteredEvents.length}{' '}
              {filteredEvents.length === 1 ? 'record' : 'records'} found
            </Text>

            <View style={styles.buttonContainer}>
              <AppButton
                theme="primary"
                title="Create Attendance Event"
                icon="add-outline"
                onPress={() => {
                  clearForm();
                  setQrEvent(null);
                  setShowForm(true);
                }}
              />
            </View>
          </>
        )}

        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>
              {editingId ? 'Edit Attendance Event' : 'Create Attendance Event'}
            </Text>

            <Text style={styles.label}>Attendance Type *</Text>
            <Text style={styles.helperText}>
              Choose whether this event records classroom attendance or attendance at a school event.
            </Text>

            <View style={styles.typeSelector}>
              <Pressable
                style={[
                  styles.typeOption,
                  selectedEventType === 'classroom' &&
                    styles.activeTypeOption,
                ]}
                disabled={saving}
                onPress={() => setSelectedEventType('classroom')}
              >
                <Text
                  style={[
                    styles.typeOptionTitle,
                    selectedEventType === 'classroom' &&
                      styles.activeTypeOptionText,
                  ]}
                >
                  Classroom Attendance
                </Text>
                <Text
                  style={[
                    styles.typeOptionDescription,
                    selectedEventType === 'classroom' &&
                      styles.activeTypeOptionText,
                  ]}
                >
                  For a class or section
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.typeOption,
                  selectedEventType === 'school_event' &&
                    styles.activeTypeOption,
                ]}
                disabled={saving}
                onPress={() => setSelectedEventType('school_event')}
              >
                <Text
                  style={[
                    styles.typeOptionTitle,
                    selectedEventType === 'school_event' &&
                      styles.activeTypeOptionText,
                  ]}
                >
                  School Event Attendance
                </Text>
                <Text
                  style={[
                    styles.typeOptionDescription,
                    selectedEventType === 'school_event' &&
                      styles.activeTypeOptionText,
                  ]}
                >
                  For school activities
                </Text>
              </Pressable>
            </View>

            {selectedEventType === 'classroom' && (
              <>
                <Text style={styles.label}>Class / Section *</Text>
                <TextInput
                  style={styles.input}
                  value={classSection}
                  onChangeText={setClassSection}
                  placeholder="Example: BSIT-3B"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters"
                  editable={!saving}
                />
                <Text style={styles.helperText}>
                  Enter the class or section whose attendance you want to record.
                </Text>
              </>
            )}

            <Text style={styles.label}>Event Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder={
                selectedEventType === 'classroom'
                  ? 'Example: Web Programming Class'
                  : 'Example: CCTC Foundation Day'
              }
              placeholderTextColor={colors.textSecondary}
              editable={!saving}
            />

            <Text style={styles.label}>Event Code *</Text>
            <TextInput
              style={styles.input}
              value={eventCode}
              onChangeText={setEventCode}
              placeholder="Example: CCTC2026"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              editable={!saving}
            />

            {Platform.OS === 'web' ? (
              <>
                <Text style={styles.label}>Event Date *</Text>
                {webDateTimeInput(
                  'date',
                  getLocalDatePart(selectedDate),
                  handleWebDateChange
                )}

                <Text style={styles.label}>Start Time *</Text>
                {webDateTimeInput('time', startTime, setStartTime)}

                <Text style={styles.label}>End Time *</Text>
                {webDateTimeInput('time', endTime, setEndTime)}
              </>
            ) : (
              <>
                <Text style={styles.label}>Event Date *</Text>
                <Pressable
                  style={styles.pickerButton}
                  disabled={saving}
                  onPress={() => openPicker('date')}
                >
                  <Text style={styles.pickerIcon}>📅</Text>
                  <Text style={styles.pickerButtonText}>
                    {formatDateForDisplay(selectedDate)}
                  </Text>
                </Pressable>

                <Text style={styles.label}>Start Time *</Text>
                <Pressable
                  style={styles.pickerButton}
                  disabled={saving}
                  onPress={() => openPicker('start')}
                >
                  <Text style={styles.pickerIcon}>🕒</Text>
                  <Text style={styles.pickerButtonText}>
                    {startTime || 'Choose start time'}
                  </Text>
                </Pressable>

                <Text style={styles.label}>End Time *</Text>
                <Pressable
                  style={styles.pickerButton}
                  disabled={saving}
                  onPress={() => openPicker('end')}
                >
                  <Text style={styles.pickerIcon}>🕒</Text>
                  <Text style={styles.pickerButtonText}>
                    {endTime || 'Choose end time'}
                  </Text>
                </Pressable>

                {showDateTimePicker && (
                  <DateTimePicker
                    value={
                      pickerTarget === 'date'
                        ? selectedDate
                        : (() => {
                            const selectedTime =
                              pickerTarget === 'start'
                                ? startTime || '09:00'
                                : endTime || '10:00';

                            const [hours, minutes] = selectedTime
                              .split(':')
                              .map(Number);

                            const value = new Date(selectedDate);
                            value.setHours(hours, minutes, 0, 0);
                            return value;
                          })()
                    }
                    mode={pickerMode}
                    display="default"
                    onChange={handlePickerChange}
                  />
                )}
              </>
            )}

            <Text style={styles.label}>Venue *</Text>
            <TextInput
              style={styles.input}
              value={venue}
              onChangeText={setVenue}
              placeholder="Example: CCTC Room 301"
              placeholderTextColor={colors.textSecondary}
              editable={!saving}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.descriptionInput]}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter event description"
              placeholderTextColor={colors.textSecondary}
              multiline
              editable={!saving}
            />

            <AppButton
              theme="primary"
              title={
                saving
                  ? editingId
                    ? 'Updating...'
                    : 'Creating...'
                  : editingId
                    ? 'Update Event'
                    : 'Create Event'
              }
              icon={editingId ? 'create-outline' : 'checkmark-outline'}
              onPress={
                editingId ? handleUpdateEvent : handleCreateEvent
              }
            />

            <Pressable
              style={styles.cancelButton}
              disabled={saving}
              onPress={handleCancelForm}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={styles.loader}
          />
        ) : filteredEvents.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>
              {events.length === 0
                ? 'No Attendance Events Yet'
                : 'No Matching Records'}
            </Text>
            <Text style={styles.emptyText}>
              {events.length === 0
                ? 'Create a classroom attendance record or school event attendance record to get started.'
                : 'Try a different search or attendance filter.'}
            </Text>
          </View>
        ) : (
          filteredEvents.map((event) => {
            const closed = getEventStatus(event.status) === 'Closed';
            const closing = actionId === event.id;
            const classroom =
              getEventType(event.event_type) === 'classroom';

            return (
              <View key={event.id} style={styles.eventCard}>
                <View style={styles.eventHeader}>
                  <Text style={styles.eventTitle}>{event.title}</Text>

                  <View
                    style={[
                      styles.statusBadge,
                      closed ? styles.closedBadge : styles.openBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        closed
                          ? styles.closedStatusText
                          : styles.openStatusText,
                      ]}
                    >
                      {getEventStatus(event.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.eventTypeBadge}>
                  <Text style={styles.eventTypeBadgeText}>
                    {getEventTypeLabel(event.event_type)}
                  </Text>
                </View>

                {classroom && (
                  <Text style={styles.eventInfo}>
                    Class / Section: {event.class_section || 'Not specified'}
                  </Text>
                )}

                <Text style={styles.eventCode}>
                  Code: {event.event_code}
                </Text>

                <Text style={styles.eventInfo}>
                  Date: {formatDateForDisplay(new Date(event.start_time))}
                </Text>

                <Text style={styles.eventInfo}>
                  Time: {formatTimeForInput(event.start_time)} -{' '}
                  {formatTimeForInput(event.end_time)}
                </Text>

                <Text style={styles.eventInfo}>
                  Venue: {event.venue || 'Not specified'}
                </Text>

                {event.description ? (
                  <Text style={styles.description}>
                    {event.description}
                  </Text>
                ) : null}

                <Pressable
                  style={styles.detailsButton}
                  onPress={() => openEventDetails(event.id)}
                >
                  <Text style={styles.detailsButtonText}>
                    View Full Details
                  </Text>
                  <Text style={styles.detailsArrow}>›</Text>
                </Pressable>

                <Pressable
                  style={styles.qrButton}
                  onPress={() => {
                    setShowForm(false);
                    setQrEvent(event);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Show QR code for ${event.title}`}
                >
                  <Text style={styles.qrButtonText}>
                    Show Attendance QR Code
                  </Text>
                </Pressable>

                {!closed && (
                  <View style={styles.actionRow}>
                    <Pressable
                      style={styles.editButton}
                      disabled={saving || !!actionId}
                      onPress={() => startEditing(event)}
                    >
                      <Text style={styles.editButtonText}>Edit</Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.closeButton,
                        closing && styles.disabledButton,
                      ]}
                      disabled={saving || !!actionId}
                      onPress={() => handleCloseEvent(event)}
                    >
                      <Text style={styles.closeButtonText}>
                        {closing ? 'Closing...' : 'Close Event'}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })
        )}

        <View style={styles.bottomButton}>
          <AppButton
            theme="primary"
            title="Back to Dashboard"
            icon="arrow-back-outline"
            onPress={() => router.replace('/admin')}
          />
        </View>
      </ScrollView>
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
      paddingHorizontal: 20,
      paddingBottom: 40,
    },
    backButton: {
      alignSelf: 'flex-start',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginTop: 12,
    },
    backButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '600',
    },
    headerSection: {
      marginTop: 20,
      marginBottom: 16,
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
    filterHeading: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 4,
      marginBottom: 8,
    },
    helperText: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 6,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: 12,
      paddingHorizontal: 12,
      minHeight: 48,
      marginBottom: 12,
    },
    searchIcon: {
      fontSize: 25,
      color: colors.textSecondary,
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 14,
      paddingVertical: 10,
      outlineStyle: 'none',
    } as any,
    clearSearch: {
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    clearSearchText: {
      fontSize: 23,
      color: colors.textSecondary,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    filterButton: {
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    activeFilterButton: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    activeFilterText: {
      color: '#FFFFFF',
    },
    resultCount: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 14,
    },
    buttonContainer: {
      marginBottom: 16,
    },
    formCard: {
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: 16,
      padding: 18,
      marginBottom: 20,
    },
    formTitle: {
      fontSize: 19,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
      marginTop: 12,
      marginBottom: 6,
    },
    input: {
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
      fontSize: 14,
      color: colors.textPrimary,
    },
    typeSelector: {
      gap: 10,
      marginTop: 4,
    },
    typeOption: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 12,
      padding: 14,
    },
    activeTypeOption: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    typeOptionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    typeOptionDescription: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    activeTypeOptionText: {
      color: '#FFFFFF',
    },
    eventTypeBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginTop: 10,
    },
    eventTypeBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    pickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    pickerIcon: {
      fontSize: 17,
      marginRight: 10,
    },
    pickerButtonText: {
      fontSize: 14,
      color: colors.textPrimary,
    },
    descriptionInput: {
      minHeight: 90,
      textAlignVertical: 'top',
      marginBottom: 16,
    },
    cancelButton: {
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 12,
    },
    cancelButtonText: {
      color: colors.danger,
      fontSize: 14,
      fontWeight: '600',
    },
    qrContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
      padding: 16,
      borderRadius: 12,
      marginTop: 18,
      marginBottom: 8,
    },
    qrHint: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 10,
      lineHeight: 19,
    },
    qrButton: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 9,
      paddingHorizontal: 12,
      paddingVertical: 11,
      alignItems: 'center',
      marginTop: 10,
    },
    qrButtonText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    loader: {
      marginTop: 30,
      marginBottom: 30,
    },
    emptyBox: {
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: 14,
      padding: 20,
      alignItems: 'center',
      marginTop: 10,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 6,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    eventCard: {
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
    },
    eventHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 10,
    },
    eventTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    statusBadge: {
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    openBadge: {
      backgroundColor: '#DCFCE7',
    },
    closedBadge: {
      backgroundColor: '#FEE2E2',
    },
    statusText: {
      fontSize: 11,
      fontWeight: '700',
    },
    openStatusText: {
      color: '#166534',
    },
    closedStatusText: {
      color: '#991B1B',
    },
    eventCode: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
      marginTop: 8,
    },
    eventInfo: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 6,
    },
    description: {
      fontSize: 14,
      color: colors.textPrimary,
      lineHeight: 20,
      marginTop: 10,
    },
    detailsButton: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 9,
      paddingHorizontal: 12,
      paddingVertical: 11,
      marginTop: 14,
    },
    detailsButtonText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    detailsArrow: {
      color: colors.primary,
      fontSize: 20,
      fontWeight: '700',
      marginLeft: 6,
    },
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 12,
    },
    editButton: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    editButtonText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '600',
    },
    closeButton: {
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    closeButtonText: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: '600',
    },
    disabledButton: {
      opacity: 0.5,
    },
    bottomButton: {
      marginTop: 12,
    },
  });
}