
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { useTheme } from '@/app/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

type Role = 'student' | 'teacher' | 'admin';

type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
};

const ROLES: Role[] = ['student', 'teacher', 'admin'];

const confirmAction = (
  title: string,
  message: string,
  onConfirm: () => void
) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Confirm', onPress: onConfirm },
  ]);
};

const notify = (title: string, message: string) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
};

export default function AdminUsersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');

  const checkAdmin = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setCurrentUserId(auth.user.id);

    const { data, error: roleError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', auth.user.id)
      .single();

    if (roleError) {
      setError(roleError.message);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const admin = data?.role === 'admin';
    setIsAdmin(admin);

    if (!admin) setLoading(false);
  }, []);

  const loadUsers = useCallback(async () => {
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .order('email', { ascending: true });

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      setUsers((data ?? []) as UserProfile[]);
    } catch (err: any) {
      setError(err?.message || 'Unable to load users.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    checkAdmin();
  }, [checkAdmin]);

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin, loadUsers]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesRole =
        roleFilter === 'all' || user.role === roleFilter;

      const matchesSearch =
        !q ||
        user.email.toLowerCase().includes(q) ||
        (user.full_name ?? '').toLowerCase().includes(q);

      return matchesRole && matchesSearch;
    });
  }, [users, search, roleFilter]);

  const handleRoleChange = (user: UserProfile, newRole: Role) => {
    if (user.role === newRole) return;

    if (user.id === currentUserId) {
      notify('Not allowed', 'You cannot change your own role.');
      return;
    }

    confirmAction(
      'Change role?',
      `Change ${user.full_name || user.email} from ${user.role} to ${newRole}?`,
      async () => {
        setUpdatingId(user.id);

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ role: newRole })
          .eq('id', user.id);

        setUpdatingId(null);

        if (updateError) {
          notify('Update failed', updateError.message);
          return;
        }

        setUsers((previous) =>
          previous.map((item) =>
            item.id === user.id ? { ...item, role: newRole } : item
          )
        );
      }
    );
  };

  const handleRefresh = () => {
    setRefreshing(true);
    void loadUsers();
  };

  if (isAdmin === false) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.content}>
          <Header title="Manage Users" />

          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Access Denied</Text>
            <Text style={styles.emptyText}>
              Only administrators can manage users.
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <AppButton
              theme="primary"
              title="Back"
              icon="arrow-back-outline"
              onPress={() => router.back()}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <Header title="Manage Users" />

        <View style={styles.headerSection}>
          <Text style={styles.title}>Users</Text>
          <Text style={styles.subtitle}>
            View all registered students, teachers, and administrators.
          </Text>
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email"
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.chipRow}>
          {(['all', ...ROLES] as const).map((role) => {
            const active = roleFilter === role;

            return (
              <Pressable
                key={role}
                onPress={() => setRoleFilter(role)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text
                  style={[
                    styles.chipText,
                    active && styles.chipTextActive,
                  ]}
                >
                  {role}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading && (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={styles.loader}
          />
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => {
                if (isAdmin) void loadUsers();
                else void checkAdmin();
              }}
            >
              <Text style={styles.retryText}>Try Again</Text>
            </Pressable>
          </View>
        )}

        {!loading && !error && filteredUsers.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No Users Found</Text>
            <Text style={styles.emptyText}>
              {users.length === 0
                ? 'No profiles were returned. If users exist, check the admin read policy (RLS) on the profiles table.'
                : 'No users match your search or filter.'}
            </Text>
          </View>
        )}

        {!loading &&
          !error &&
          filteredUsers.map((user) => (
            <View key={user.id} style={styles.userCard}>
              <Text style={styles.name}>
                {user.full_name || 'No name'}
              </Text>
              <Text style={styles.email}>{user.email}</Text>

              <View style={styles.roleBox}>
                <Text style={styles.roleLabel}>Role</Text>

                {updatingId === user.id ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.primary}
                  />
                ) : (
                  <View style={styles.chipRow}>
                    {ROLES.map((role) => {
                      const active = user.role === role;

                      return (
                        <Pressable
                          key={role}
                          onPress={() => handleRoleChange(user, role)}
                          style={[
                            styles.chip,
                            active && styles.chipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              active && styles.chipTextActive,
                            ]}
                          >
                            {role}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          ))}

        <View style={styles.buttonContainer}>
          <AppButton
            theme="primary"
            title="Refresh Users"
            icon="refresh-outline"
            onPress={loadUsers}
          />
        </View>

        <View style={styles.buttonContainer}>
          <AppButton
            theme="primary"
            title="Back to Dashboard"
            icon="arrow-back-outline"
            onPress={() => router.back()}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(
  colors: ReturnType<typeof useTheme>['colors']
) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: 40,
    },
    headerSection: {
      marginTop: 20,
      marginBottom: 20,
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
    searchInput: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.textPrimary,
      marginBottom: 12,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 14,
    },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.card,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: 13,
      color: colors.textPrimary,
      textTransform: 'capitalize',
    },
    chipTextActive: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    loader: {
      marginTop: 30,
      marginBottom: 30,
    },
    errorBox: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: 10,
      padding: 14,
      marginBottom: 16,
    },
    errorText: {
      fontSize: 14,
      color: colors.danger,
      lineHeight: 20,
    },
    retryButton: {
      alignSelf: 'flex-start',
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginTop: 12,
    },
    retryText: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    emptyBox: {
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: 12,
      padding: 20,
      alignItems: 'center',
      marginBottom: 20,
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
      lineHeight: 20,
    },
    userCard: {
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    name: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 5,
    },
    email: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    roleBox: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 8,
      padding: 10,
    },
    roleLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    buttonContainer: {
      marginTop: 12,
    },
  });
}
