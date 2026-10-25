
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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

import Header from '@/components/Header';
import { useTheme } from '@/app/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

type PendingPhoto = {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string;
  imageUrl: string | null;
};

const REJECTION_REASONS = [
  'Photo does not clearly show the student',
  'School uniform is not visible',
  'Photo is blurry or too dark',
  'Incorrect photo uploaded',
  'AI-generated picture suspected',
  'Other',
];

function showMessage(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function confirmAction(
  title: string,
  message: string
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: () => resolve(false),
      },
      {
        text: 'Continue',
        onPress: () => resolve(true),
      },
    ]);
  });
}

export default function AdminPhotosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const [rejectingStudent, setRejectingStudent] =
    useState<PendingPhoto | null>(null);
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  const loadPhotos = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .eq('avatar_status', 'pending')
        .not('avatar_url', 'is', null)
        .order('full_name');

      if (error) throw error;

      const results: PendingPhoto[] = await Promise.all(
        (data ?? []).map(async (student) => {
          const { data: signedData, error: signedError } =
            await supabase.storage
              .from('avatars')
              .createSignedUrl(student.avatar_url, 3600);

          if (signedError) {
            console.error(
              'Could not load photo for:',
              student.id,
              signedError.message
            );
          }

          return {
            id: student.id,
            full_name: student.full_name,
            email: student.email,
            avatar_url: student.avatar_url,
            imageUrl: signedError
              ? null
              : signedData?.signedUrl ?? null,
          };
        })
      );

      setPhotos(results);
    } catch (error) {
      console.error('Load pending photos error:', error);

      showMessage(
        'Unable to Load Photos',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPhotos();
    }, [loadPhotos])
  );

  const reviewPhoto = async (
    student: PendingPhoto,
    status: 'approved' | 'rejected',
    reason: string | null = null
  ) => {
    if (reviewingId !== null) return;

    setReviewingId(student.id);

    try {
      console.log('Reviewing student photo:', {
        studentId: student.id,
        status,
        reason,
      });

      const { data, error } = await supabase.rpc(
        'review_student_avatar',
        {
          target_user_id: student.id,
          new_status: status,
          rejection_reason: reason,
        }
      );

      console.log('Review RPC result:', { data, error });

      if (error) {
        throw new Error(error.message);
      }

      // Verify the database actually saved the decision.
      const { data: savedProfile, error: verifyError } = await supabase
        .from('profiles')
        .select('avatar_status, avatar_rejection_reason')
        .eq('id', student.id)
        .maybeSingle();

      if (verifyError) {
        throw new Error(
          `Review request completed, but verification failed: ${verifyError.message}`
        );
      }

      if (!savedProfile || savedProfile.avatar_status !== status) {
        throw new Error(
          `The database did not confirm the ${status} status. Check the review_student_avatar function and its permissions.`
        );
      }

      setPhotos((current) =>
        current.filter((item) => item.id !== student.id)
      );

      setRejectingStudent(null);
      setSelectedReason('');
      setCustomReason('');

      showMessage(
        status === 'approved' ? 'Photo Approved' : 'Photo Rejected',
        status === 'approved'
          ? `${student.full_name || 'The student'}'s photo has been approved successfully.`
          : `The photo was rejected. Reason: ${reason}`
      );
    } catch (error) {
      console.error(`${status} photo error:`, error);

      showMessage(
        status === 'approved' ? 'Approval Failed' : 'Rejection Failed',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setReviewingId(null);
    }
  };

  const approvePhoto = async (student: PendingPhoto) => {
    const confirmed = await confirmAction(
      'Approve Photo',
      `Approve ${student.full_name || 'this student'}'s photo?`
    );

    if (!confirmed) return;

    await reviewPhoto(student, 'approved');
  };

  const openRejectForm = (student: PendingPhoto) => {
    setRejectingStudent(student);
    setSelectedReason('');
    setCustomReason('');
  };

  const submitRejection = async () => {
    if (!rejectingStudent || reviewingId !== null) return;

    const reason =
      selectedReason === 'Other'
        ? customReason.trim()
        : selectedReason;

    if (!reason) {
      showMessage(
        'Reason Required',
        'Please select a reason. If you choose Other, please enter the details.'
      );
      return;
    }

    await reviewPhoto(rejectingStudent, 'rejected', reason);
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
        keyboardShouldPersistTaps="handled"
      >
        <Header title="Uniform Photo Review" />

        <Text style={styles.title}>Pending Uniform Photos</Text>

        <Text style={styles.subtitle}>
          Review each photo before approving or rejecting it.
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && styles.pressed,
            (loading || reviewingId !== null) &&
              styles.disabledButton,
          ]}
          onPress={() => void loadPhotos()}
          disabled={loading || reviewingId !== null}
        >
          <Text style={styles.refreshText}>
            {loading ? 'Refreshing...' : 'Refresh List'}
          </Text>
        </Pressable>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={styles.loader}
          />
        ) : photos.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Pending Photos</Text>
            <Text style={styles.emptyText}>
              New photo submissions will appear here.
            </Text>
          </View>
        ) : (
          photos.map((student) => (
            <View key={student.id} style={styles.card}>
              {student.imageUrl ? (
                <Image
                  source={{ uri: student.imageUrl }}
                  style={styles.photo}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.photo, styles.noPhoto]}>
                  <Text style={styles.noPhotoText}>
                    Photo unavailable
                  </Text>
                </View>
              )}

              <Text style={styles.studentName}>
                {student.full_name || 'Unnamed Student'}
              </Text>

              <Text style={styles.email}>{student.email}</Text>

              <View style={styles.pendingBadge}>
                <View style={styles.pendingDot} />
                <Text style={styles.pendingLabel}>
                  Pending Review
                </Text>
              </View>

              <View style={styles.actions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.approveButton,
                    pressed && styles.pressed,
                    reviewingId !== null && styles.disabledButton,
                  ]}
                  disabled={reviewingId !== null}
                  onPress={() => void approvePhoto(student)}
                >
                  <Text style={styles.actionText}>
                    {reviewingId === student.id
                      ? 'Please wait...'
                      : 'Approve'}
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.rejectButton,
                    pressed && styles.pressed,
                    reviewingId !== null && styles.disabledButton,
                  ]}
                  disabled={reviewingId !== null}
                  onPress={() => openRejectForm(student)}
                >
                  <Text style={styles.actionText}>Reject</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        {rejectingStudent && (
          <View style={styles.rejectForm}>
            <Text style={styles.formTitle}>Reject Student Photo</Text>

            <Text style={styles.formSubtitle}>
              Select a reason to tell the student why the photo was rejected.
            </Text>

            <Text style={styles.studentName}>
              {rejectingStudent.full_name || 'Unnamed Student'}
            </Text>

            {REJECTION_REASONS.map((reason) => (
              <Pressable
                key={reason}
                style={styles.reasonOption}
                onPress={() => setSelectedReason(reason)}
                disabled={reviewingId !== null}
              >
                <View
                  style={[
                    styles.radioOuter,
                    selectedReason === reason &&
                      styles.radioOuterSelected,
                  ]}
                >
                  {selectedReason === reason && (
                    <View style={styles.radioInner} />
                  )}
                </View>

                <Text style={styles.reasonText}>{reason}</Text>
              </Pressable>
            ))}

            {selectedReason === 'Other' && (
              <TextInput
                style={styles.reasonInput}
                placeholder="Enter the rejection reason"
                placeholderTextColor={colors.textSecondary}
                value={customReason}
                onChangeText={setCustomReason}
                multiline
                editable={reviewingId === null}
              />
            )}

            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.cancelButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => setRejectingStudent(null)}
                disabled={reviewingId !== null}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.rejectButton,
                  pressed && styles.pressed,
                  reviewingId !== null && styles.disabledButton,
                ]}
                onPress={() => void submitRejection()}
                disabled={reviewingId !== null}
              >
                <Text style={styles.actionText}>
                  {reviewingId === rejectingStudent.id
                    ? 'Submitting...'
                    : 'Confirm Rejection'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
          onPress={() => router.replace('/admin')}
        >
          <Text style={styles.backText}>Back to Dashboard</Text>
        </Pressable>
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
    title: {
      fontSize: 23,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 22,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 21,
      marginBottom: 16,
    },
    refreshButton: {
      alignSelf: 'flex-start',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 18,
    },
    refreshText: {
      color: colors.textPrimary,
      fontWeight: '600',
    },
    loader: {
      marginTop: 30,
    },
    emptyCard: {
      padding: 22,
      borderRadius: 16,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
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
      lineHeight: 21,
    },
    card: {
      padding: 16,
      marginBottom: 18,
      borderRadius: 18,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    photo: {
      width: '100%',
      height: 400,
      borderRadius: 12,
      backgroundColor: colors.backgroundSecondary,
      marginBottom: 16,
    },
    noPhoto: {
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    noPhotoText: {
      color: colors.textSecondary,
      textAlign: 'center',
    },
    studentName: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    email: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    pendingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginBottom: 12,
      gap: 7,
    },
    pendingDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.warning,
    },
    pendingLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 8,
    },
    actionButton: {
      flex: 1,
      minHeight: 46,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    approveButton: {
      backgroundColor: colors.success,
    },
    rejectButton: {
      backgroundColor: colors.danger,
    },
    cancelButton: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelText: {
      color: colors.textPrimary,
      fontWeight: '700',
      textAlign: 'center',
    },
    disabledButton: {
      opacity: 0.5,
    },
    pressed: {
      opacity: 0.75,
    },
    actionText: {
      color: '#FFFFFF',
      fontWeight: '700',
      textAlign: 'center',
    },
    rejectForm: {
      padding: 18,
      marginTop: 10,
      marginBottom: 20,
      borderRadius: 18,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    formTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    formSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 21,
      marginBottom: 14,
    },
    reasonOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      gap: 10,
    },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOuterSelected: {
      borderColor: colors.primary,
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    reasonText: {
      flex: 1,
      fontSize: 14,
      color: colors.textPrimary,
      lineHeight: 20,
    },
    reasonInput: {
      minHeight: 90,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      marginTop: 8,
      color: colors.textPrimary,
      backgroundColor: colors.backgroundSecondary,
      textAlignVertical: 'top',
    },
    backButton: {
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
      borderRadius: 12,
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    backText: {
      color: colors.textPrimary,
      fontWeight: '600',
    },
  });
}
