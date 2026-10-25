
import { supabase } from './supabase';
import { parseQRPayload } from './qr';
import { getEventByCode } from './events';

export type StudentPhoto = {
  avatarUrl: string | null;
  avatarStatus: string | null;
};

export type AttendanceRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  scannedAt: string;
  studentId?: string;
  studentName?: string;
  avatarUrl?: string | null;
  avatarStatus?: string | null;
};

export type StudentEventHistoryRecord = {
  eventId: string;
  eventCode: string;
  eventTitle: string;
  eventType: string | null;
  classSection: string | null;
  startTime: string | null;
  endTime: string | null;
  attendanceStatus: 'Present' | 'Absent' | 'Upcoming' | 'Not yet scanned';
  scannedAt: string | null;
};

export type RegisterResult = {
  success: boolean;
  message: string;
  eventTitle?: string;
  studentName?: string;
  block?: string | null;
  yearLevel?: string | null;
};

export type AttendanceQRPreview = {
  valid: boolean;
  message: string;
  eventId?: string;
  eventCode?: string;
  eventTitle?: string;
  eventType?: string | null;
  classSection?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  status?: string | null;
};

export type TeacherEventAttendance = {
  studentId: string;
  scannedAt: string;
  eventId: string;
};

export type TeacherEventSummary = {
  eventId: string;
  eventCode: string;
  title: string;
  attendeeCount: number;
  eventType: string | null;
  classSection: string | null;
};

export type TeacherEventAttendee = {
  id: string;
  studentId: string;
  studentName: string;
  educationLevel: string | null;
  block: string | null;
  yearLevel: string | null;
  scannedAt: string;
  avatarUrl: string | null;
  avatarStatus: string | null;
};

export type TeacherRosterStudent = {
  id: string;
  studentName: string;
  educationLevel: string | null;
  program: string | null;
  block: string | null;
  yearLevel: string | null;
  status: 'Present' | 'Absent' | 'Not yet scanned';
  scannedAt: string | null;
  avatarUrl: string | null;
  avatarStatus: string | null;
};

export type TeacherEventRoster = {
  title: string;
  eventType: string | null;
  classSection: string | null;
  startTime: string | null;
  endTime: string | null;
  students: TeacherRosterStudent[];
  otherAttendees: TeacherRosterStudent[];
};

/**
 * Return a usable photo path only when the student's photo is approved.
 * The path is stored in Supabase Storage bucket "avatars".
 */
function getApprovedAvatar(
  profile: {
    id?: string;
    full_name?: string | null;
    avatar_url?: string | null;
    avatar_status?: string | null;
  } | null | undefined
): StudentPhoto {
  const avatarStatus = profile?.avatar_status?.trim().toLowerCase() ?? null;
  const avatarPath = profile?.avatar_url?.trim() || null;

  console.log('STUDENT PHOTO PROFILE:', {
    studentId: profile?.id,
    studentName: profile?.full_name,
    avatarPath,
    avatarStatus,
  });

  if (!avatarPath) {
    console.warn(
      `No avatar storage path found for student: ${profile?.id ?? 'unknown'}`
    );
  }

  if (avatarStatus !== 'approved') {
    console.log(
      `Student photo is not approved. Current status: ${avatarStatus ?? 'missing'}`
    );
  }

  return {
    avatarUrl: avatarStatus === 'approved' ? avatarPath : null,
    avatarStatus,
  };
}

/**
 * Preview an attendance QR code without registering attendance.
 * Checks whether the student has already attended the event.
 */
export async function previewAttendanceQR(
  rawPayload: string,
  studentId?: string
): Promise<AttendanceQRPreview> {
  const parsed = parseQRPayload(rawPayload);

  if (!parsed.ok) {
    return {
      valid: false,
      message: parsed.message,
    };
  }

  try {
    const payload = parsed.payload;

    const { data: event, error } = await supabase
      .from('events')
      .select(
        'id, event_code, title, event_type, class_section, start_time, end_time, status'
      )
      .eq('event_code', payload.event)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to verify QR code: ${error.message}`);
    }

    if (!event) {
      return {
        valid: false,
        message: 'This QR code does not match an existing school event.',
      };
    }

    // Check whether this student already has attendance for this event.
    if (studentId) {
      const { data: existingAttendance, error: attendanceError } =
        await supabase
          .from('attendance')
          .select('id')
          .eq('event_id', event.id)
          .eq('student_id', studentId)
          .limit(1)
          .maybeSingle();

      if (attendanceError) {
        throw new Error(
          `Failed to check existing attendance: ${attendanceError.message}`
        );
      }

      if (existingAttendance) {
        return {
          valid: false,
          message: 'You have already attended this event.',
          eventId: event.id,
          eventCode: event.event_code,
          eventTitle: event.title ?? payload.title ?? 'Untitled Event',
          eventType: event.event_type ?? null,
          classSection: event.class_section ?? null,
          startTime: event.start_time ?? payload.start ?? null,
          endTime: event.end_time ?? payload.end ?? null,
          status: event.status ?? null,
        };
      }
    }

    return {
      valid: true,
      message: 'QR code verified. Review the details before confirming.',
      eventId: event.id,
      eventCode: event.event_code,
      eventTitle: event.title ?? payload.title ?? 'Untitled Event',
      eventType: event.event_type ?? null,
      classSection: event.class_section ?? null,
      startTime: event.start_time ?? payload.start ?? null,
      endTime: event.end_time ?? payload.end ?? null,
      status: event.status ?? null,
    };
  } catch (error) {
    return {
      valid: false,
      message:
        error instanceof Error
          ? error.message
          : 'Could not verify this QR code.',
    };
  }
}

/**
 * Register a student's attendance using the scanned QR code.
 */
export async function registerAttendance(
  rawPayload: string,
  studentId: string
): Promise<RegisterResult> {
  try {
    const parsed = parseQRPayload(rawPayload);

    if (!parsed.ok) {
      return { success: false, message: 'Invalid QR code.' };
    }

    const payload = parsed.payload;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, block, year_level')
      .eq('id', studentId)
      .maybeSingle();

    if (profileError) {
      throw new Error(
        `Failed to load student profile: ${profileError.message}`
      );
    }

    const existingEvent = await getEventByCode(payload.event);

    if (!existingEvent) {
      return {
        success: false,
        message:
          'This event could not be found. Please ask your teacher for a valid event QR code.',
      };
    }

    const eventId = existingEvent.id;
    const eventTitle = existingEvent.title;

    // Use the current event record, not possibly outdated QR timestamps.
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, start_time, end_time, status')
      .eq('id', eventId)
      .maybeSingle();

    if (eventError) {
      throw new Error(`Failed to verify event: ${eventError.message}`);
    }

    if (!event) {
      return {
        success: false,
        message: 'This event could not be found.',
      };
    }

    if (String(event.status ?? '').toLowerCase() === 'closed') {
      return {
        success: false,
        message:
          'This event is already closed. Attendance can no longer be registered.',
        eventTitle,
      };
    }

    const now = Date.now();
    const startTime = event.start_time
      ? new Date(event.start_time).getTime()
      : null;
    const endTime = event.end_time
      ? new Date(event.end_time).getTime()
      : null;

    if (
      startTime !== null &&
      !Number.isNaN(startTime) &&
      now < startTime
    ) {
      return {
        success: false,
        message: 'This event has not started yet.',
        eventTitle,
      };
    }

    if (
      endTime !== null &&
      !Number.isNaN(endTime) &&
      now > endTime
    ) {
      return {
        success: false,
        message: 'This event has already ended.',
        eventTitle,
      };
    }

    const { error: attendanceError } = await supabase
      .from('attendance')
      .insert({
        student_id: studentId,
        event_id: eventId,
      });

    if (attendanceError) {
      if (attendanceError.code === '23505') {
        return {
          success: false,
          message: 'Already registered for this event.',
          eventTitle,
          studentName: profile?.full_name ?? undefined,
          block: profile?.block ?? null,
          yearLevel: profile?.year_level ?? null,
        };
      }

      throw new Error(
        `Failed to register attendance: ${attendanceError.message}`
      );
    }

    return {
      success: true,
      message: 'Attendance registered successfully!',
      eventTitle,
      studentName: profile?.full_name ?? undefined,
      block: profile?.block ?? null,
      yearLevel: profile?.year_level ?? null,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Something went wrong while registering attendance.',
    };
  }
}

/**
 * Get a student's own attendance history.
 */
export async function getAttendanceHistory(
  studentId: string
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select(`
      id,
      student_id,
      scanned_at,
      events (
        event_code,
        title
      )
    `)
    .eq('student_id', studentId)
    .order('scanned_at', { ascending: false });

  if (error) {
    throw new Error(
      `Failed to load attendance history: ${error.message}`
    );
  }

  return (data ?? []).map((row: any) => {
    const event = Array.isArray(row.events)
      ? row.events[0]
      : row.events;

    return {
      id: row.id,
      eventId: event?.event_code ?? '',
      eventTitle: event?.title ?? 'Unknown Event',
      scannedAt: row.scanned_at,
      studentId: row.student_id,
    };
  });
}

/**
 * Normalize values for program, year, and section comparisons.
 */
function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

function getYearNumber(value: string | null | undefined): string {
  const text = (value ?? '').trim().toLowerCase();
  const numericMatch = text.match(/\d+/);

  if (numericMatch) {
    return numericMatch[0];
  }

  const wordYears: Record<string, string> = {
    first: '1',
    second: '2',
    third: '3',
    fourth: '4',
    fifth: '5',
    sixth: '6',
  };

  for (const [word, number] of Object.entries(wordYears)) {
    if (text.includes(word)) {
      return number;
    }
  }

  return '';
}

/**
 * Supports targets such as:
 * BSIT
 * BSIT only
 * BSIT-3B
 * STEM-11-Einstein
 * Einstein
 */
function studentMatchesSection(
  profile: {
    program: string | null;
    year_level: string | null;
    block: string | null;
  },
  classSection: string | null
): boolean {
  if (!classSection?.trim()) {
    return false;
  }

  const target = normalize(classSection);
  const program = normalize(profile.program);
  const year = getYearNumber(profile.year_level);
  const block = normalize(profile.block);

  if (!target) {
    return false;
  }

  const programTarget = target.endsWith('only')
    ? target.slice(0, -4)
    : target;

  if (program && programTarget === program) {
    return true;
  }

  if (block && target === block) {
    return true;
  }

  if (!program || !year || !block) {
    return false;
  }

  const possibleSections = [
    normalize(`${program}${year}${block}`),
    normalize(`${profile.program}-${year}-${profile.block}`),
    normalize(
      `${profile.program} ${profile.year_level} ${profile.block}`
    ),
    normalize(
      `${profile.program}-${profile.year_level}-${profile.block}`
    ),
  ];

  return possibleSections.includes(target);
}

/**
 * Get relevant events for a student and calculate attendance status.
 * Closed events immediately mark unscanned students as Absent.
 */
export async function getStudentEventHistory(
  studentId: string
): Promise<StudentEventHistoryRecord[]> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('program, education_level, year_level, block')
    .eq('id', studentId)
    .maybeSingle();

  if (profileError) {
    throw new Error(
      `Failed to load student profile: ${profileError.message}`
    );
  }

  if (!profile) {
    throw new Error('Student profile not found.');
  }

  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select(`
      id,
      event_code,
      title,
      event_type,
      class_section,
      start_time,
      end_time,
      status
    `)
    .order('start_time', { ascending: false, nullsFirst: false });

  if (eventsError) {
    throw new Error(`Failed to load events: ${eventsError.message}`);
  }

  const eligibleEvents = (events ?? []).filter((event) => {
    if (event.event_type !== 'classroom') {
      return true;
    }

    return studentMatchesSection(
      {
        program: profile.program ?? null,
        year_level: profile.year_level ?? null,
        block: profile.block ?? null,
      },
      event.class_section
    );
  });

  if (eligibleEvents.length === 0) {
    return [];
  }

  const { data: attendanceRows, error: attendanceError } =
    await supabase
      .from('attendance')
      .select('event_id, scanned_at')
      .eq('student_id', studentId)
      .in('event_id', eligibleEvents.map((event) => event.id))
      .order('scanned_at', { ascending: true });

  if (attendanceError) {
    throw new Error(
      `Failed to load student attendance: ${attendanceError.message}`
    );
  }

  const attendanceByEvent = new Map<string, string>();

  (attendanceRows ?? []).forEach((row) => {
    if (!attendanceByEvent.has(row.event_id)) {
      attendanceByEvent.set(row.event_id, row.scanned_at);
    }
  });

  const now = Date.now();

  return eligibleEvents.map((event) => {
    const scannedAt = attendanceByEvent.get(event.id) ?? null;
    const startTime = event.start_time
      ? new Date(event.start_time).getTime()
      : null;
    const endTime = event.end_time
      ? new Date(event.end_time).getTime()
      : null;

    const hasValidStart =
      startTime !== null && !Number.isNaN(startTime);
    const hasValidEnd =
      endTime !== null && !Number.isNaN(endTime);

    const isClosed =
      String(event.status ?? '').toLowerCase() === 'closed';

    const eventEnded =
      isClosed || (hasValidEnd && now > endTime!);

    let attendanceStatus: StudentEventHistoryRecord['attendanceStatus'];

    if (scannedAt) {
      attendanceStatus = 'Present';
    } else if (isClosed || eventEnded) {
      attendanceStatus = 'Absent';
    } else if (hasValidStart && now < startTime!) {
      attendanceStatus = 'Upcoming';
    } else {
      attendanceStatus = 'Not yet scanned';
    }

    return {
      eventId: event.id,
      eventCode: event.event_code ?? '',
      eventTitle: event.title ?? 'Untitled Event',
      eventType: event.event_type ?? null,
      classSection: event.class_section ?? null,
      startTime: event.start_time ?? null,
      endTime: event.end_time ?? null,
      attendanceStatus,
      scannedAt,
    };
  });
}

/**
 * Get attendance records for events created by a teacher.
 */
export async function getTeacherAttendanceHistory(
  teacherId: string
): Promise<TeacherEventAttendance[]> {
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id')
    .eq('created_by', teacherId);

  if (eventsError) {
    throw new Error(
      `Failed to load teacher events: ${eventsError.message}`
    );
  }

  const eventIds = (events ?? []).map((event) => event.id);

  if (eventIds.length === 0) {
    return [];
  }

  const { data: attendanceRows, error: attendanceError } =
    await supabase
      .from('attendance')
      .select('student_id, scanned_at, event_id')
      .in('event_id', eventIds)
      .order('scanned_at', { ascending: false });

  if (attendanceError) {
    throw new Error(
      `Failed to load teacher attendance: ${attendanceError.message}`
    );
  }

  return (attendanceRows ?? []).map((row) => ({
    studentId: row.student_id,
    scannedAt: row.scanned_at,
    eventId: row.event_id,
  }));
}

/**
 * Get attendees for one teacher-owned event, including approved photos.
 */
export async function getTeacherEventAttendees(
  teacherId: string,
  eventId: string
): Promise<TeacherEventAttendee[]> {
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, created_by')
    .eq('id', eventId)
    .maybeSingle();

  if (eventError) {
    throw new Error(`Failed to load event: ${eventError.message}`);
  }

  if (!event || event.created_by !== teacherId) {
    throw new Error('Event not found or not accessible.');
  }

  const { data: attendanceRows, error: attendanceError } =
    await supabase
      .from('attendance')
      .select('id, student_id, scanned_at')
      .eq('event_id', eventId)
      .order('scanned_at', { ascending: true });

  if (attendanceError) {
    throw new Error(
      `Failed to load event attendees: ${attendanceError.message}`
    );
  }

  const studentIds = [
    ...new Set((attendanceRows ?? []).map((row) => row.student_id)),
  ];

  if (studentIds.length === 0) {
    return [];
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select(
      'id, full_name, education_level, block, year_level, avatar_url, avatar_status'
    )
    .in('id', studentIds);

  if (profilesError) {
    throw new Error(
      `Failed to load attendee profiles: ${profilesError.message}`
    );
  }

  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile])
  );

  return (attendanceRows ?? []).map((row) => {
    const profile = profileById.get(row.student_id);
    const photo = getApprovedAvatar(profile);

    return {
      id: row.id,
      studentId: row.student_id,
      studentName: profile?.full_name ?? 'Unknown Student',
      educationLevel: profile?.education_level ?? null,
      block: profile?.block ?? null,
      yearLevel: profile?.year_level ?? null,
      scannedAt: row.scanned_at,
      avatarUrl: photo.avatarUrl,
      avatarStatus: photo.avatarStatus,
    };
  });
}

/**
 * Get a teacher's events and attendee counts.
 */
export async function getTeacherEventSummary(
  teacherId: string
): Promise<TeacherEventSummary[]> {
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, event_code, title, event_type, class_section')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (eventsError) {
    throw new Error(
      `Failed to load teacher events: ${eventsError.message}`
    );
  }

  if (!events || events.length === 0) {
    return [];
  }

  const eventIds = events.map((event) => event.id);

  const { data: attendanceRows, error: attendanceError } =
    await supabase
      .from('attendance')
      .select('event_id')
      .in('event_id', eventIds);

  if (attendanceError) {
    throw new Error(
      `Failed to count event attendees: ${attendanceError.message}`
    );
  }

  const attendanceCounts = new Map<string, number>();

  (attendanceRows ?? []).forEach((row) => {
    attendanceCounts.set(
      row.event_id,
      (attendanceCounts.get(row.event_id) ?? 0) + 1
    );
  });

  return events.map((event) => ({
    eventId: event.id,
    eventCode: event.event_code,
    title: event.title,
    attendeeCount: attendanceCounts.get(event.id) ?? 0,
    eventType: event.event_type ?? null,
    classSection: event.class_section ?? null,
  }));
}

/**
 * Shared roster logic used by Teacher and Admin.
 */
async function loadEventRoster(
  eventId: string,
  teacherId?: string
): Promise<TeacherEventRoster> {
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select(
      'id, title, event_type, class_section, start_time, end_time, status, created_by'
    )
    .eq('id', eventId)
    .maybeSingle();

  if (eventError) {
    throw new Error(`Failed to load event: ${eventError.message}`);
  }

  if (!event) {
    throw new Error('Event not found or not accessible.');
  }

  if (teacherId && event.created_by !== teacherId) {
    throw new Error('Event not found or not accessible.');
  }

  const { data: attendanceRows, error: attendanceError } =
    await supabase
      .from('attendance')
      .select('student_id, scanned_at')
      .eq('event_id', eventId);

  if (attendanceError) {
    throw new Error(
      `Failed to load attendance: ${attendanceError.message}`
    );
  }

  const attendanceByStudent = new Map<string, string>();

  (attendanceRows ?? []).forEach((row) => {
    if (!attendanceByStudent.has(row.student_id)) {
      attendanceByStudent.set(row.student_id, row.scanned_at);
    }
  });

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select(
      'id, full_name, role, education_level, program, block, year_level, avatar_url, avatar_status'
    )
    .eq('role', 'student');

  if (profilesError) {
    throw new Error(
      `Failed to load student profiles: ${profilesError.message}`
    );
  }

  const allStudents = profiles ?? [];
  const isClassroomEvent = event.event_type === 'classroom';

  const eligibleStudents = allStudents.filter((profile) => {
    if (!isClassroomEvent) {
      return true;
    }

    return studentMatchesSection(
      {
        program: profile.program ?? null,
        year_level: profile.year_level ?? null,
        block: profile.block ?? null,
      },
      event.class_section
    );
  });

  const eligibleIds = new Set(
    eligibleStudents.map((profile) => profile.id)
  );

  const now = Date.now();

  const eventEndTime = event.end_time
    ? new Date(event.end_time).getTime()
    : null;

  const isClosed =
    String(event.status ?? '').toLowerCase() === 'closed';

  const eventEnded =
    isClosed ||
    (eventEndTime !== null &&
      !Number.isNaN(eventEndTime) &&
      now > eventEndTime);

  const toRosterStudent = (
    profile: (typeof allStudents)[number],
    isExpectedStudent: boolean
  ): TeacherRosterStudent => {
    const scannedAt = attendanceByStudent.get(profile.id) ?? null;
    const photo = getApprovedAvatar(profile);

    let status: TeacherRosterStudent['status'];

    if (scannedAt) {
      status = 'Present';
    } else if (eventEnded && isExpectedStudent) {
      status = 'Absent';
    } else {
      status = 'Not yet scanned';
    }

    return {
      id: profile.id,
      studentName: profile.full_name ?? 'Unknown Student',
      educationLevel: profile.education_level ?? null,
      program: profile.program ?? null,
      block: profile.block ?? null,
      yearLevel: profile.year_level ?? null,
      status,
      scannedAt,
      avatarUrl: photo.avatarUrl,
      avatarStatus: photo.avatarStatus,
    };
  };

  const students: TeacherRosterStudent[] = eligibleStudents
    .map((profile) => toRosterStudent(profile, true))
    .sort((a, b) => a.studentName.localeCompare(b.studentName));

  const otherAttendees: TeacherRosterStudent[] = isClassroomEvent
    ? allStudents
        .filter(
          (profile) =>
            !eligibleIds.has(profile.id) &&
            attendanceByStudent.has(profile.id)
        )
        .map((profile) => toRosterStudent(profile, false))
        .sort((a, b) => a.studentName.localeCompare(b.studentName))
    : [];

  return {
    title: event.title,
    eventType: event.event_type,
    classSection: event.class_section,
    startTime: event.start_time,
    endTime: event.end_time,
    students,
    otherAttendees,
  };
}

export async function getTeacherEventRoster(
  teacherId: string,
  eventId: string
): Promise<TeacherEventRoster> {
  return loadEventRoster(eventId, teacherId);
}

/**
 * Verify the user's admin role before calling this function.
 * Supabase RLS policies must also protect the underlying records.
 */
export async function getAdminEventRoster(
  eventId: string
): Promise<TeacherEventRoster> {
  return loadEventRoster(eventId);
}
