
import { useState } from 'react';

import {
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Keyboard,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';

import { COLORS } from '@/constants/colors';
import { signIn } from '@/lib/auth';
import { getProfile } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const { data, error: authError } = await signIn(
        email.trim(),
        password
      );

      if (authError) {
        setError(authError.message);
        return;
      }

      if (!data.user) {
        setError('Unable to get user information.');
        return;
      }

      const profile = await getProfile(data.user.id);

      if (!profile) {
        await supabase.auth.signOut();
        setError(
          'Profile not found. Please contact the administrator.'
        );
        return;
      }

      if (profile.role === 'teacher') {
        const approvalStatus = (
          profile as typeof profile & {
            approval_status?: string;
          }
        ).approval_status;

        if (approvalStatus !== 'approved') {
          await supabase.auth.signOut();

          setMessage(
            approvalStatus === 'rejected'
              ? 'Your teacher registration was not approved. Please contact the administrator.'
              : 'Your teacher account is awaiting admin approval. You can sign in after it is approved.'
          );

          return;
        }

        router.replace('/(tabs)/teacher');
      } else if (profile.role === 'admin') {
        router.replace('/admin');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setError(err?.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setMessage(null);

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError('Please enter your email address first.');
      return;
    }

    setResetLoading(true);

    try {
      const redirectTo =
        Platform.OS === 'web'
          ? `${window.location.origin}/reset-password`
          : Linking.createURL('reset-password');

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          trimmedEmail,
          { redirectTo }
        );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setMessage(
        'If an account exists for this email, a password reset link will be sent. Please check your inbox and spam folder.'
      );
    } catch (err: any) {
      setError(
        err?.message || 'Unable to send the reset email.'
      );
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top },
      ]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerContainer}>
              <Header title="QR Attendance" />
            </View>

            <Text style={styles.title}>Welcome Back</Text>

            <Text style={styles.subtitle}>
              Sign in to record your attendance
            </Text>

            <View style={styles.form}>
              <Text style={styles.label}>Email</Text>

              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your.email@school.edu"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                editable={!loading && !resetLoading}
              />

              <Text style={styles.label}>Password</Text>

              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={COLORS.textSecondary}
                  secureTextEntry={!showPassword}
                  autoComplete="current-password"
                  editable={!loading && !resetLoading}
                />

                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() =>
                    setShowPassword((previous) => !previous)
                  }
                  disabled={loading || resetLoading}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? 'Hide password' : 'Show password'
                  }
                >
                  <Ionicons
                    name={
                      showPassword
                        ? 'eye-off-outline'
                        : 'eye-outline'
                    }
                    size={22}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.forgotButton}
                onPress={handleForgotPassword}
                disabled={loading || resetLoading}
                accessibilityRole="button"
              >
                {resetLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={COLORS.primary}
                  />
                ) : (
                  <Text style={styles.forgotText}>
                    Forgot Password?
                  </Text>
                )}
              </TouchableOpacity>

              {error && (
                <Text style={styles.error}>{error}</Text>
              )}

              {message && (
                <Text style={styles.successMessage}>
                  {message}
                </Text>
              )}

              {loading ? (
                <ActivityIndicator
                  size="large"
                  color={COLORS.primary}
                  style={styles.loader}
                />
              ) : (
                <AppButton
                  theme="primary"
                  title="Sign In"
                  icon="log-in-outline"
                  onPress={handleLogin}
                />
              )}
            </View>

            <Link href="/register" style={styles.link}>
              Don't have an account? Sign Up
            </Link>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  headerContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },

  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 21,
    marginBottom: 32,
  },

  form: {
    marginBottom: 24,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
    marginTop: 10,
  },

  input: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
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
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
    minWidth: 0,
  },

  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: 12,
    marginBottom: 8,
    paddingVertical: 4,
  },

  forgotText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },

  error: {
    fontSize: 14,
    color: COLORS.danger,
    textAlign: 'left',
    marginTop: 12,
    marginBottom: 4,
  },

  successMessage: {
    fontSize: 14,
    color: COLORS.primary,
    textAlign: 'left',
    marginTop: 12,
    marginBottom: 12,
    lineHeight: 20,
  },

  loader: {
    marginVertical: 16,
  },

  link: {
    fontSize: 14,
    color: COLORS.primary,
    textAlign: 'center',
    fontWeight: '600',
  },
});
