
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { useTheme } from '@/app/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

type TeacherRequest = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  approval_status: 'pending' | 'approved' | 'rejected';
};

export default function AdminTeachersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [teachers, setTeachers] = useState<TeacherRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const loadTeachers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, approval_status')
        .eq('role', 'teacher')
        .eq('approval_status', 'pending')
        .order('full_name', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      setTeachers((data ?? []) as TeacherRequest[]);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Please try again.';

      setFeedback({
        type: 'error',
        message: `Unable to load teacher requests: ${message}`,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadTeachers();
    }, [loadTeachers])
  );

  const refreshRequests = () => {
    setRefreshing(true);
    void loadTeachers();
  };

  const updateTeacherStatus = async (
    teacher: TeacherRequest,
    status: 'approved' | 'rejected'
  ) => {
    if (processingId) return;

    setProcessingId(teacher.id);
    setFeedback(null);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ approval_status: status })
        .eq('id', teacher.id)
        .eq('role', 'teacher')
        .eq('approval_status', 'pending')
        .select('id')
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        setFeedback({
          type: 'error',
          message:
            'No row was updated. Check your Supabase UPDATE policies and confirm that this request is still pending.',
        });

        await loadTeachers();
        return;
      }

      setTeachers((previous) =>
        previous.filter((item) => item.id !== teacher.id)
      );

      setFeedback({
        type: 'success',
        message:
          status === 'approved'
            ? `${teacher.full_name || teacher.email} has been approved. The teacher can now sign in.`
            : `${teacher.full_name || teacher.email} has been rejected.`,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Please try again.';

      setFeedback({
        type: 'error',
        message: `Update failed: ${message}`,
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshRequests}
            tintColor={colors.primary}
          />
        }
      >
        <Header title="Teacher Approval" />

        <View style={styles.heading}>
          <Text style={styles.title}>
            Teacher Registration Requests
          </Text>

          <Text style={styles.subtitle}>
            Review new teacher accounts before allowing access to the teacher dashboard.
          </Text>
        </View>

        {feedback && (
          <View
            style={[
              styles.feedbackCard,
              feedback.type === 'error'
                ? styles.feedbackError
                : styles.feedbackSuccess,
            ]}
          >
            <Text style={styles.feedbackText}>
              {feedback.message}
            </Text>
          </View>
        )}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>
            Pending Requests
          </Text>

          <Text style={styles.summaryCount}>
            {loading ? '—' : teachers.length}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={colors.primary}
            />
            <Text style={styles.loadingText}>
              Loading teacher requests...
            </Text>
          </View>
        ) : teachers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              No Pending Requests
            </Text>

            <Text style={styles.emptyText}>
              New teacher registrations will appear here for review.
            </Text>

            <AppButton
              theme="primary"
              title="Refresh"
              icon="refresh-outline"
              onPress={refreshRequests}
            />
          </View>
        ) : (
          teachers.map((teacher) => {
            const isProcessing = processingId === teacher.id;

            return (
              <View key={teacher.id} style={styles.teacherCard}>
                <View style={styles.teacherHeader}>
                  <View style={styles.teacherInfo}>
                    <Text style={styles.teacherName}>
                      {teacher.full_name || 'Name not provided'}
                    </Text>

                    <Text style={styles.email}>
                      {teacher.email}
                    </Text>
                  </View>

                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingText}>
                      Pending
                    </Text>
                  </View>
                </View>

                {isProcessing ? (
                  <View style={styles.processing}>
                    <ActivityIndicator
                      size="small"
                      color={colors.primary}
                    />
                    <Text style={styles.loadingText}>
                      Updating request...
                    </Text>
                  </View>
                ) : (
                  <View style={styles.actions}>
                    <View style={styles.actionButton}>
                      <AppButton
                        theme="primary"
                        title="Approve"
                        icon="checkmark-circle-outline"
                        onPress={() =>
                          updateTeacherStatus(teacher, 'approved')
                        }
                      />
                    </View>

                    <View style={styles.actionButton}>
                      <AppButton
                        theme="primary"
                        title="Reject"
                        icon="close-circle-outline"
                        onPress={() =>
                          updateTeacherStatus(teacher, 'rejected')
                        }
                      />
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}

        <View style={styles.backButton}>
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

    heading: {
      marginTop: 24,
      marginBottom: 20,
    },

    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 8,
    },

    subtitle: {
      fontSize: 14,
      lineHeight: 21,
      color: colors.textSecondary,
    },

    feedbackCard: {
      padding: 14,
      borderRadius: 10,
      borderWidth: 1,
      marginBottom: 16,
    },

    feedbackError: {
      borderColor: '#DC2626',
    },

    feedbackSuccess: {
      borderColor: '#16A34A',
    },

    feedbackText: {
      color: colors.textPrimary,
      fontSize: 14,
      lineHeight: 21,
    },

    summaryCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 18,
      marginBottom: 20,
    },

    summaryLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },

    summaryCount: {
      fontSize: 30,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 6,
    },

    loadingContainer: {
      alignItems: 'center',
      paddingVertical: 40,
    },

    loadingText: {
      color: colors.textSecondary,
      marginTop: 12,
      fontSize: 13,
    },

    emptyCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 20,
      marginBottom: 20,
    },

    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 8,
    },

    emptyText: {
      fontSize: 14,
      lineHeight: 21,
      color: colors.textSecondary,
      marginBottom: 18,
    },

    teacherCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      marginBottom: 14,
    },

    teacherHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 16,
    },

    teacherInfo: {
      flex: 1,
      marginRight: 10,
    },

    teacherName: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 5,
    },

    email: {
      fontSize: 13,
      color: colors.textSecondary,
    },

    pendingBadge: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },

    pendingText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },

    actions: {
      flexDirection: 'row',
      gap: 10,
    },

    actionButton: {
      flex: 1,
    },

    processing: {
      alignItems: 'center',
      paddingVertical: 12,
    },

    backButton: {
      marginTop: 20,
    },
  });
}
