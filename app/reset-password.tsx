
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let mounted = true;

    const handleRecoveryUrl = async (url: string | null) => {
      if (!url || !mounted) return;

      try {
        const parsedUrl = new URL(url);
        const hashParams = new URLSearchParams(
          parsedUrl.hash.replace(/^#/, '')
        );

        const params: Record<string, string> = {
          ...Object.fromEntries(parsedUrl.searchParams.entries()),
          ...Object.fromEntries(hashParams.entries()),
        };

        const queryError =
          params.error_description || params.error || null;

        if (queryError) {
          if (mounted) {
            setError(
              `${queryError.replace(/\+/g, ' ')}. Please request a new reset link.`
            );
            setCheckingLink(false);
          }
          return;
        }

        const code =
          typeof params.code === 'string' ? params.code : null;

        const accessToken =
          typeof params.access_token === 'string'
            ? params.access_token
            : null;

        const refreshToken =
          typeof params.refresh_token === 'string'
            ? params.refresh_token
            : null;

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) throw exchangeError;
        } else if (accessToken && refreshToken) {
          const { error: sessionError } =
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

          if (sessionError) throw sessionError;
        }

        if (!mounted) return;

        const { data, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (data.session) {
          setRecoveryReady(true);
          setError('');
        } else {
          setError(
            'The reset link is invalid or expired. Please request a new one.'
          );
        }

        setCheckingLink(false);
      } catch (err: any) {
        if (mounted) {
          setError(
            err?.message ||
              'Unable to verify the reset link. Please request a new one.'
          );
          setCheckingLink(false);
        }
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session && mounted) {
        setRecoveryReady(true);
        setCheckingLink(false);
        setError('');
      }
    });

    Linking.getInitialURL()
      .then(handleRecoveryUrl)
      .catch((err) => {
        if (mounted) {
          setError(err?.message || 'Unable to open the reset link.');
          setCheckingLink(false);
        }
      });

    const linkSubscription = Linking.addEventListener(
      'url',
      ({ url }) => {
        void handleRecoveryUrl(url);
      }
    );

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted || sessionError) return;

      if (data.session) {
        setRecoveryReady(true);
        setCheckingLink(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      linkSubscription.remove();
    };
  }, []);

  const handleResetPassword = async () => {
    setError('');
    setSuccess('');

    if (!recoveryReady) {
      setError('Open a valid password-reset link from your email first.');
      return;
    }

    if (password.length < 6) {
      setError('Your password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } =
        await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setPassword('');
      setConfirmPassword('');

      setSuccess(
        'Password updated successfully! You can now sign in using your new password.'
      );
    } catch (err: any) {
      setError(err?.message || 'Unable to update your password.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToSignIn = async () => {
    setLoading(true);

    try {
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        setError(
          'Your password was updated, but signing out failed. Please return to Sign In.'
        );
        return;
      }

      router.replace('/login');
    } catch {
      setError(
        'Your password was updated. Please return to the Sign In screen.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Header title="QR Attendance" />
        </View>

        <Text style={styles.title}>Reset Password</Text>

        <Text style={styles.subtitle}>
          {checkingLink
            ? 'Verifying your reset link...'
            : success
              ? 'Your password has been updated.'
              : recoveryReady
                ? 'Enter and confirm your new password below.'
                : 'Open the password-reset link sent to your email.'}
        </Text>

        {checkingLink ? (
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
            style={styles.loader}
          />
        ) : success ? (
          <View style={styles.successBox}>
            <Ionicons
              name="checkmark-circle"
              size={48}
              color="#15803D"
            />

            <Text style={styles.successTitle}>
              Password Updated Successfully!
            </Text>

            <Text style={styles.successText}>{success}</Text>

            <TouchableOpacity
              style={styles.successButton}
              onPress={handleGoToSignIn}
              disabled={loading}
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.successButtonText}>
                  Go to Sign In
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : recoveryReady ? (
          <>
            <Text style={styles.label}>New Password</Text>

            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter new password"
                placeholderTextColor={COLORS.textSecondary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="new-password"
                editable={!loading}
              />

              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword((value) => !value)}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword ? 'Hide password' : 'Show password'
                }
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Confirm New Password</Text>

            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor={COLORS.textSecondary}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoComplete="new-password"
                editable={!loading}
              />

              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() =>
                  setShowConfirmPassword((value) => !value)
                }
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={
                  showConfirmPassword
                    ? 'Hide password'
                    : 'Show password'
                }
              >
                <Ionicons
                  name={
                    showConfirmPassword
                      ? 'eye-off-outline'
                      : 'eye-outline'
                  }
                  size={22}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator
                size="large"
                color={COLORS.primary}
                style={styles.loader}
              />
            ) : (
              <AppButton
                theme="primary"
                title="Update Password"
                icon="checkmark-circle-outline"
                onPress={handleResetPassword}
              />
            )}
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!success && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace('/login')}
            disabled={loading}
          >
            <Text style={styles.backText}>Back to Sign In</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textSecondary,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
    marginTop: 14,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  passwordInput: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  error: {
    color: COLORS.danger,
    fontSize: 14,
    marginTop: 14,
    marginBottom: 14,
  },
  loader: {
    marginVertical: 20,
  },
  backButton: {
    alignItems: 'center',
    padding: 16,
    marginTop: 8,
  },
  backText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  successBox: {
    marginTop: 10,
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    alignItems: 'center',
  },
  successTitle: {
    color: '#166534',
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
  },
  successText: {
    color: '#166534',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
  },
  successButton: {
    marginTop: 20,
    backgroundColor: '#15803D',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 170,
    alignItems: 'center',
  },
  successButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
