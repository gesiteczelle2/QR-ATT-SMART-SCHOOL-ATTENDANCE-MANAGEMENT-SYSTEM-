
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import AppButton from '@/components/AppButton';
import { useTheme } from '@/app/contexts/ThemeContext';
import { useAuth } from '@/lib/auth';
import {
  previewAttendanceQR,
  registerAttendance,
  type AttendanceQRPreview,
} from '@/lib/attendance';
import type { Role } from '@/lib/profiles';
import { getUserRole } from '@/lib/role';

export default function ScanScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [permission, requestPermission] = useCameraPermissions();
  const [role, setRole] = useState<Role | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);

  const [preview, setPreview] = useState<AttendanceQRPreview | null>(null);
  const [rawPayload, setRawPayload] = useState('');

  const [studentName, setStudentName] = useState('');
  const [studentBlock, setStudentBlock] = useState<string | null>(null);
  const [studentYear, setStudentYear] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadScreen = async () => {
        setRoleLoading(true);

        if (!user) {
          setRole(null);
          setRoleLoading(false);
          return;
        }

        try {
          const userRole = await getUserRole(user.id);

          if (active) {
            setRole(userRole);
          }
        } catch {
          if (active) {
            setRole(null);
          }
        } finally {
          if (active) {
            setRoleLoading(false);
          }
        }
      };

      loadScreen();

      return () => {
        active = false;
      };
    }, [user])
  );

  const resetScan = () => {
    setScanned(false);
    setProcessing(false);
    setConfirming(false);
    setMessage(null);
    setSuccess(false);
    setPreview(null);
    setRawPayload('');
    setStudentName('');
    setStudentBlock(null);
    setStudentYear(null);
    setCameraKey((previous) => previous + 1);
  };

  const handleBarcodeScanned = async ({
    data,
  }: {
    data: string;
  }) => {
    if (!user || scanned || processing) return;

    setScanned(true);
    setProcessing(true);
    setMessage(null);
    setSuccess(false);
    setPreview(null);
    setRawPayload(data);

    try {
      
const result = await previewAttendanceQR(data, user.id);

      setPreview(result);

      if (!result.valid) {
        setMessage(result.message);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not verify this QR code.'
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmAttendance = async () => {
    if (!user || !preview?.valid || !rawPayload || confirming) return;

    setConfirming(true);
    setProcessing(true);
    setMessage(null);

    try {
      const result = await registerAttendance(rawPayload, user.id);

      setMessage(result.message);
      setSuccess(result.success);
      setStudentName(result.studentName ?? '');
      setStudentBlock(result.block ?? null);
      setStudentYear(result.yearLevel ?? null);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try scanning again.'
      );
      setSuccess(false);
    } finally {
      setProcessing(false);
      setConfirming(false);
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return 'Not specified';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
  };

  const isClassroom =
    preview?.eventType?.toLowerCase() === 'classroom';

  if (roleLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Checking your account...</Text>
      </View>
    );
  }

  if (role !== 'student') {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.statusIcon}>
          <Ionicons
            name="lock-closed-outline"
            size={36}
            color={colors.primary}
          />
        </View>
        <Text style={styles.lockTitle}>Students Only</Text>
        <Text style={styles.lockText}>
          Only student accounts can scan attendance QR codes.
        </Text>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>
          Checking camera permission...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.statusIcon}>
          <Ionicons
            name="camera-outline"
            size={38}
            color={colors.primary}
          />
        </View>
        <Text style={styles.permissionTitle}>Camera Access Needed</Text>
        <Text style={styles.permissionText}>
          Allow camera access so QR-ATT can scan attendance QR codes.
        </Text>
        <View style={styles.permissionButton}>
          <AppButton
            theme="primary"
            title="Grant Permission"
            icon="camera-outline"
            onPress={requestPermission}
          />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>QR-ATTENDANCE</Text>
          <Text style={styles.pageTitle}>Scan QR Code</Text>
          <Text style={styles.headerSubtitle}>
            Review your attendance details before confirming.
          </Text>
        </View>

        <View style={styles.headerIcon}>
          <Ionicons
            name="qr-code-outline"
            size={28}
            color={colors.primary}
          />
        </View>
      </View>

      <View style={styles.instructionCard}>
        <Ionicons
          name="information-circle-outline"
          size={21}
          color={colors.primary}
        />
        <Text style={styles.instructionText}>
          Scan the official classroom or school event QR code. Check its
          details before recording your attendance.
        </Text>
      </View>

      {!scanned && (
        <View style={styles.scannerCard}>
          <View style={styles.scannerTopRow}>
            <View style={styles.liveIndicator} />
            <Text style={styles.scannerLabel}>SCANNER READY</Text>
            <Ionicons
              name="scan-outline"
              size={19}
              color={colors.textSecondary}
            />
          </View>

          <View style={styles.cameraFrame}>
            <CameraView
              key={cameraKey}
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcodeScanned}
            />

            <View pointerEvents="none" style={styles.scanOverlay}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
              <View style={styles.scanLine} />
            </View>
          </View>

          <Text style={styles.cameraHint}>
            Hold your phone steady and center the QR code.
          </Text>
        </View>
      )}

      {scanned && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeading}>
            <View
              style={[
                styles.resultIcon,
                success ? styles.successIcon : styles.errorIcon,
              ]}
            >
              <Ionicons
                name={
                  processing
                    ? 'hourglass-outline'
                    : success
                      ? 'checkmark-circle-outline'
                      : preview?.valid
                        ? 'qr-code-outline'
                        : 'alert-circle-outline'
                }
                size={25}
                color={
                  processing
                    ? colors.primary
                    : success
                      ? colors.success
                      : preview?.valid
                        ? colors.primary
                        : colors.danger
                }
              />
            </View>

            <View style={styles.resultHeadingText}>
              <Text style={styles.resultTitle}>
                {processing
                  ? confirming
                    ? 'Recording Attendance'
                    : 'Checking QR Code'
                  : success
                    ? 'Attendance Recorded'
                    : preview?.valid
                      ? 'Review Attendance'
                      : 'QR Code Not Recognized'}
              </Text>
              <Text style={styles.resultSubtitle}>
                {processing
                  ? 'Please wait a moment...'
                  : success
                    ? 'Your attendance has been processed.'
                    : preview?.valid
                      ? 'Confirm that these details are correct.'
                      : 'This code could not be verified.'}
              </Text>
            </View>
          </View>

          {processing ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={styles.processingIndicator}
            />
          ) : (
            <>
              {preview?.valid && (
                <>
                  <View style={styles.typeBadge}>
                    <Ionicons
                      name={
                        isClassroom
                          ? 'school-outline'
                          : 'calendar-outline'
                      }
                      size={19}
                      color={colors.primary}
                    />
                    <Text style={styles.typeBadgeText}>
                      {isClassroom
                        ? 'CLASSROOM ATTENDANCE'
                        : 'SCHOOL EVENT ATTENDANCE'}
                    </Text>
                  </View>

                  <View style={styles.eventDetails}>
                    <Text style={styles.detailsLabel}>
                      {isClassroom ? 'Classroom / Subject' : 'School Event'}
                    </Text>
                    <Text style={styles.detailsValue}>
                      {preview.eventTitle || 'Untitled Event'}
                    </Text>

                    {isClassroom && (
                      <View style={styles.detailRow}>
                        <Ionicons
                          name="people-outline"
                          size={17}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.detailRowText}>
                          Section: {preview.classSection || 'Not specified'}
                        </Text>
                      </View>
                    )}

                    <View style={styles.detailRow}>
                      <Ionicons
                        name="time-outline"
                        size={17}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.detailRowText}>
                        Starts: {formatDate(preview.startTime)}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Ionicons
                        name="time-outline"
                        size={17}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.detailRowText}>
                        Ends: {formatDate(preview.endTime)}
                      </Text>
                    </View>
                  </View>
                </>
              )}

              {message && !preview?.valid && (
                <Text style={styles.errorText}>{message}</Text>
              )}

              {success && (
                <Text style={styles.successText}>
                  {message || 'Attendance registered successfully!'}
                </Text>
              )}

              {!success && preview?.valid && (
                <Text style={styles.confirmationText}>
                  Are you sure you want to record your attendance for this
                  {isClassroom ? ' classroom session' : ' school event'}?
                </Text>
              )}

              {success && studentName !== '' && (
                <View style={styles.studentDetails}>
                  <Text style={styles.studentDetailsTitle}>
                    Student Details
                  </Text>
                  <Text style={styles.studentDetail}>
                    Name: {studentName}
                  </Text>
                  <Text style={styles.studentDetail}>
                    Block: {studentBlock || 'Not set'}
                  </Text>
                  <Text style={styles.studentDetail}>
                    Year Level: {studentYear || 'Not set'}
                  </Text>
                </View>
              )}
            </>
          )}

          {!processing && preview?.valid && !success && (
            <View style={styles.actionButtons}>
              <AppButton
                theme="primary"
                title="Confirm Attendance"
                icon="checkmark-circle-outline"
                onPress={handleConfirmAttendance}
              />

              <AppButton
                theme="primary"
                title="Scan Another QR Code"
                icon="refresh-outline"
                onPress={resetScan}
              />
            </View>
          )}

          {!processing && (!preview?.valid || success) && (
            <AppButton
              theme="primary"
              title="Scan Another QR Code"
              icon="refresh-outline"
              onPress={resetScan}
            />
          )}
        </View>
      )}

      {!scanned && (
        <View style={styles.tipCard}>
          <Ionicons
            name="shield-checkmark-outline"
            size={22}
            color={colors.success}
          />
          <View style={styles.tipTextContainer}>
            <Text style={styles.tipTitle}>Check before confirming</Text>
            <Text style={styles.tipText}>
              QR-ATT will show the attendance type and event information
              before submitting your attendance.
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function createStyles(
  colors: ReturnType<
    typeof import('@/app/contexts/ThemeContext').useTheme
  >['colors']
) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 30,
    },
    centerContainer: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 22,
      gap: 12,
    },
    eyebrow: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 2,
      marginBottom: 6,
    },
    pageTitle: {
      color: colors.textPrimary,
      fontSize: 27,
      fontWeight: '800',
    },
    headerSubtitle: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 5,
      lineHeight: 18,
    },
    headerIcon: {
      width: 52,
      height: 52,
      borderRadius: 17,
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    instructionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      backgroundColor: colors.glass,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: 14,
      marginBottom: 18,
    },
    instructionText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
    scannerCard: {
      backgroundColor: colors.glass,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: 15,
      marginBottom: 18,
    },
    scannerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
      gap: 9,
    },
    liveIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.success,
    },
    scannerLabel: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.5,
    },
    cameraFrame: {
      height: 265,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: '#020714',
    },
    camera: {
      ...StyleSheet.absoluteFill,
    },
    scanOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    corner: {
      position: 'absolute',
      width: 37,
      height: 37,
      borderColor: colors.primary,
      borderWidth: 4,
    },
    topLeft: {
      top: 20,
      left: 20,
      borderRightWidth: 0,
      borderBottomWidth: 0,
      borderTopLeftRadius: 9,
    },
    topRight: {
      top: 20,
      right: 20,
      borderLeftWidth: 0,
      borderBottomWidth: 0,
      borderTopRightRadius: 9,
    },
    bottomLeft: {
      bottom: 20,
      left: 20,
      borderRightWidth: 0,
      borderTopWidth: 0,
      borderBottomLeftRadius: 9,
    },
    bottomRight: {
      bottom: 20,
      right: 20,
      borderLeftWidth: 0,
      borderTopWidth: 0,
      borderBottomRightRadius: 9,
    },
    scanLine: {
      position: 'absolute',
      left: 32,
      right: 32,
      height: 2,
      backgroundColor: colors.primary,
      opacity: 0.9,
    },
    cameraHint: {
      color: colors.textSecondary,
      fontSize: 11,
      textAlign: 'center',
      marginTop: 13,
      lineHeight: 17,
    },
    resultCard: {
      backgroundColor: colors.glass,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: 17,
      marginBottom: 18,
    },
    resultHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 15,
    },
    resultIcon: {
      width: 46,
      height: 46,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    successIcon: {
      backgroundColor: 'rgba(56,217,169,0.12)',
    },
    errorIcon: {
      backgroundColor: 'rgba(255,100,124,0.12)',
    },
    resultHeadingText: {
      flex: 1,
    },
    resultTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    resultSubtitle: {
      color: colors.textSecondary,
      fontSize: 11,
      marginTop: 4,
      lineHeight: 16,
    },
    typeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 8,
      borderRadius: 10,
      paddingHorizontal: 11,
      paddingVertical: 9,
      marginBottom: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    typeBadgeText: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    eventDetails: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: 14,
      marginBottom: 13,
      gap: 10,
    },
    detailsLabel: {
      color: colors.textSecondary,
      fontSize: 11,
    },
    detailsValue: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '800',
      marginTop: -5,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    detailRowText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
    confirmationText: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 19,
      marginBottom: 16,
    },
    successText: {
      color: colors.success,
      fontSize: 13,
      lineHeight: 20,
      marginBottom: 12,
    },
    errorText: {
      color: colors.danger,
      fontSize: 13,
      lineHeight: 20,
      marginVertical: 12,
    },
    processingIndicator: {
      marginVertical: 20,
    },
    studentDetails: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: 14,
      marginBottom: 14,
    },
    studentDetailsTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 8,
    },
    studentDetail: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 21,
    },
    actionButtons: {
      gap: 10,
    },
    tipCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.glass,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: 16,
      marginBottom: 18,
    },
    tipTextContainer: {
      flex: 1,
    },
    tipTitle: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
    tipText: {
      color: colors.textSecondary,
      fontSize: 11,
      lineHeight: 17,
      marginTop: 4,
    },
    statusIcon: {
      width: 78,
      height: 78,
      borderRadius: 25,
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: 14,
      marginTop: 14,
    },
    lockTitle: {
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: '800',
      textAlign: 'center',
    },
    lockText: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
      marginTop: 10,
    },
    permissionTitle: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: '800',
      textAlign: 'center',
    },
    permissionText: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
      marginTop: 10,
      marginBottom: 24,
    },
    permissionButton: {
      width: '100%',
    },
  });
}
