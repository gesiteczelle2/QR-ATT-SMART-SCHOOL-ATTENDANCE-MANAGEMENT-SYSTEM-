
import { supabase } from './supabase';

export type Role = 'student' | 'teacher' | 'admin';

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected';

export type AvatarStatus =
  | 'none'
  | 'pending'
  | 'approved'
  | 'rejected';

export type EducationLevel = 'SHS' | 'College';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  approval_status: ApprovalStatus;
  avatar_url: string | null;
  avatar_status: AvatarStatus;
  avatar_rejection_reason: string | null;
  education_level: EducationLevel | null;
  program: string | null;
  block: string | null;
  year_level: string | null;
};

export async function getProfile(
  userId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      [
        'id',
        'email',
        'full_name',
        'role',
        'approval_status',
        'avatar_url',
        'avatar_status',
        'avatar_rejection_reason',
        'education_level',
        'program',
        'block',
        'year_level',
      ].join(', ')
    )
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as Profile | null;
}

export async function updateProfile(
  userId: string,
  updates: {
    full_name?: string;
    avatar_url?: string | null;
    avatar_status?: AvatarStatus;
    avatar_rejection_reason?: string | null;
    education_level?: EducationLevel | null;
    program?: string | null;
    block?: string | null;
    year_level?: string | null;
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  return {
    error: error?.message ?? null,
  };
}
