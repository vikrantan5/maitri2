import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield, Clock, CheckCircle2, LogOut, RefreshCw } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../config/firebaseConfig';

/**
 * Officer Pending Approval screen.
 *
 * Shown after an officer scans the station QR + submits their onboarding form.
 * Listens realtime to /users/{uid} — the moment the station OIC approves the
 * request (via the secure /api/create-officer server route on the web
 * dashboard), `role` becomes `police_officer` on the users doc.
 *
 * As soon as that happens we:
 *   1) Force-refresh the Firebase ID token (so custom claims propagate)
 *   2) Replace navigation to /officer-dashboard — no re-login required.
 */
export default function OfficerPendingScreen() {
  const insets = useSafeAreaInsets();
  const [stationLabel, setStationLabel] = useState('your station');
  const [approved, setApproved] = useState(false);
  const [checking, setChecking] = useState(false);
  const navigatedRef = useRef(false);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) {
      router.replace('/(auth)/login');
      return;
    }

    console.log('[officer-pending] listening to users/' + u.uid);
    const unsub = onSnapshot(
      doc(db, 'users', u.uid),
      async (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() || {};
        if (data.pendingStationId) {
          setStationLabel(data.pendingStationId);
        } else if (data.stationId) {
          setStationLabel(data.stationId);
        }
        if (data.role === 'police_officer' && !navigatedRef.current) {
          navigatedRef.current = true;
          setApproved(true);
          console.log('[officer-pending] approval detected — refreshing token & navigating');
          try {
            // Force refresh so any custom claims set by the server propagate.
            await auth.currentUser?.getIdToken(true);
          } catch (e) {
            console.warn('[officer-pending] token refresh failed (continuing)', e);
          }
          // Tiny delay so the user sees the success state before redirect.
          setTimeout(() => {
            router.replace('/officer-dashboard');
          }, 800);
        }
      },
      (err) => {
        console.warn('[officer-pending] snapshot error', err?.code, err?.message);
      },
    );

    return unsub;
  }, []);

  const onSignOut = async () => {
    try {
      await signOut(auth);
      router.replace('/(auth)/login');
    } catch (e) {
      Alert.alert('Sign out failed', e?.message || 'Unknown error');
    }
  };

  const onRefresh = async () => {
    setChecking(true);
    try {
      await auth.currentUser?.getIdToken(true);
    } catch {
      /* noop */
    } finally {
      setTimeout(() => setChecking(false), 600);
    }
  };

  return (
    <LinearGradient colors={['#0F1226', '#1A1646', '#23215A']} style={styles.gradient}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 28 },
        ]}
      >
        <View style={styles.header}>
          <View style={[styles.logoBox, approved && { borderColor: 'rgba(34,224,140,0.4)', backgroundColor: 'rgba(34,224,140,0.08)' }]}>
            {approved ? (
              <CheckCircle2 size={48} color="#22E08C" strokeWidth={2.2} />
            ) : (
              <Shield size={48} color="#00E5FF" strokeWidth={2.2} />
            )}
          </View>
          <Text style={styles.title}>
            {approved ? 'Approved!' : 'Awaiting Station Approval'}
          </Text>
          <Text style={styles.subtitle}>
            {approved
              ? 'Redirecting you to your officer dashboard…'
              : `Your registration with ${stationLabel} has been submitted. Your Station OIC will approve your access on the Saheli web dashboard.`}
          </Text>
        </View>

        <View style={styles.card} data-testid="officer-pending-card">
          <View style={styles.row}>
            <View style={styles.iconCircle}>
              <Clock size={20} color="#00E5FF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>What happens next?</Text>
              <Text style={styles.rowBody}>
                Your Station OIC sees your request in their Officers queue. Once they tap
                <Text style={{ color: '#22E08C', fontWeight: '700' }}> Approve</Text>, this screen will
                automatically take you to your officer dashboard — no re-login required.
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.iconCircle}>
              <Shield size={20} color="#00E5FF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Already approved on web?</Text>
              <Text style={styles.rowBody}>
                Tap the refresh button below to re-check your approval status.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={onRefresh}
            disabled={checking}
            data-testid="officer-pending-refresh"
          >
            {checking ? (
              <ActivityIndicator color="#00E5FF" />
            ) : (
              <>
                <RefreshCw size={16} color="#00E5FF" />
                <Text style={styles.secondaryBtnText}>Re-check approval</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {approved && (
          <View style={styles.successBanner} data-testid="officer-pending-approved">
            <ActivityIndicator color="#22E08C" />
            <Text style={styles.successBannerText}>Loading your dashboard…</Text>
          </View>
        )}

        <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut} data-testid="officer-pending-signout">
          <LogOut size={16} color="rgba(255,255,255,0.65)" />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 22 },
  header: { alignItems: 'center', marginBottom: 22 },
  logoBox: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: 'rgba(0,229,255,0.08)',
    borderWidth: 2, borderColor: 'rgba(0,229,255,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: 0.5, textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.65)', textAlign: 'center', fontSize: 13, marginTop: 8, paddingHorizontal: 6, lineHeight: 19 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,229,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(0,229,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  rowTitle: { color: '#FFFFFF', fontWeight: '700', fontSize: 14, marginBottom: 4 },
  rowBody: { color: 'rgba(255,255,255,0.65)', fontSize: 12.5, lineHeight: 18 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 16 },

  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, paddingHorizontal: 18, marginTop: 18,
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,229,255,0.4)',
    backgroundColor: 'rgba(0,229,255,0.05)',
  },
  secondaryBtnText: { color: '#00E5FF', fontWeight: '700', fontSize: 14 },

  successBanner: {
    marginTop: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 14, paddingHorizontal: 18,
    backgroundColor: 'rgba(34,224,140,0.08)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(34,224,140,0.3)',
  },
  successBannerText: { color: '#22E08C', fontWeight: '700', fontSize: 14 },

  signOutBtn: {
    marginTop: 24, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 16,
  },
  signOutText: { color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '600' },
});
