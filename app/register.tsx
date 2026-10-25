
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
  Keyboard,
  Pressable,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { signUp } from '@/lib/auth';
import type { EducationLevel } from '@/lib/profiles';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [educationLevel, setEducationLevel] =
    useState<EducationLevel>('College');
  const [program, setProgram] = useState('');
  const [block, setBlock] = useState('');
  const [yearLevel, setYearLevel] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const isStudent = role === 'student';

  const handleRegister = async () => {
    setError(null);

    if (
      !fullName.trim() ||
      !email.trim() ||
      !password ||
      !confirmPassword
    ) {
      setError('Please complete all required fields.');
      return;
    }

    if (isStudent && (!program.trim() || !block.trim() || !yearLevel.trim())) {
      setError(
        'Please complete your program/strand, block/section, and year level.'
      );
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: authError } = await signUp(
        email.trim(),
        password,
        {
          full_name: fullName.trim(),
          role,
          ...(isStudent
            ? {
                education_level: educationLevel,
                program: program.trim(),
                block: block.trim(),
                year_level: yearLevel.trim(),
              }
            : {}),
        }
      );

      if (authError) {
        setError(authError.message);
      } else if (data.session) {
        router.replace('/(tabs)');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const educationOptions: {
    label: string;
    value: EducationLevel;
  }[] = [
    { label: 'Senior High School', value: 'SHS' },
    { label: 'College', value: 'College' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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

            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Register to start recording attendance
            </Text>

            {success ? (
              <View style={styles.successContainer}>
                <Text style={styles.successTitle}>Check your email!</Text>
                <Text style={styles.successText}>
                  We sent a confirmation link to {email}. Click the link to
                  verify your account, then come back and sign in.
                </Text>
                <Link href="/login" style={styles.link}>
                  Back to Sign In
                </Link>
              </View>
            ) : (
              <View style={styles.form}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Enter your full name"
                  placeholderTextColor={COLORS.textSecondary}
                  autoCapitalize="words"
                  editable={!loading}
                />

                <Text style={styles.label}>I am a...</Text>
                <View style={styles.roleRow}>
                  {(['student', 'teacher'] as const).map((item) => (
                    <Pressable
                      key={item}
                      style={[
                        styles.roleChip,
                        role === item && styles.roleChipActive,
                      ]}
                      onPress={() => setRole(item)}
                      disabled={loading}
                    >
                      <Text
                        style={[
                          styles.roleChipText,
                          role === item && styles.roleChipTextActive,
                        ]}
                      >
                        {item === 'student' ? 'Student' : 'Teacher'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {isStudent && (
                  <>
                    <View style={styles.schoolInfoHeader}>
                      <Text style={styles.schoolInfoTitle}>
                        Student Information
                      </Text>
                      <Text style={styles.schoolInfoSubtitle}>
                        Enter your current school details carefully. These
                        details will be read-only in your profile.
                      </Text>
                    </View>

                    <Text style={styles.label}>Education Level</Text>
                    <View style={styles.roleRow}>
                      {educationOptions.map((option) => (
                        <Pressable
                          key={option.value}
                          style={[
                            styles.educationChip,
                            educationLevel === option.value &&
                              styles.roleChipActive,
                          ]}
                          onPress={() => setEducationLevel(option.value)}
                          disabled={loading}
                        >
                          <Text
                            style={[
                              styles.roleChipText,
                              educationLevel === option.value &&
                                styles.roleChipTextActive,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <Text style={styles.label}>
                      {educationLevel === 'SHS'
                        ? 'Strand'
                        : 'Program / Course'}
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={program}
                      onChangeText={setProgram}
                      placeholder={
                        educationLevel === 'SHS'
                          ? 'Example: STEM, ABM, HUMSS, TVL'
                          : 'Example: BSIT, BSBA, BSED'
                      }
                      placeholderTextColor={COLORS.textSecondary}
                      autoCapitalize="characters"
                      editable={!loading}
                    />

                    <Text style={styles.label}>Block / Section</Text>
                    <TextInput
                      style={styles.input}
                      value={block}
                      onChangeText={setBlock}
                      placeholder="Example: BSIT-3B or STEM-12A"
                      placeholderTextColor={COLORS.textSecondary}
                      autoCapitalize="characters"
                      editable={!loading}
                    />

                    <Text style={styles.label}>Year Level</Text>
                    <TextInput
                      style={styles.input}
                      value={yearLevel}
                      onChangeText={setYearLevel}
                      placeholder={
                        educationLevel === 'SHS'
                          ? 'Example: Grade 11 or Grade 12'
                          : 'Example: 1st Year, 2nd Year'
                      }
                      placeholderTextColor={COLORS.textSecondary}
                      editable={!loading}
                    />
                  </>
                )}

                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your.email@school.edu"
                  placeholderTextColor={COLORS.textSecondary}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  editable={!loading}
                />

                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={COLORS.textSecondary}
                  secureTextEntry
                  editable={!loading}
                />

                <Text style={styles.label}>Confirm Password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter your password"
                  placeholderTextColor={COLORS.textSecondary}
                  secureTextEntry
                  editable={!loading}
                />

                {error && <Text style={styles.error}>{error}</Text>}

                {loading ? (
                  <ActivityIndicator
                    size="large"
                    color={COLORS.primary}
                    style={styles.loader}
                  />
                ) : (
                  <AppButton
                    theme="primary"
                    title="Sign Up"
                    icon="person-add-outline"
                    onPress={handleRegister}
                  />
                )}
              </View>
            )}

            {!success && (
              <Link href="/login" style={styles.link}>
                Already have an account? Sign In
              </Link>
            )}
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
    marginBottom: 24,
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
  roleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  roleChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: 'center',
  },
  educationChip: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: 'center',
  },
  roleChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#2E7D5B14',
  },
  roleChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  roleChipTextActive: {
    fontWeight: '700',
    color: COLORS.primary,
  },
  schoolInfoHeader: {
    marginTop: 18,
    marginBottom: 2,
    padding: 14,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  schoolInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 5,
  },
  schoolInfoSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },
  error: {
    fontSize: 14,
    color: COLORS.danger,
    textAlign: 'left',
    marginTop: 12,
    marginBottom: 4,
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
  successContainer: {
    marginBottom: 24,
    padding: 20,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
});
