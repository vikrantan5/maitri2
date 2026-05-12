import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Shield,
  ArrowLeft,
  QrCode,
  User,
  BadgeCheck,
  Phone,
  Mail,
  Lock,
  ScanLine,
  CheckCircle2,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../config/firebaseConfig';

/**
 * Officer onboarding flow:
 *   1) Scan station QR  →  extract stationId
 *   2) Fill officer details + create Firebase Auth account
 *   3) Submit /officerRequests doc  →  station OIC approves on web
 */
export default function OfficerRegisterScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState('scan'); // scan | form | done
  const [stationId, setStationId] = useState('');
  const [stationName, setStationName] = useState('');
  const scanLockRef = useRef(false);

  const [form, setForm] = useState({
    name: '',
    badgeNumber: '',
    rank: '',
    phone: '',
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [requestId, setRequestId] = useState('');

  useEffect(() => {
    if (permission && !permission.granted) requestPermission();
  }, [permission]);

  const handleScanned = async ({ data }) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    try {
      // QR encodes: saheli://onboard?stationId=XYZ  or  https://.../?stationId=XYZ
      let id = '';
      try {
        const u = new URL(data);
        id = u.searchParams.get('stationId') || '';
      } catch {
        // raw stationId string
        id = String(data).trim();
      }
      if (!id) throw new Error('Invalid QR code');

      // Verify station exists & is approved
      const stationSnap = await getDoc(doc(db, 'policeStations', id));
      if (!stationSnap.exists()) {
        Alert.alert(
          'Station not found',
          'This station is not registered or not yet approved. Please scan an official Saheli station QR.',
        );
        scanLockRef.current = false;
        return;
      }
      const data_ = stationSnap.data();
    if (data_.status !== 'approved') {
        Alert.alert('Station inactive', `Station status: ${data_.status}. Cannot onboard officers.`);
        scanLockRef.current = false;
        return;
      }
      setStationId(id);
      setStationName(data_.name || id);
      setStage('form');
    } catch (e) {
      Alert.alert('Scan error', e?.message || 'Could not read QR code.');
      scanLockRef.current = false;
    }
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Full name is required';
    if (!form.badgeNumber.trim()) e.badgeNumber = 'Badge number is required';
    if (!form.phone.trim()) e.phone = 'Phone is required';
    else if (form.phone.replace(/\D/g, '').length < 10) e.phone = 'Enter at least 10 digits';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'At least 6 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      console.log('[officer-onboard] creating auth user…');
      // 1) Create Firebase Auth account for the officer
      const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      const uid = cred.user.uid;
      console.log('[officer-onboard] auth user created', uid);

      // IMPORTANT: Force a fresh ID token so Firestore rules see request.auth
      // before we attempt the writes below. Without this, the very first
      // Firestore write can race the SDK's auth-state propagation and fail
      // with \"Missing or insufficient permissions\".
      try {
        await cred.user.getIdToken(true);
      } catch (tokErr) {
        console.warn('[officer-onboard] getIdToken(true) failed (continuing)', tokErr);
      }

      // 2) Mirror minimal profile in /users so security rules can identify the user later
      console.log('[officer-onboard] writing users/' + uid);
      await setDoc(
        doc(db, 'users', uid),
        {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          createdAt: new Date().toISOString(),
          // role + stationId are set ONLY when station approves on web
        },
        { merge: true },
      );

      // 3) Submit officer onboarding request
      console.log('[officer-onboard] writing officerRequests for station', stationId);
      const ref = await addDoc(collection(db, 'officerRequests'), {
        uid,
        stationId,
        stationName,
        name: form.name.trim(),
        badgeNumber: form.badgeNumber.trim(),
        rank: form.rank.trim() || 'Officer',
        phone: form.phone.replace(/\D/g, ''),
        email: form.email.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      console.log('[officer-onboard] officerRequest created', ref.id);

      setRequestId(ref.id);
      setStage('done');
    } catch (e) {
      console.error('[officer-onboard] submission failed', e?.code, e?.message);
      let msg = e?.message || 'Submission failed';
      if (e?.code === 'auth/email-already-in-use') {
        msg = 'This email already has a Saheli account. Use a different email or contact your station OIC.';
      } else if (e?.code === 'auth/weak-password') {
        msg = 'Password is too weak — use at least 6 characters.';
         } else if (e?.code === 'permission-denied' || /permission/i.test(String(e?.message || ''))) {
        msg = 'Firebase rejected the request (permission-denied). Make sure Firestore rules allow officerRequests creation and that you completed the QR scan first.';
      }
      Alert.alert('Could not submit', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient colors={['#0F1226', '#1A1646', '#23215A']} style={styles.gradient}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.back} onPress={() => router.replace('/(auth)/login')} data-testid="officer-register-back">
            <ArrowLeft size={22} color="#FFFFFF" />
            <Text style={styles.backText}>Back to login</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.logoBox}>
              <Shield size={48} color="#00E5FF" strokeWidth={2.2} />
            </View>
            <Text style={styles.title}>Officer Onboarding</Text>
            <Text style={styles.subtitle}>
              {stage === 'scan'
                ? 'Scan the QR code displayed at your police station to begin registration.'
                : stage === 'form'
                ? `Station: ${stationName || stationId}`
                : 'Your request is in review.'}
            </Text>
          </View>

          {/* Stepper */}
          <View style={styles.steps}>
            <Step idx={1} label="Scan" active={stage === 'scan'} done={stage !== 'scan'} />
            <Step idx={2} label="Details" active={stage === 'form'} done={stage === 'done'} />
            <Step idx={3} label="Pending" active={stage === 'done'} done={false} />
          </View>

          {/* STAGE 1: Scan */}
          {stage === 'scan' && (
            <View style={styles.scannerCard} data-testid="officer-qr-scanner">
              {!permission ? (
                <Text style={styles.permText}>Requesting camera permission…</Text>
              ) : !permission.granted ? (
                <View style={styles.permBox}>
                  <Text style={styles.permText}>Camera permission required to scan station QR.</Text>
                  <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
                    <Text style={styles.primaryBtnText}>Grant permission</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.scannerBox}>
                    <CameraView
                      style={StyleSheet.absoluteFillObject}
                      facing="back"
                      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                      onBarcodeScanned={handleScanned}
                    />
                    <View pointerEvents="none" style={styles.scanOverlay}>
                      <ScanLine size={48} color="#00E5FF" />
                    </View>
                  </View>
                  <Text style={styles.hint}>Align the station QR within the frame.</Text>
                  <TouchableOpacity
                    style={styles.linkBtn}
                    onPress={() => {
                      Alert.prompt?.(
                        'Enter Station ID manually',
                        'Type the Station ID printed on your QR poster.',
                        (val) => val && handleScanned({ data: val }),
                      );
                    }}
                  >
                    <Text style={styles.linkBtnText}>Enter Station ID manually</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* STAGE 2: Form */}
          {stage === 'form' && (
            <View style={styles.formCard} data-testid="officer-form">
              <Input
                icon={<User size={18} color="#00E5FF" />}
                placeholder="Full name"
                value={form.name}
                onChangeText={(v) => setForm({ ...form, name: v })}
                error={errors.name}
                tid="officer-name-input"
              />
              <Input
                icon={<BadgeCheck size={18} color="#00E5FF" />}
                placeholder="Badge number"
                value={form.badgeNumber}
                onChangeText={(v) => setForm({ ...form, badgeNumber: v })}
                error={errors.badgeNumber}
                tid="officer-badge-input"
              />
              <Input
                icon={<BadgeCheck size={18} color="#00E5FF" />}
                placeholder="Rank (e.g. Sub-Inspector)"
                value={form.rank}
                onChangeText={(v) => setForm({ ...form, rank: v })}
                tid="officer-rank-input"
              />
              <Input
                icon={<Phone size={18} color="#00E5FF" />}
                placeholder="Phone number"
                keyboardType="phone-pad"
                value={form.phone}
                onChangeText={(v) => setForm({ ...form, phone: v })}
                error={errors.phone}
                tid="officer-phone-input"
              />
              <Input
                icon={<Mail size={18} color="#00E5FF" />}
                placeholder="Work email"
                keyboardType="email-address"
                autoCapitalize="none"
                value={form.email}
                onChangeText={(v) => setForm({ ...form, email: v })}
                error={errors.email}
                tid="officer-email-input"
              />
              <Input
                icon={<Lock size={18} color="#00E5FF" />}
                placeholder="Password (min 6 chars)"
                secureTextEntry
                value={form.password}
                onChangeText={(v) => setForm({ ...form, password: v })}
                error={errors.password}
                tid="officer-password-input"
              />

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={submit}
                disabled={submitting}
                data-testid="officer-submit-button"
              >
                {submitting ? (
                  <ActivityIndicator color="#0F1226" />
                ) : (
                  <Text style={styles.primaryBtnText}>Submit for approval</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => {
                  scanLockRef.current = false;
                  setStage('scan');
                }}
              >
                <Text style={styles.linkBtnText}>← Scan a different station</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STAGE 3: Done */}
          {stage === 'done' && (
            <View style={styles.doneCard} data-testid="officer-done">
              <View style={styles.doneIcon}>
                <CheckCircle2 size={36} color="#22E08C" />
              </View>
              <Text style={styles.doneTitle}>Request submitted</Text>
              <Text style={styles.doneMsg}>
                Your onboarding request has been sent to {stationName || stationId}. Once approved by your station OIC, you can sign in with your work email & password.
              </Text>
              <Text style={styles.doneMeta}>Request ID: {requestId}</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(auth)/login')} data-testid="officer-done-back">
                <Text style={styles.primaryBtnText}>Back to sign-in</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

function Step({ idx, label, active, done }) {
  return (
    <View style={styles.step}>
      <View style={[styles.stepDot, active && styles.stepDotActive, done && styles.stepDotDone]}>
        <Text style={[styles.stepDotText, (active || done) && { color: '#0F1226' }]}>{idx}</Text>
      </View>
      <Text style={[styles.stepLabel, active && { color: '#FFFFFF' }]}>{label}</Text>
    </View>
  );
}

function Input({ icon, placeholder, error, tid, ...rest }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={styles.inputBox}>
        <View style={{ marginRight: 12 }}>{icon}</View>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#7C82A6"
          data-testid={tid}
          {...rest}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 22 },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  backText: { color: '#FFFFFF', marginLeft: 8, fontSize: 14 },
  header: { alignItems: 'center', marginBottom: 22 },
  logoBox: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: 'rgba(0,229,255,0.08)',
    borderWidth: 2, borderColor: 'rgba(0,229,255,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', letterSpacing: 0.5 },
  subtitle: { color: 'rgba(255,255,255,0.65)', textAlign: 'center', fontSize: 13, marginTop: 8, paddingHorizontal: 12 },

  steps: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 18 },
  step: { alignItems: 'center', flex: 1 },
  stepDot: {
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 6,
  },
  stepDotActive: { backgroundColor: '#00E5FF', borderColor: '#00E5FF' },
  stepDotDone: { backgroundColor: '#22E08C', borderColor: '#22E08C' },
  stepDotText: { color: 'rgba(255,255,255,0.7)', fontWeight: '700', fontSize: 13 },
  stepLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },

  scannerCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  scannerBox: {
    aspectRatio: 1, borderRadius: 18, overflow: 'hidden',
    backgroundColor: '#000', borderWidth: 2, borderColor: 'rgba(0,229,255,0.4)',
  },
  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  hint: { color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 14, fontSize: 12 },
  permBox: { paddingVertical: 30, alignItems: 'center' },
  permText: { color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginBottom: 16 },

  formCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12,
    paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  input: { flex: 1, paddingVertical: 14, color: '#FFFFFF', fontSize: 15 },
  errorText: { color: '#FF6B81', fontSize: 11, marginTop: 4, marginLeft: 4 },

  primaryBtn: {
    backgroundColor: '#00E5FF', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 10,
    shadowColor: '#00E5FF', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  primaryBtnText: { color: '#0F1226', fontWeight: '800', fontSize: 15, letterSpacing: 0.4 },
  linkBtn: { paddingVertical: 12, alignItems: 'center' },
  linkBtnText: { color: 'rgba(0,229,255,0.85)', fontSize: 13, fontWeight: '600' },

  doneCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  doneIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(34,224,140,0.12)',
    borderWidth: 2, borderColor: 'rgba(34,224,140,0.35)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  doneTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  doneMsg: { color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 10, lineHeight: 19 },
  doneMeta: { color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', marginTop: 14, fontSize: 11 },
});
