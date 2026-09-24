import { getProfile, type Role } from './profiles';

export async function getUserRole(
  userId: string
): Promise<Role | null> {
  const profile = await getProfile(userId);

  return profile?.role ?? null;
}

export async function isTeacher(
  userId: string
): Promise<boolean> {
  const role = await getUserRole(userId);

  return role === 'teacher';
}

export async function isStudent(
  userId: string
): Promise<boolean> {
  const role = await getUserRole(userId);

  return role === 'student';
}