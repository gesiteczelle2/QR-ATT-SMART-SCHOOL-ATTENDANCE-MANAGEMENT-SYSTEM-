import { supabase } from './supabase';

import { parseQRPayload } from './qr';

import { getEventByCode } from './events';

export type AttendanceRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  scannedAt: string;
};

export type RegisterResult = {
  success: boolean;
  message: string;
  eventTitle?: string;
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
};

export async function registerAttendance(
  rawPayload: string,
  studentId: string
): Promise<RegisterResult> {
  const parsed = parseQRPayload(rawPayload);

  if (!parsed.ok) {
    return {
      success: false,
      message: parsed.message,
    };
  }

  const payload = parsed.payload;

  const now = Date.now();

  const start = payload.start
    ? new Date(payload.start).getTime()
    : null;

  const end = payload.end
    ? new Date(payload.end).getTime()
    : null;

  if (start && now < start) {
    return {
      success: false,
      message: 'Event has not started yet.',
    };
  }

  if (end && now > end) {
    return {
      success: false,
      message: 'Event has already ended.',
    };
  }

  const title = payload.title ?? payload.event;

  let event: {
    id: string;
    title: string;
  } | null = null;

  const foundEvent = await getEventByCode(
    payload.event
  );

  if (foundEvent) {
    event = foundEvent;
  } else {
    const {
      data: newEvent,
      error: insertError,
    } = await supabase
      .from('events')
      .insert([
        {
          event_code: payload.event,
          title,
          start_time: payload.start ?? null,
          end_time: payload.end ?? null,
        },
      ])
      .select('id, title')
      .single();

    if (insertError || !newEvent) {
      return {
        success: false,
        message: 'Could not create event.',
      };
    }

    event = newEvent;
  }

  const { error: attendanceError } =
    await supabase
      .from('attendance')
      .insert([
        {
          student_id: studentId,
          event_id: event.id,
        },
      ]);

  if (attendanceError) {
    if (attendanceError.code === '23505') {
      return {
        success: false,
        message: 'Already registered for this event.',
        eventTitle: event.title,
      };
    }

    return {
      success: false,
      message: attendanceError.message,
      eventTitle: event.title,
    };
  }

  return {
    success: true,
    message: 'Attendance recorded!',
    eventTitle: event.title,
  };
}

export async function getAttendanceHistory(
  studentId: string
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select(
      'id, scanned_at, events ( event_code, title )'
    )
    .eq('student_id', studentId)
    .order('scanned_at', {
      ascending: false,
    });

  if (error || !data) {
    return [];
  }

  return data.map((row: any) => ({
    id: row.id,
    eventId: row.events?.event_code ?? '',
    eventTitle: row.events?.title ?? '',
    scannedAt: row.scanned_at,
  }));
}

export async function getTeacherAttendanceHistory(
  teacherId: string
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select(`
      id,
      scanned_at,
      events!inner (
        event_code,
        title,
        created_by
      )
    `)
    .eq('events.created_by', teacherId)
    .order('scanned_at', {
      ascending: false,
    });

  if (error || !data) {
    return [];
  }

  return data.map((row: any) => ({
    id: row.id,
    eventId: row.events?.event_code ?? '',
    eventTitle: row.events?.title ?? '',
    scannedAt: row.scanned_at,
  }));
}

export async function getTeacherEventAttendance(
  teacherId: string
): Promise<TeacherEventAttendance[]> {
  const { data: events, error: eventsError } =
    await supabase
      .from('events')
      .select('id')
      .eq('created_by', teacherId);

  if (eventsError || !events) {
    return [];
  }

  const eventIds = events.map((event) => event.id);

  if (eventIds.length === 0) {
    return [];
  }

  const {
    data: attendance,
    error: attendanceError,
  } = await supabase
    .from('attendance')
    .select('student_id, scanned_at, event_id')
    .in('event_id', eventIds);

  if (attendanceError || !attendance) {
    return [];
  }

  return attendance.map((row) => ({
    studentId: row.student_id,
    scannedAt: row.scanned_at,
    eventId: row.event_id,
  }));
}

export async function getTeacherEventSummary(
  teacherId: string
): Promise<TeacherEventSummary[]> {
  const {
    data: events,
    error: eventsError,
  } = await supabase
    .from('events')
    .select('id, event_code, title')
    .eq('created_by', teacherId)
    .order('created_at', {
      ascending: false,
    });

  if (eventsError || !events) {
    return [];
  }

  const eventIds = events.map(
    (event) => event.id
  );

  if (eventIds.length === 0) {
    return [];
  }

  const {
    data: attRows,
    error: attError,
  } = await supabase
    .from('attendance')
    .select('event_id')
    .in('event_id', eventIds);

  if (attError || !attRows) {
    return [];
  }

  const counts: Record<string, number> = {};

  attRows.forEach((row) => {
    counts[row.event_id] =
      (counts[row.event_id] ?? 0) + 1;
  });

  return events.map((event) => ({
    eventId: event.id,
    eventCode: event.event_code,
    title: event.title,
    attendeeCount: counts[event.id] ?? 0,
  }));
}