
import { createElement, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import QRCode from 'react-native-qrcode-svg';

import { useTheme } from '@/app/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { createEvent, type Event, type EventType } from '@/lib/events';
import { buildQRPayload } from '@/lib/qr';

type PickerTarget = 'start' | 'end';
type PickerMode = 'date' | 'time';

export default function TeacherScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);

  const [eventType, setEventType] =
    useState<EventType>('school_event');
  const [title, setTitle] = useState('');
  const [venue, setVenue] = useState('');
  const [classSection, setClassSection] = useState('');

  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 60 * 60 * 1000)
  );

  const [pickerTarget, setPickerTarget] =
    useState<PickerTarget | null>(null);
  const [pickerMode, setPickerMode] =
    useState<PickerMode>('date');

  const [payload, setPayload] = useState('');

  useEffect(() => {
    let active = true;

    async function checkTeacherAccess() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (active) setIsTeacher(false);
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Unable to check teacher role:', error.message);
          if (active) setIsTeacher(false);
          return;
        }

        if (active) {
          setIsTeacher(data?.role === 'teacher');
        }
      } catch (error) {
        console.error('Teacher access check failed:', error);
        if (active) setIsTeacher(false);
      } finally {
        if (active) setLoading(false);
      }
    }

    void checkTeacherAccess();

    return () => {
      active = false;
    };
  }, []);

  function openPicker(target: PickerTarget, mode: PickerMode) {
    setPickerTarget(target);
    setPickerMode(mode);
  }

  function updateDate(
    target: PickerTarget,
    mode: PickerMode,
    selectedDate: Date
  ) {
    const current = target === 'start' ? startDate : endDate;
    const updated = new Date(current);

    if (mode === 'date') {
      updated.setFullYear(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate()
      );
    } else {
      updated.setHours(
        selectedDate.getHours(),
        selectedDate.getMinutes(),
        0,
        0
      );
    }

    if (target === 'start') {
      setStartDate(updated);

      if (endDate <= updated) {
        setEndDate(new Date(updated.getTime() + 60 * 60 * 1000));
      }
    } else {
      setEndDate(updated);
    }

    setPayload('');
  }

  function handleNativePickerChange(
    event: { type?: string },
    selectedDate?: Date
  ) {
    if (event.type === 'dismissed') {
      setPickerTarget(null);
      return;
    }

    if (selectedDate && pickerTarget) {
      updateDate(pickerTarget, pickerMode, selectedDate);
    }

    setPickerTarget(null);
  }

  function formatDate(date: Date) {
    return date.toLocaleDateString();
  }

  function formatTime(date: Date) {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function toDateInputValue(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  function toTimeInputValue(date: Date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${hours}:${minutes}`;
  }

  function handleWebInput(
    target: PickerTarget,
    mode: PickerMode,
    value: string
  ) {
    if (!value) return;

    const current = target === 'start' ? startDate : endDate;
    const updated = new Date(current);

    if (mode === 'date') {
      const [year, month, day] = value.split('-').map(Number);

      if (!year || !month || !day) return;

      updated.setFullYear(year, month - 1, day);
    } else {
      const [hours, minutes] = value.split(':').map(Number);

      if (
        hours === undefined ||
        minutes === undefined ||
        Number.isNaN(hours) ||
        Number.isNaN(minutes)
      ) {
        return;
      }

      updated.setHours(hours, minutes, 0, 0);
    }

    updateDate(target, mode, updated);
  }

  function renderWebDateInput(
    target: PickerTarget,
    mode: PickerMode,
    value: string
  ) {
    return createElement('input' as any, {
      type: mode,
      value,
      onChange: (event: { target: { value: string } }) =>
        handleWebInput(target, mode, event.target.value),
      style: {
        flex: 1,
        minWidth: 0,
        height: 46,
        padding: '0 10px',
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontSize: 14,
        boxSizing: 'border-box',
      },
    });
  }

  function renderDateTimeRow(target: PickerTarget) {
    const date = target === 'start' ? startDate : endDate;

    if (Platform.OS === 'web') {
      return (
        <View style={styles.dateRow}>
          {renderWebDateInput(
            target,
            'date',
            toDateInputValue(date)
          )}
          {renderWebDateInput(
            target,
            'time',
            toTimeInputValue(date)
          )}
        </View>
      );
    }

    return (
      <View style={styles.dateRow}>
        <Pressable
          style={styles.dateButton}
          onPress={() => openPicker(target, 'date')}
        >
          <Text style={styles.dateButtonText}>
            {formatDate(date)}
          </Text>
        </Pressable>

        <Pressable
          style={styles.dateButton}
          onPress={() => openPicker(target, 'time')}
        >
          <Text style={styles.dateButtonText}>
            {formatTime(date)}
          </Text>
        </Pressable>
      </View>
    );
  }

  function generateEventCode() {
    return (
      'QR' +
      Date.now().toString(36).toUpperCase() +
      Math.random().toString(36).substring(2, 6).toUpperCase()
    );
  }

  async function handleCreateEvent() {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a session title.');
      return;
    }

    if (eventType === 'classroom' && !classSection.trim()) {
      Alert.alert(
        'Missing Class or Section',
        'Please enter the class or section for classroom attendance.'
      );
      return;
    }

    if (endDate <= startDate) {
      Alert.alert(
        'Invalid Schedule',
        'The end date and time must be later than the start date and time.'
      );
      return;
    }

    setSaving(true);
    setPayload('');

    try {
      const event: Event = {
        eventId: generateEventCode(),
        title: title.trim(),
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        venue: venue.trim(),
        eventType,
        classSection:
          eventType === 'classroom'
            ? classSection.trim()
            : undefined,
      };

      const result = await createEvent(event);

      if (result.error) {
        Alert.alert('Unable to Create Session', result.error);
        return;
      }

      setPayload(buildQRPayload(event));

      Alert.alert(
        'Success',
        `${eventType === 'classroom' ? 'Classroom' : 'School event'} attendance session created successfully.`
      );
    } catch (error) {
      console.error('Create session failed:', error);
      Alert.alert(
        'Error',
        'Something went wrong while creating the session.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Checking account...</Text>
      </View>
    );
  }

  if (!isTeacher) {
    return (
      <View style={styles.center}>
        <Text style={styles.lockTitle}>Teacher Access Only</Text>
        <Text style={styles.lockText}>
          Please sign in using an account with the teacher role.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.heading}>Attendance Management</Text>
      <Text style={styles.subtitle}>
        Create a classroom or school event attendance session.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Attendance Type</Text>

        <View style={styles.typeRow}>
          <Pressable
            style={[
              styles.typeButton,
              eventType === 'classroom' && styles.typeButtonActive,
            ]}
            onPress={() => {
              setEventType('classroom');
              setPayload('');
            }}
          >
            <Text
              style={[
                styles.typeButtonText,
                eventType === 'classroom' &&
                  styles.typeButtonTextActive,
              ]}
            >
              Classroom Attendance
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.typeButton,
              eventType === 'school_event' && styles.typeButtonActive,
            ]}
            onPress={() => {
              setEventType('school_event');
              setPayload('');
            }}
          >
            <Text
              style={[
                styles.typeButtonText,
                eventType === 'school_event' &&
                  styles.typeButtonTextActive,
              ]}
            >
              School Event
            </Text>
          </Pressable>
        </View>

        <Text style={styles.label}>
          {eventType === 'classroom'
            ? 'Classroom Session Title'
            : 'School Event Title'}
        </Text>

        <TextInput
          style={styles.input}
          placeholder={
            eventType === 'classroom'
              ? 'e.g. Database Management'
              : 'e.g. Foundation Day'
          }
          placeholderTextColor={colors.textSecondary}
          value={title}
          onChangeText={(value) => {
            setTitle(value);
            setPayload('');
          }}
        />

        {eventType === 'classroom' && (
          <>
            <Text style={styles.label}>Class or Section</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. BSIT-3B"
              placeholderTextColor={colors.textSecondary}
              value={classSection}
              onChangeText={(value) => {
                setClassSection(value);
                setPayload('');
              }}
            />
          </>
        )}

        <Text style={styles.label}>Venue</Text>
        <TextInput
          style={styles.input}
          placeholder={
            eventType === 'classroom'
              ? 'e.g. Computer Laboratory 1'
              : 'e.g. School Gymnasium'
          }
          placeholderTextColor={colors.textSecondary}
          value={venue}
          onChangeText={(value) => {
            setVenue(value);
            setPayload('');
          }}
        />

        <Text style={styles.label}>Start Date and Time</Text>
        {renderDateTimeRow('start')}

        <Text style={styles.label}>End Date and Time</Text>
        {renderDateTimeRow('end')}

        {Platform.OS !== 'web' && pickerTarget !== null && (
          <DateTimePicker
            key={`${pickerTarget}-${pickerMode}`}
            value={pickerTarget === 'start' ? startDate : endDate}
            mode={pickerMode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleNativePickerChange}
          />
        )}

        <Pressable
          style={[
            styles.createButton,
            saving && styles.disabledButton,
          ]}
          onPress={handleCreateEvent}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <Text style={styles.createButtonText}>
              Create Attendance Session
            </Text>
          )}
        </Pressable>
      </View>

      {payload !== '' && (
        <View style={styles.card}>
          <Text style={styles.qrTitle}>Attendance QR Code</Text>

          <Text style={styles.qrSubtitle}>
            {eventType === 'classroom'
              ? 'Classroom Attendance'
              : 'School Event Attendance'}
          </Text>

          <Text style={styles.generatedTitle}>{title}</Text>

          {eventType === 'classroom' && (
            <Text style={styles.detailText}>
              Class/Section: {classSection}
            </Text>
          )}

          {!!venue.trim() && (
            <Text style={styles.detailText}>Venue: {venue}</Text>
          )}

          <View style={styles.qrContainer}>
            <QRCode
              value={payload}
              size={220}
              backgroundColor="#FFFFFF"
              color="#10213A"
            />
          </View>

          <Text style={styles.qrHint}>
            Students can scan this QR code to record their attendance.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      padding: 20,
      paddingBottom: 40,
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
      backgroundColor: colors.background,
    },
    loadingText: {
      marginTop: 12,
      color: colors.textSecondary,
    },
    lockTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    lockText: {
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 10,
      lineHeight: 22,
    },
    heading: {
      fontSize: 25,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    subtitle: {
      color: colors.textSecondary,
      marginTop: 8,
      marginBottom: 20,
      lineHeight: 21,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 18,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 3,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 14,
    },
    typeRow: {
      gap: 10,
      marginBottom: 18,
    },
    typeButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 12,
      backgroundColor: colors.surface,
      alignItems: 'center',
    },
    typeButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    typeButtonText: {
      color: colors.textPrimary,
      fontWeight: '600',
      textAlign: 'center',
    },
    typeButtonTextActive: {
      color: colors.textOnPrimary,
    },
    label: {
      color: colors.textPrimary,
      fontWeight: '600',
      marginBottom: 8,
      marginTop: 12,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
      color: colors.textPrimary,
    },
    dateRow: {
      flexDirection: 'row',
      gap: 10,
    },
    dateButton: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      alignItems: 'center',
    },
    dateButtonText: {
      color: colors.textPrimary,
      fontWeight: '600',
    },
    createButton: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 13,
      alignItems: 'center',
      marginTop: 24,
    },
    disabledButton: {
      opacity: 0.6,
    },
    createButtonText: {
      color: colors.textOnPrimary,
      fontWeight: '700',
      fontSize: 15,
    },
    qrTitle: {
      color: colors.textPrimary,
      fontSize: 21,
      fontWeight: '800',
      textAlign: 'center',
    },
    qrSubtitle: {
      color: colors.primary,
      fontWeight: '700',
      textAlign: 'center',
      marginTop: 8,
    },
    generatedTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
      marginTop: 12,
    },
    detailText: {
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 6,
    },
    qrContainer: {
      alignSelf: 'center',
      marginTop: 22,
      padding: 16,
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#E1E8F1',
    },
    qrHint: {
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
      marginTop: 16,
    },
  });
}
