
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
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth, signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  getProfile,
  updateProfile,
  type Profile,
} from '@/lib/profiles';
import { useTheme } from '@/app/contexts/ThemeContext';

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

function showMessage(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function confirmMessage(title: string, message: string): Promise<boolean> {
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

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isDark, colors, toggleTheme } = useTheme();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editing, setEditing] = useState(false);

  const [name, setName] = useState('');
  const [avatarDisplayUrl, setAvatarDisplayUrl] =
    useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      setAvatarDisplayUrl(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const currentProfile = await getProfile(user.id);
      setProfile(currentProfile);

      if (currentProfile) {
        setName(currentProfile.full_name ?? '');

        if (currentProfile.avatar_url) {
          const { data, error } = await supabase.storage
            .from('avatars')
            .createSignedUrl(currentProfile.avatar_url, 3600);

          if (error) {
            console.error('Avatar URL error:', error.message);
          }

          setAvatarDisplayUrl(
            !error && data?.signedUrl ? data.signedUrl : null
          );
        } else {
          setAvatarDisplayUrl(null);
        }
      } else {
        setAvatarDisplayUrl(null);
      }
    } catch (error) {
      console.error('Load profile error:', error);

      showMessage(
        'Error',
        error instanceof Error
          ? error.message
          : 'Unable to load your profile.'
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile])
  );

  const handleSaveDetails = async () => {
    if (!user?.id || !profile || saving) return;

    const cleanName = name.trim();

    if (!cleanName) {
      showMessage('Required', 'Please enter your full name.');
      return;
    }

    try {
      setSaving(true);

      const result = await updateProfile(user.id, {
        full_name: cleanName,
      });

      if (result.error) {
        showMessage('Update Failed', result.error);
        return;
      }

      setEditing(false);
      await loadProfile();

      showMessage('Success', 'Your profile has been updated.');
    } catch (error) {
      showMessage(
        'Error',
        error instanceof Error
          ? error.message
          : 'Unable to update your profile.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleChoosePhoto = async () => {
    if (!user?.id || !profile || uploadingPhoto) return;

    let uploadedStoragePath: string | null = null;

    try {
      console.log('Opening photo library...');

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) {
        console.log('Photo selection cancelled.');
        return;
      }

      const asset = result.assets[0];

      console.log('PHOTO SELECTED:', {
        uri: asset.uri,
        mimeType: asset.mimeType,
        fileName: asset.fileName,
        fileSize: asset.fileSize,
        hasFile: !!asset.file,
      });

      const fileName = asset.fileName ?? '';
      const mimeType = asset.mimeType?.toLowerCase() ?? '';
      const extensionFromName = fileName.split('.').pop()?.toLowerCase();

      const extension =
        extensionFromName &&
        ['jpg', 'jpeg', 'png', 'webp'].includes(extensionFromName)
          ? extensionFromName
          : mimeType === 'image/png'
            ? 'png'
            : mimeType === 'image/webp'
              ? 'webp'
              : 'jpg';

      if (
        mimeType &&
        !['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(
          mimeType
        )
      ) {
        showMessage(
          'Invalid Image',
          'Please select a JPG, PNG, or WebP image.'
        );
        return;
      }

      if (asset.fileSize && asset.fileSize > MAX_IMAGE_SIZE) {
        showMessage(
          'Image Too Large',
          'Please select an image that is 2 MB or smaller.'
        );
        return;
      }

      if (profile.role === 'student') {
        const confirmed = await confirmMessage(
          'Student Profile Photo',
          'Please use a clear photo of yourself wearing your school uniform. Your new photo will need admin approval. Continue with this photo?'
        );

        if (!confirmed) return;
      }

      setUploadingPhoto(true);

      let uploadBody: Blob | ArrayBuffer;
      let imageSize: number;

      if (Platform.OS === 'web') {
        if (asset.file) {
          uploadBody = asset.file;
          imageSize = asset.file.size;
        } else {
          const response = await fetch(asset.uri);

          if (!response.ok) {
            throw new Error(
              `Could not read selected photo. Status: ${response.status}`
            );
          }

          const photoBlob = await response.blob();
          uploadBody = photoBlob;
          imageSize = photoBlob.size;
        }
      } else {
        const response = await fetch(asset.uri);

        if (!response.ok) {
          throw new Error(
            `Could not read selected photo. Status: ${response.status}`
          );
        }

        const fileBody = await response.arrayBuffer();
        uploadBody = fileBody;
        imageSize = fileBody.byteLength;
      }

      console.log('Photo bytes:', imageSize);

      if (imageSize === 0) {
        throw new Error(
          'The selected photo is empty. Please choose another photo.'
        );
      }

      if (imageSize > MAX_IMAGE_SIZE) {
        showMessage(
          'Image Too Large',
          'Please select an image that is 2 MB or smaller.'
        );
        return;
      }

      const storagePath = `${user.id}/${Date.now()}.${extension}`;
      const contentType =
        mimeType ||
        (extension === 'jpg' || extension === 'jpeg'
          ? 'image/jpeg'
          : `image/${extension}`);

      console.log('Uploading to Supabase Storage:', storagePath);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(storagePath, uploadBody, {
          contentType,
          upsert: false,
        });

      console.log('UPLOAD RESULT:', uploadError?.message ?? 'Success');

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      uploadedStoragePath = storagePath;

      const avatarStatus =
        profile.role === 'student' ? 'pending' : 'approved';

      console.log('Updating profile:', {
        userId: user.id,
        avatarStatus,
        storagePath,
      });

      const updateResult = await updateProfile(user.id, {
        avatar_url: storagePath,
        avatar_status: avatarStatus,
        avatar_rejection_reason: null,
      });

      if (updateResult.error) {
        throw new Error(
          `Photo uploaded, but profile update failed: ${updateResult.error}`
        );
      }

      const savedProfile = await getProfile(user.id);

      if (
        !savedProfile ||
        savedProfile.avatar_url !== storagePath ||
        savedProfile.avatar_status !== avatarStatus
      ) {
        throw new Error(
          'The photo was uploaded, but the database did not save the expected photo status. Please check your Supabase profiles update policy and updateProfile function.'
        );
      }

      uploadedStoragePath = null;

      await loadProfile();

      showMessage(
        'Photo Uploaded',
        profile.role === 'student'
          ? 'Your photo has been submitted for admin approval.'
          : 'Your profile photo has been updated.'
      );
    } catch (error) {
      console.error('Photo selection/upload error:', error);

      if (uploadedStoragePath) {
        const { error: removeError } = await supabase.storage
          .from('avatars')
          .remove([uploadedStoragePath]);

        if (removeError) {
          console.error(
            'Could not remove unused photo:',
            removeError.message
          );
        }
      }

      showMessage(
        'Photo Upload Error',
        error instanceof Error
          ? error.message
          : 'Unable to upload your profile photo.'
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const result = await signOut();

      if (result.error) {
        showMessage('Sign Out Failed', result.error.message);
        return;
      }

      router.replace('/login');
    } catch (error) {
      showMessage(
        'Error',
        error instanceof Error
          ? error.message
          : 'Unable to sign out.'
      );
    }
  };

  const displayRole = (role: string) =>
    role.charAt(0).toUpperCase() + role.slice(1);

  const styles = createStyles(colors);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons
          name="person-circle-outline"
          size={56}
          color={colors.primary}
        />
        <Text style={styles.loadingText}>
          Your profile could not be loaded.
        </Text>
        <AppButton
          title="Try Again"
          icon="refresh-outline"
          theme="primary"
          onPress={() => void loadProfile()}
        />
      </View>
    );
  }

  const isStudent = profile.role === 'student';

  const educationLabel =
    profile.education_level === 'SHS'
      ? 'Senior High School'
      : profile.education_level === 'College'
        ? 'College'
        : 'Not provided';

  const programLabel =
    profile.education_level === 'SHS'
      ? 'Strand'
      : 'Program / Course';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        <Text style={styles.headerSubtitle}>
          Manage your account and personal information
        </Text>
      </View>

      <View style={styles.themeCard}>
        <View style={styles.themeInfo}>
          <Ionicons
            name={isDark ? 'moon' : 'sunny'}
            size={23}
            color={colors.primary}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.themeTitle}>Appearance</Text>
            <Text style={styles.themeSubtitle}>
              {isDark ? 'Dark Mode is on' : 'Light Mode is on'}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={toggleTheme}
          style={styles.themeToggle}
          accessibilityRole="button"
          accessibilityLabel={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
        >
          <Ionicons
            name={isDark ? 'sunny-outline' : 'moon-outline'}
            size={18}
            color="#FFFFFF"
          />
          <Text style={styles.themeToggleText}>
            Switch to {isDark ? 'Light' : 'Dark'} Mode
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.photoContainer}>
          <View style={styles.avatar}>
            {avatarDisplayUrl &&
            (!isStudent || profile.avatar_status === 'approved') ? (
              <Image
                source={{ uri: avatarDisplayUrl }}
                style={styles.avatarImage}
              />
            ) : (
              <Ionicons
                name="person"
                size={52}
                color={colors.primary}
              />
            )}
          </View>

          <Pressable
            style={[
              styles.photoButton,
              uploadingPhoto && styles.photoButtonDisabled,
            ]}
            onPress={() => void handleChoosePhoto()}
            disabled={uploadingPhoto}
          >
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name="camera-outline"
                  size={17}
                  color="#FFFFFF"
                />
                <Text style={styles.photoButtonText}>Change Photo</Text>
              </>
            )}
          </Pressable>

          {isStudent && (
            <Text style={styles.uniformHint}>
              Students must use a clear photo wearing their school uniform.
            </Text>
          )}

          {isStudent && profile.avatar_status === 'pending' && (
            <View style={styles.statusBox}>
              <Ionicons name="time-outline" size={18} color="#9A6700" />
              <Text style={styles.pendingText}>
                Photo waiting for admin approval
              </Text>
            </View>
          )}

          {isStudent && profile.avatar_status === 'rejected' && (
            <View style={styles.rejectedBox}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color="#B42318"
              />
              <View style={styles.statusTextContainer}>
                <Text style={styles.rejectedText}>Photo was rejected</Text>
                {!!profile.avatar_rejection_reason && (
                  <Text style={styles.reasonText}>
                    Reason: {profile.avatar_rejection_reason}
                  </Text>
                )}
                <Text style={styles.reasonText}>
                  Please upload another suitable photo.
                </Text>
              </View>
            </View>
          )}

          {isStudent && profile.avatar_status === 'approved' && (
            <View style={styles.approvedBox}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color="#067647"
              />
              <Text style={styles.approvedText}>Photo approved</Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Personal Information</Text>

          {!editing && (
            <Pressable
              style={styles.editButton}
              onPress={() => setEditing(true)}
            >
              <Ionicons
                name="create-outline"
                size={17}
                color={colors.primary}
              />
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={[styles.input, !editing && styles.readOnlyInput]}
          value={name}
          onChangeText={setName}
          placeholder="Enter your full name"
          placeholderTextColor={colors.textSecondary}
          editable={editing}
        />

        <Text style={styles.label}>Email Address</Text>
        <TextInput
          style={[styles.input, styles.readOnlyInput]}
          value={profile.email || user?.email || ''}
          editable={false}
        />

        <Text style={styles.label}>Account Role</Text>
        <View style={styles.roleContainer}>
          <Ionicons
            name="shield-checkmark-outline"
            size={18}
            color={colors.primary}
          />
          <Text style={styles.roleText}>
            {displayRole(profile.role)}
          </Text>
        </View>

        {isStudent && (
          <>
            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>School Information</Text>
            <Text style={styles.sectionDescription}>
              These details were provided during registration and cannot be
              edited here. Contact your administrator if corrections are
              needed.
            </Text>

            <Text style={styles.label}>Education Level</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              value={educationLabel}
              editable={false}
            />

            <Text style={styles.label}>{programLabel}</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              value={profile.program || 'Not provided'}
              editable={false}
            />

            <Text style={styles.label}>Block / Section</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              value={profile.block || 'Not provided'}
              editable={false}
            />

            <Text style={styles.label}>Year Level</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              value={profile.year_level || 'Not provided'}
              editable={false}
            />
          </>
        )}

        {editing && (
          <View style={styles.editActions}>
            <AppButton
              title={saving ? 'Saving...' : 'Save Changes'}
              icon="save-outline"
              theme="primary"
              onPress={() => {
                if (!saving) void handleSaveDetails();
              }}
            />

            <Pressable
              style={styles.cancelButton}
              disabled={saving}
              onPress={() => {
                setName(profile.full_name ?? '');
                setEditing(false);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.securityCard}>
        <Ionicons
          name="lock-closed-outline"
          size={22}
          color={colors.primary}
        />
        <View style={styles.securityTextContainer}>
          <Text style={styles.securityTitle}>Account Security</Text>
          <Text style={styles.securityText}>
            Keep your login details private. Your account information is
            managed through the QR-ATT system.
          </Text>
        </View>
      </View>

      <View style={styles.signOutContainer}>
        <AppButton
          title="Sign Out"
          icon="log-out-outline"
          onPress={() => void handleSignOut()}
        />
      </View>

      <Text style={styles.footer}>
        QR-ATT Smart School Attendance Management System
      </Text>
    </ScrollView>
  );
}

function createStyles(colors: typeof COLORS | {
  primary: string;
  background: string;
  backgroundSecondary: string;
  card: string;
  surface: string;
  surfaceLight: string;
  textPrimary: string;
  textSecondary: string;
  textOnPrimary: string;
  border: string;
  shadow: string;
  warning: string;
  success: string;
  danger: string;
  glass: string;
  glassLight: string;
  glassBorder: string;
  overlay: string;
}) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 20,
      paddingBottom: 36,
    },
    header: {
      marginBottom: 20,
    },
    headerTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    headerSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 5,
    },
    themeCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      gap: 14,
    },
    themeInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    themeTitle: {
      color: colors.textPrimary,
      fontWeight: '700',
      fontSize: 15,
    },
    themeSubtitle: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 3,
    },
    themeToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 11,
      borderRadius: 10,
    },
    themeToggleText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 13,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    photoContainer: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    avatar: {
      width: 112,
      height: 112,
      borderRadius: 56,
      backgroundColor: colors.surfaceLight,
      borderWidth: 3,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    photoButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      marginTop: 14,
      minHeight: 40,
    },
    photoButtonDisabled: {
      opacity: 0.7,
    },
    photoButtonText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
    },
    uniformHint: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      marginTop: 10,
      maxWidth: 280,
    },
    statusBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: isDarkStatusBackground(colors.background),
      padding: 10,
      borderRadius: 10,
      marginTop: 12,
    },
    pendingText: {
      color: '#9A6700',
      fontSize: 12,
      fontWeight: '600',
      flexShrink: 1,
    },
    rejectedBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: colors.backgroundSecondary,
      padding: 12,
      borderRadius: 10,
      marginTop: 12,
      width: '100%',
    },
    statusTextContainer: {
      flex: 1,
    },
    rejectedText: {
      color: colors.danger,
      fontWeight: '700',
      fontSize: 13,
    },
    reasonText: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 4,
      lineHeight: 18,
    },
    approvedBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: colors.backgroundSecondary,
      padding: 9,
      borderRadius: 10,
      marginTop: 12,
    },
    approvedText: {
      color: colors.success,
      fontSize: 12,
      fontWeight: '600',
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 20,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    sectionDescription: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 7,
      marginBottom: 8,
    },
    editButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 6,
      paddingHorizontal: 9,
    },
    editButtonText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 13,
    },
    label: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 7,
      marginTop: 13,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: 13,
      paddingVertical: Platform.OS === 'ios' ? 13 : 10,
      color: colors.textPrimary,
      fontSize: 14,
      minHeight: 46,
    },
    readOnlyInput: {
      backgroundColor: colors.backgroundSecondary,
      color: colors.textSecondary,
    },
    roleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 10,
      paddingHorizontal: 13,
      minHeight: 46,
    },
    roleText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '600',
    },
    editActions: {
      marginTop: 22,
      gap: 10,
    },
    cancelButton: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
    },
    cancelButtonText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    securityCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 16,
      padding: 16,
      marginTop: 18,
    },
    securityTextContainer: {
      flex: 1,
    },
    securityTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 5,
    },
    securityText: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 19,
    },
    signOutContainer: {
      marginTop: 20,
    },
    footer: {
      color: colors.textSecondary,
      fontSize: 11,
      textAlign: 'center',
      lineHeight: 17,
      marginTop: 20,
    },
    loadingContainer: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 12,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: 14,
      textAlign: 'center',
    },
  });
}

function isDarkStatusBackground(background: string) {
  return background.toLowerCase() === '#080f24'
    ? '#2B291C'
    : '#FFF7E6';
}
