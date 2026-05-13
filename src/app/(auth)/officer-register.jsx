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
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Shield,
  ArrowLeft,
  User,
  BadgeCheck,
  Phone,
  Mail,
  Lock,
  ScanLine,
  CheckCircle2,
  Keyboard as KeyboardIcon,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../config/firebaseConfig';

/**
 * Officer onboarding flow:
 *   1) Scan station QR  →  extract stationId
 *      (or tap "Enter Station ID manually" — works on iOS, Android & web)
 *   2) Fill officer details + create Firebase Auth account
 *   3) Submit /officerRequests doc  →  station OIC approves on web
 *
 * IMPORTANT: this screen reads `policeStations/{stationId}` BEFORE the
 * officer is signed in (to validate the QR poster). Firestore rules must
 * allow public single-doc GET on /policeStations/{id} for that to succeed.
 * See firebas.txtx / firestore.rules at the repo root.
 */
export default function OfficerRegisterScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState('scan'); // scan | form | done
  const [stationId, setStationId] = useState('');
  const [stationName, setStationName] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState('');
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

  /**
   * Parse the QR payload (URL or raw stationId) and verify the station
   * exists & is approved. Public read is required (see Firestore rules).
   */
const verifyStation = async (rawValue) => {
  setVerifying(true);
  try {
    let id = '';
    const trimmed = String(rawValue || '').trim();
    if (!trimmed) throw new Error('Please provide a Station ID.');

    // QR variants:
    //   saheli://onboard?stationId=XYZ&token=...
    //   https://saheli.app/onboard?stationId=XYZ
    //   plain: XYZ
    if (trimmed.includes('?') || /^[a-z]+:\/\//i.test(trimmed)) {
      try {
        const u = new URL(trimmed);
        id = u.searchParams.get('stationId') || '';
      } catch (urlError) {  // ← Fix: Add error parameter
        id = '';
      }
    }
    if (!id) id = trimmed;
    if (!id) throw new Error('Invalid QR code.');

    console.log('[officer-onboard] verifying station', id);
    const stationSnap = await getDoc(doc(db, 'policeStations', id));
    if (!stationSnap.exists()) {
      throw new Error(
        `Station "${id}" not found. Please check the ID printed on the QR poster or contact your station OIC.`,
      );
    }
    const sdata = stationSnap.data() || {};
    if (sdata.status && sdata.status !== 'approved') {
      throw new Error(
        `This station is currently "${sdata.status}". Onboarding is only available for approved stations.`,
      );
    }
    setStationId(id);
    setStationName(sdata.name || id);
    setStage('form');
  } catch (e) {
    console.warn('[officer-onboard] station verify failed', e?.code, e?.message);
    const msg = /permission/i.test(String(e?.message || e?.code || ''))
      ? 'Could not verify station — Firestore rejected the read. Make sure your Saheli admin has deployed the latest security rules that allow public read on /policeStations/{id}.'
      : e?.message || 'Could not verify station.';
    Alert.alert('Station check failed', msg);
    scanLockRef.current = false;
  } finally {
    setVerifying(false);
  }
};

  const handleScanned = async ({ data }) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    await verifyStation(data);
  };

  const submitManual = async () => {
    if (!manualValue.trim()) {
      Alert.alert('Enter Station ID', 'Type the Station ID printed on your QR poster.');
      return;
    }
    setManualOpen(false);
    scanLockRef.current = true;
    await verifyStation(manualValue.trim());
    setManualValue('');
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
    let uid = null;
    try {
      console.log('[officer-onboard] creating auth user…');
      // 1) Create Firebase Auth account for the officer
      const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      uid = cred.user.uid;
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

      // 2) Mirror minimal profile in /users so security rules can identify
      //    this user later AND the root router (_layout.jsx) knows to send
      //    them to /officer-pending instead of the citizen \"Complete Your
      //    Profile\" flow. `pendingOfficer: true` is the discriminator.
      //
      //    CRITICAL: this write MUST land before we navigate away. We retry
      //    once with exponential back-off — Firestore rules occasionally
      //    reject the very first write because auth-state has not yet been
      //    propagated to the rules evaluator.
      console.log('[officer-onboard] writing users/' + uid);
      const userPayload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        pendingOfficer: true,
        pendingStationId: stationId,
        createdAt: new Date().toISOString(),
        // role + stationId are set ONLY when station approves on web
      };
      try {
        await setDoc(doc(db, 'users', uid), userPayload, { merge: true });
      } catch (firstErr) {
        console.warn('[officer-onboard] users write failed, retrying once', firstErr?.code);
        await new Promise((r) => setTimeout(r, 800));
        // Force one more token refresh before retry
        try { await cred.user.getIdToken(true); } catch {}
        await setDoc(doc(db, 'users', uid), userPayload, { merge: true });
      }

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
        msg =
          'Firebase rejected the request (permission-denied). The Saheli admin must deploy the latest Firestore rules from /app/firestore.rules:

   firebase deploy --only firestore:rules

Until then officer onboarding cannot complete.';
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
                ? 'Scan the QR code at your police station — or enter the Station ID manually.'
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
                  <Text style={styles.permText}>
                    Camera permission required to scan the station QR. You can also enter the Station ID manually below.
                  </Text>
                  <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission} data-testid="grant-camera-permission">
                    <Text style={styles.primaryBtnText}>Grant permission</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.secondaryBtn, { marginTop: 10 }]}
                    onPress={() => setManualOpen(true)}
                    data-testid="open-manual-entry-noperm"
                  >
                    <KeyboardIcon size={16} color="#00E5FF" />
                    <Text style={styles.secondaryBtnText}>Enter Station ID manually</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.scannerBox}>
                    <CameraView
                      style={StyleSheet.absoluteFillObject}
                      facing="back"
                      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                      onBarcodeScanned={verifying ? undefined : handleScanned}
                    />
                    <View pointerEvents="none" style={styles.scanOverlay}>
                      <ScanLine size={48} color="#00E5FF" />
                    </View>
                    {verifying && (
                      <View pointerEvents="none" style={styles.scanOverlayDark}>
                        <ActivityIndicator color="#00E5FF" size="large" />
                        <Text style={styles.verifyingText}>Verifying station…</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.hint}>Align the station QR within the frame.</Text>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => setManualOpen(true)}
                    data-testid="open-manual-entry"
                  >
                    <KeyboardIcon size={16} color="#00E5FF" />
                    <Text style={styles.secondaryBtnText}>Enter Station ID manually</Text>
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
                data-testid="officer-rescan"
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
              <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/officer-pending')} data-testid="officer-done-continue">
                <Text style={styles.primaryBtnText}>Continue</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Manual Station ID modal — cross-platform replacement for Alert.prompt */}
        <Modal
          visible={manualOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setManualOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard} data-testid="manual-station-modal">
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Enter Station ID</Text>
                <TouchableOpacity
                  onPress={() => setManualOpen(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  data-testid="manual-station-close"
                >
                  <X size={20} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSubtitle}>
                Type the Station ID printed on your QR poster (e.g. PS-DEL-001) and tap Verify.
              </Text>
              <View style={styles.inputBox}>
                <BadgeCheck size={18} color="#00E5FF" />
                <TextInput
                  style={[styles.input, { marginLeft: 12 }]}
                  placeholder="Station ID"
                  placeholderTextColor="#7C82A6"
                  value={manualValue}
                  onChangeText={setManualValue}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  data-testid="manual-station-input"
                />
              </View>
              <TouchableOpacity
                style={[styles.primaryBtn, { marginTop: 14 }]}
                onPress={submitManual}
                disabled={verifying}
                data-testid="manual-station-verify"
              >
                {verifying ? (
                  <ActivityIndicator color="#0F1226" />
                ) : (
                  <Text style={styles.primaryBtnText}>Verify station</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
  scanOverlayDark: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(15,18,38,0.7)',
  },
  verifyingText: { color: '#FFFFFF', marginTop: 12, fontSize: 13, fontWeight: '600' },
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
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 18, marginTop: 12,
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,229,255,0.4)',
    backgroundColor: 'rgba(0,229,255,0.05)',
  },
  secondaryBtnText: { color: '#00E5FF', fontWeight: '700', fontSize: 14, marginLeft: 6 },
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

  // Manual entry modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,10,24,0.78)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 22,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#161A37',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.18)',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  modalSubtitle: { color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 17, marginBottom: 16, marginTop: 4 },
});
