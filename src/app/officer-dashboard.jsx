 import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Shield,
  Siren,
  MapPin,
  Clock,
  Phone,
  LogOut,
  RefreshCw,
  ChevronRight,
} from 'lucide-react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebaseConfig';
import { subscribeToOfficerCases } from '../services/officerService';

const STATUS_META = {
  new: { label: 'NEW', color: '#FF3B3B', bg: 'rgba(255,59,59,0.15)' },
  acknowledged: { label: 'ACKNOWLEDGED', color: '#FFB020', bg: 'rgba(255,176,32,0.15)' },
  dispatched: { label: 'DISPATCHED', color: '#00E5FF', bg: 'rgba(0,229,255,0.15)' },
  in_progress: { label: 'IN PROGRESS', color: '#00E5FF', bg: 'rgba(0,229,255,0.15)' },
  escalated: { label: 'ESCALATED', color: '#FF3B3B', bg: 'rgba(255,59,59,0.15)' },
  resolved: { label: 'RESOLVED', color: '#22E08C', bg: 'rgba(34,224,140,0.15)' },
  false_alarm: { label: 'FALSE ALARM', color: '#9CA3AF', bg: 'rgba(156,163,175,0.15)' },
};

export default function OfficerDashboard() {
  const insets = useSafeAreaInsets();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }
    const unsub = subscribeToOfficerCases(uid, (list) => {
      setCases(list);
      setLoading(false);
      setRefreshing(false);
    });
    return () => unsub();
  }, []);

  const onLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/(auth)/login');
    } catch (e) {
      Alert.alert('Logout failed', e?.message || 'Could not sign out');
    }
  };

  const active = cases.filter((c) => !['resolved', 'false_alarm'].includes(c.status));
  const resolved = cases.filter((c) => ['resolved', 'false_alarm'].includes(c.status));

  return (
    <LinearGradient colors={['#0F1226', '#1A1646', '#23215A']} style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerRow}>
          <View style={styles.logoWrap}>
            <Shield size={24} color="#00E5FF" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.kicker}>OFFICER COMMAND</Text>
            <Text style={styles.title}>On Duty</Text>
          </View>
          <TouchableOpacity onPress={onLogout} style={styles.iconBtn} data-testid="officer-logout">
            <LogOut size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <Stat label="Active" value={active.length} accent="#FF3B3B" />
          <Stat label="Total" value={cases.length} accent="#00E5FF" />
          <Stat label="Closed" value={resolved.length} accent="#22E08C" />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setTimeout(() => setRefreshing(false), 800);
            }}
            tintColor="#00E5FF"
          />
        }
      >
        <Section title="Active Dispatch" count={active.length}>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#00E5FF" />
              <Text style={styles.loadingText}>Connecting to dispatch…</Text>
            </View>
          ) : active.length === 0 ? (
            <EmptyBox
              title="Standby"
              message="No active cases. You'll be notified the moment your station dispatches you."
            />
          ) : (
            active.map((c) => <CaseRow key={c.id} c={c} />)
          )}
        </Section>

        {resolved.length > 0 && (
          <Section title="Recently Closed" count={resolved.length}>
            {resolved.slice(0, 6).map((c) => (
              <CaseRow key={c.id} c={c} muted />
            ))}
          </Section>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

function Stat({ label, value, accent }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, count, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionCount}>
          <Text style={styles.sectionCountText}>{count}</Text>
        </View>
      </View>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}

function CaseRow({ c, muted }) {
  const meta = STATUS_META[c.status] || STATUS_META.new;
  const time = c.createdAt?.toDate ? c.createdAt.toDate() : null;
  return (
    <TouchableOpacity
      style={[styles.caseCard, muted && { opacity: 0.65 }]}
      onPress={() => router.push(`/officer-case/${c.id}`)}
      activeOpacity={0.85}
      data-testid={`officer-case-row-${c.id}`}
    >
      <View style={styles.caseIcon}>
        <Siren size={18} color="#FF3B3B" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.caseRowTop}>
          <Text style={styles.caseName} numberOfLines={1}>
            {c.userName || 'Unknown victim'}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: meta.bg, borderColor: meta.color + '55' }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
        <View style={styles.caseRowMeta}>
          {c.location && (
            <View style={styles.metaItem}>
              <MapPin size={11} color="rgba(255,255,255,0.5)" />
              <Text style={styles.metaText}>
                {c.location.lat.toFixed(3)}, {c.location.lng.toFixed(3)}
              </Text>
            </View>
          )}
          {time && (
            <View style={styles.metaItem}>
              <Clock size={11} color="rgba(255,255,255,0.5)" />
              <Text style={styles.metaText}>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          )}
          {c.userPhone && (
            <View style={styles.metaItem}>
              <Phone size={11} color="rgba(255,255,255,0.5)" />
              <Text style={styles.metaText}>{c.userPhone}</Text>
            </View>
          )}
        </View>
      </View>
      <ChevronRight size={18} color="rgba(255,255,255,0.4)" />
    </TouchableOpacity>
  );
}

function EmptyBox({ title, message }) {
  return (
    <View style={styles.emptyBox} data-testid="officer-empty">
      <RefreshCw size={26} color="rgba(0,229,255,0.6)" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMsg}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  logoWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,229,255,0.08)',
    borderWidth: 1.5, borderColor: 'rgba(0,229,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  kicker: { color: 'rgba(0,229,255,0.7)', fontSize: 10, letterSpacing: 2, fontWeight: '700' },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  statsRow: { flexDirection: 'row', marginTop: 18, gap: 10 },
  stat: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14, padding: 12,
  },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2, letterSpacing: 1, textTransform: 'uppercase' },
  scroll: { paddingHorizontal: 20, paddingTop: 4 },
  section: { marginTop: 18 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', flex: 1 },
  sectionCount: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 8, backgroundColor: 'rgba(0,229,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(0,229,255,0.25)',
  },
  sectionCountText: { color: '#00E5FF', fontSize: 11, fontWeight: '700' },
  caseCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14, padding: 14,
  },
  caseIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: 'rgba(255,59,59,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,59,59,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  caseRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  caseName: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', flex: 1 },
  statusPill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1,
  },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  caseRowMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: 'rgba(255,255,255,0.55)', fontSize: 11 },
  emptyBox: {
    alignItems: 'center', padding: 28, gap: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginTop: 4 },
  emptyMsg: { color: 'rgba(255,255,255,0.55)', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  loadingBox: { padding: 32, alignItems: 'center', gap: 10 },
  loadingText: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
});
