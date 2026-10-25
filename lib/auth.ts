
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { EducationLevel } from './profiles';

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

let globalSession: Session | null = null;
let globalUser: User | null = null;
let globalLoading = true;
let authInitialized = false;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setAuth(session: Session | null) {
  globalSession = session;
  globalUser = session?.user ?? null;
  globalLoading = false;
  authInitialized = true;
  notify();
}

supabase.auth.onAuthStateChange((event, session) => {
  console.log('AUTH EVENT:', event);

  if (event === 'INITIAL_SESSION' && authInitialized) return;

  setAuth(session);
});

async function restoreSession() {
  if (authInitialized) return;

  try {
    const { data, error } = await supabase.auth.getSession();

    if (authInitialized) return;

    if (error) {
      console.error('SESSION RESTORE ERROR:', error.message);
      setAuth(null);
      return;
    }

    setAuth(data.session);
  } catch (error) {
    if (authInitialized) return;
    console.error('SESSION RESTORE ERROR:', error);
    setAuth(null);
  }
}

void restoreSession();

export function useAuth(): AuthState {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((previous) => previous + 1);
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    session: globalSession,
    user: globalUser,
    loading: globalLoading,
  };
}

export type SignUpProfile = {
  full_name: string;
  role: 'student' | 'teacher';
  education_level?: EducationLevel;
  program?: string;
  block?: string;
  year_level?: string;
};

export async function signUp(
  email: string,
  password: string,
  profile?: SignUpProfile
) {
  const metadata = profile
    ? {
        full_name: profile.full_name.trim(),
        role: profile.role,
        ...(profile.role === 'student'
          ? {
              education_level: profile.education_level,
              program: profile.program?.trim(),
              block: profile.block?.trim(),
              year_level: profile.year_level?.trim(),
            }
          : {}),
      }
    : {};

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: metadata,
    },
  });

  if (error) {
    console.error('SIGN UP ERROR:', error.message);
    return { data, error };
  }

  if (data.session) {
    setAuth(data.session);
  }

  return { data, error: null };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    console.error('LOGIN FAILED:', error.message);
    return { data, error };
  }

  if (!data.session) {
    return {
      data,
      error: new Error(
        'Login succeeded but no session was returned.'
      ),
    };
  }

  setAuth(data.session);

  console.log('LOGIN SUCCESS:', data.user?.id);
  return { data, error: null };
}

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('LOGOUT ERROR:', error.message);
      return { error };
    }

    setAuth(null);
    console.log('LOGOUT SUCCESS');

    return { error: null };
  } catch (error) {
    console.error('LOGOUT ERROR:', error);

    return {
      error:
        error instanceof Error
          ? error
          : new Error('Unable to sign out.'),
    };
  }
}
