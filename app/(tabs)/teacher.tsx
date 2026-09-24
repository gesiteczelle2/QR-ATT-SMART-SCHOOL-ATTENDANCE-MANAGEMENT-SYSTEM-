import { useCallback, useState } from 'react';

import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useFocusEffect } from 'expo-router';

import DateTimePicker from '@react-native-community/datetimepicker';

import Ionicons from '@expo/vector-icons/Ionicons';

import QRCode from 'react-native-qrcode-svg';

import AppButton from '@/components/AppButton';

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

  const [eventCode, setEventCode] =
    useState('');

  const [startTime, setStartTime] =
    useState(new Date());

  const [endTime, setEndTime] =
    useState(
      new Date(Date.now() + 60 * 60 * 1000)
    );

  const [picker, setPicker] =
    useState<
      'startDate' |
      'startTime' |
      'endDate' |
      'endTime' |
      null
    >(null);

  const [eventCreated, setEventCreated] =
    useState(false);

  const [payload, setPayload] =
    useState<string | null>(null);

  const [message, setMessage] =
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

  const formatDateTime = (date: Date) => {
    return date.toLocaleString();
  };

  const openStartPicker = () => {
    setPicker('startDate');
  };

  const openEndPicker = () => {
    setPicker('endDate');
  };

  const handlePickerChange = (
    event: any,
    selectedDate?: Date
  ) => {
    if (event.type === 'dismissed') {
      setPicker(null);
      return;
    }

    if (!selectedDate) {
      setPicker(null);
      return;
    }

    if (picker === 'startDate') {
      const updatedStart = new Date(startTime);

      updatedStart.setFullYear(
        selectedDate.getFullYear()
      );

      updatedStart.setMonth(
        selectedDate.getMonth()
      );

      updatedStart.setDate(
        selectedDate.getDate()
      );

      setStartTime(updatedStart);

      if (Platform.OS === 'android') {
        setPicker('startTime');
      }
    }

    if (picker === 'startTime') {
      const updatedStart = new Date(startTime);

      updatedStart.setHours(
        selectedDate.getHours()
      );

      updatedStart.setMinutes(
        selectedDate.getMinutes()
      );

      updatedStart.setSeconds(0);
      updatedStart.setMilliseconds(0);

      setStartTime(updatedStart);

      if (
        endTime <= updatedStart
      ) {
        setEndTime(
          new Date(
            updatedStart.getTime() +
              60 * 60 * 1000
          )
        );
      }

      setPicker(null);
    }

    if (picker === 'endDate') {
      const updatedEnd = new Date(endTime);

      updatedEnd.setFullYear(
        selectedDate.getFullYear()
      );

      updatedEnd.setMonth(
        selectedDate.getMonth()
      );

      updatedEnd.setDate(
        selectedDate.getDate()
      );

      setEndTime(updatedEnd);

      if (Platform.OS === 'android') {
        setPicker('endTime');
      }
    }

    if (picker === 'endTime') {
      const updatedEnd = new Date(endTime);

      updatedEnd.setHours(
        selectedDate.getHours()
      );

      updatedEnd.setMinutes(
        selectedDate.getMinutes()
      );

      updatedEnd.setSeconds(0);
      updatedEnd.setMilliseconds(0);

      setEndTime(updatedEnd);

      setPicker(null);
    }
  };

  const addTime = (minutes: number) => {
    setEndTime(
      new Date(
        startTime.getTime() +
          minutes * 60 * 1000
      )
    );
  };

  const handleCreateEvent = async () => {
    const title = eventTitle.trim();
    const code = eventCode.trim();

    setMessage(null);

    if (!title) {
      setMessage(
        'Please enter an event title.'
      );
      return;
    }

    if (!code) {
      setMessage(
        'Please enter an event code.'
      );
      return;
    }

    if (endTime <= startTime) {
      setMessage(
        'End time must be later than start time.'
      );
      return;
    }

    const event: Event = {
      eventId: code,
      title: title,
      start: startTime.toISOString(),
      end: endTime.toISOString(),
    };

    const { error } =
      await createEvent(event);

    if (error) {
      setEventCreated(false);
      setPayload(null);
      setMessage(error);
      return;
    }

    setEventCreated(true);
    setPayload(
      buildQRPayload(event)
    );

    setMessage(
      'Event created successfully!'
    );
  };

  if (roleLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator
          size="large"
          color="#2E7DFF"
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
          color="#777777"
        />

        <Text style={styles.lockTitle}>
          Teachers Only
        </Text>

        <Text style={styles.lockText}>
          Only teacher accounts can create
          events.
        </Text>
      </View>
    );
  }

  let pickerValue = startTime;

  if (
    picker === 'startTime'
  ) {
    pickerValue = startTime;
  }

  if (
    picker === 'endDate' ||
    picker === 'endTime'
  ) {
    pickerValue = endTime;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.pageTitle}>
        Teacher
      </Text>

      <Text style={styles.createTitle}>
        Create Event
      </Text>

      <Text style={styles.label}>
        Event Title
      </Text>

      <TextInput
        value={eventTitle}
        onChangeText={setEventTitle}
        placeholder="e.g. Founders Day Assembly"
        placeholderTextColor="#9AA4B2"
        style={styles.input}
      />

      <Text style={styles.label}>
        Event Code
      </Text>

      <TextInput
        value={eventCode}
        onChangeText={setEventCode}
        placeholder="e.g. EVT-2026-0001"
        placeholderTextColor="#9AA4B2"
        autoCapitalize="characters"
        style={styles.input}
      />

      <Text style={styles.label}>
        Start Time
      </Text>

      <Pressable
        style={styles.timeButton}
        onPress={openStartPicker}
      >
        <Text style={styles.timeText}>
          {formatDateTime(startTime)}
        </Text>
      </Pressable>

      <Text style={styles.label}>
        End Time
      </Text>

      <Pressable
        style={styles.timeButton}
        onPress={openEndPicker}
      >
        <Text style={styles.timeText}>
          {formatDateTime(endTime)}
        </Text>
      </Pressable>

      {picker && (
        <DateTimePicker
          value={pickerValue}
          mode={
            picker === 'startDate' ||
            picker === 'endDate'
              ? 'date'
              : 'time'
          }
          display="default"
          onChange={handlePickerChange}
        />
      )}

      <View style={styles.quickButtons}>
        <Pressable
          style={styles.quickButton}
          onPress={() => addTime(30)}
        >
          <Text style={styles.quickText}>
            +30 min
          </Text>
        </Pressable>

        <Pressable
          style={styles.quickButton}
          onPress={() => addTime(60)}
        >
          <Text style={styles.quickText}>
            +1 hour
          </Text>
        </Pressable>

        <Pressable
          style={styles.quickButton}
          onPress={() => addTime(120)}
        >
          <Text style={styles.quickText}>
            +2 hours
          </Text>
        </Pressable>
      </View>

      {message && (
        <Text
          style={[
            styles.message,
            message.includes(
              'successfully'
            )
              ? styles.successMessage
              : styles.errorMessage,
          ]}
        >
          {message}
        </Text>
      )}

      <AppButton
        theme="primary"
        title="Create Event"
        icon="add"
        onPress={handleCreateEvent}
      />

      {eventCreated && payload && (
        <View style={styles.qrContainer}>
          <Text style={styles.qrTitle}>
            {eventTitle}
          </Text>

          <Text style={styles.qrSubtitle}>
            {eventCode}
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

          <Text style={styles.successText}>
            Event created successfully!
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1020',
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },

  centerContainer: {
    flex: 1,
    backgroundColor: '#0B1020',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#AAB4C5',
  },

  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 40,
  },

  createTitle: {
    fontSize: 25,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 28,
  },

  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },

  input: {
    height: 60,
    backgroundColor: '#11182B',
    borderWidth: 1,
    borderColor: '#31548F',
    borderRadius: 12,
    paddingHorizontal: 18,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 20,
  },

  timeButton: {
    height: 60,
    backgroundColor: '#11182B',
    borderWidth: 1,
    borderColor: '#31548F',
    borderRadius: 12,
    paddingHorizontal: 18,
    justifyContent: 'center',
    marginBottom: 20,
  },

  timeText: {
    fontSize: 16,
    color: '#FFFFFF',
  },

  quickButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },

  quickButton: {
    backgroundColor: '#11182B',
    borderWidth: 1,
    borderColor: '#31548F',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },

  quickText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  message: {
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 12,
  },

  successMessage: {
    color: '#4ADE80',
  },

  errorMessage: {
    color: '#F87171',
  },

  lockTitle: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  lockText: {
    marginTop: 8,
    fontSize: 15,
    color: '#AAB4C5',
    textAlign: 'center',
  },

  qrContainer: {
    alignItems: 'center',
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#27324A',
  },

  qrTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  qrSubtitle: {
    fontSize: 14,
    color: '#AAB4C5',
    marginTop: 4,
  },

  scanText: {
    fontSize: 14,
    color: '#AAB4C5',
    marginTop: 8,
    marginBottom: 16,
  },

  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
  },

  successText: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
});