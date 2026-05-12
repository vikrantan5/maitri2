import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Siren,
  MapPin,
  Phone,
  Mic,
  Image as ImageIcon,
  Navigation as NavigationIcon,
  CheckCircle2,
  ShieldX,
  Flag,
  MessageSquarePlus,
  Send,
} from 'lucide-react-native';
import { auth } from '../../config/firebaseConfig';
import {
  subscribeToCase,
  updateCaseStatus,
  addCaseNote,
} from '../../services/officerService';

const STATUS_META = {
  new: { label: 'NEW', color: '#FF3B3B', bg: 'rgba(255,59,59,0.15)' },
  acknowledged: { label: 'ACKNOWLEDGED', color: '#FFB020', bg: 'rgba(255,176,32,0.15)' },
  dispatched: { label: 'DISPATCHED', color: '#00E5FF', bg: 'rgba(0,229,255,0.15)' },
  in_progress: { label: 'IN PROGRESS', color: '#00E5FF', bg: 'rgba(0,229,255,0.15)' },
  escalated: { label: 'ESCALATED', color: '#FF3B3B', bg: 'rgba(255,59,59,0.15)' },
  resolved: { label: 'RESOLVED', color: '#22E08C', bg: 'rgba(34,224,140,0.15)' },
  false_alarm: { label: 'FALSE ALARM', color: '#9CA3AF', bg: 'rgba(156,163,175,0.15)' },
};

export default function OfficerCaseDetail() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [c, setCase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!id) return;
    const unsub = subscribeToCase(String(id), (data) => {
      setCase(data);
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  const onAction = async (status, label) => {
    if (!c || acting) return;
    setActing(true);
    try {
      const by = auth.currentUser?.email || auth.currentUser?.uid || 'officer';
      await updateCaseStatus(c.id, status, by, label);
    } catch (e) {
      Alert.alert('Update failed', e?.message || 'Could not update case status.');
    } finally {
      setActing(false);
    }
  };

  const onAddNote = async () => {
    const text = note.trim();
    if (!c || !text || acting) return;
    setActing(true);
    try {
      const by = auth.currentUser?.email || auth.currentUser?.uid || 'officer';
      await addCaseNote(c.id, by, text);
      setNote('');
    } catch (e) {
      Alert.alert('Could not add note', e?.message || 'Try again.');
    } finally {
      setActing(false);
    }
  };

  const openMaps = () => {
    if (!c?.location) return;
    const { lat, lng } = c.location;
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${lat},${lng}`,
      android: `google.navigation:q=${lat},${lng}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    });
    Linking.openURL(url);
  };

  const callVictim = () => {
    if (!c?.userPhone) return;
    Linking.openURL(`tel:${c.userPhone}`);
  };

  if (loading) {
    return (
      <LinearGradient colors={['#0F1226', '#1A1646', '#23215A']} style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color="#00E5FF" size="large" />
          <Text style={styles.loadingText}>Loading case…</Text>
        </View>
      </LinearGradient>
    );
  }

  if (!c) {
    return (
      <LinearGradient colors={['#0F1226', '#1A1646', '#23215A']} style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.notFoundTitle}>Case not found</Text>
          <Text style={styles.notFoundMsg}>It may have been removed or you don&apos;t have access.</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.replace('/officer-dashboard')}
            data-testid="officer-case-back-to-dash"
          >
            <Text style={styles.primaryBtnText}>Back to my cases</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  const meta = STATUS_META[c.status] || STATUS_META.new;
  const isTerminal = c.status === 'resolved' || c.status === 'false_alarm';
  const time = c.createdAt?.toDate ? c.createdAt.toDate() : null;
  const uid = auth.currentUser?.uid;
  const isAssignedToMe = uid && Array.isArray(c.assignedOfficers) && c.assignedOfficers.includes(uid);
  const notes = Array.isArray(c.notes) ? [...c.notes] : [];
  notes.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));

  return (
    <LinearGradient colors={['#0F1226', '#1A1646', '#23215A']} style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          data-testid="officer-case-back"
        >
          <ArrowLeft size={20} color="#FFFFFF" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={[styles.statusPill, { backgroundColor: meta.bg, borderColor: meta.color + '55' }]}>
          <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Victim card */}
        <View style={styles.card}>
          <View style={styles.victimHead}>
            <View style={styles.victimIcon}>
              <Siren size={22} color="#FF3B3B" />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.victimName} numberOfLines={1}>
                {c.userName || 'Unknown victim'}
              </Text>
              <Text style={styles.caseIdText}>#{c.id.slice(0, 8)}</Text>
            </View>
          </View>
          <View style={styles.rowDivider} />
          {c.userPhone ? (
            <DetailRow label="Phone" value={c.userPhone} onPress={callVictim} testID="officer-case-call" />
          ) : null}
          <DetailRow
            label="Priority"
            value={(c.priority || 'high').toUpperCase()}
          />
          <DetailRow label="Station" value={c.assignedStationId || 'Unassigned'} />
          {time && <DetailRow label="Reported" value={time.toLocaleString()} />}
        </View>

        {/* Location */}
        {c.location && (
          <View style={styles.card}>
            <SectionHeader icon={MapPin} title="Last Known Location" />
            <Text style={styles.coordText}>
              {c.location.lat.toFixed(6)}, {c.location.lng.toFixed(6)}
            </Text>
            <TouchableOpacity style={styles.actionBtn} onPress={openMaps} data-testid="officer-case-navigate">
              <NavigationIcon size={16} color="#0F1226" />
              <Text style={styles.actionBtnText}>Navigate to scene</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Evidence */}
        <View style={styles.card}>
          <SectionHeader icon={ImageIcon} title="Evidence" />
          {c.imageUrl ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(c.imageUrl)}
              style={styles.evidenceImageWrap}
              activeOpacity={0.85}
              data-testid="officer-case-image"
            >
              <Image source={{ uri: c.imageUrl }} style={styles.evidenceImage} resizeMode="cover" />
            </TouchableOpacity>
          ) : (
            <View style={styles.emptyChip}>
              <ImageIcon size={13} color="rgba(255,255,255,0.45)" />
              <Text style={styles.emptyChipText}>No photo captured</Text>
            </View>
          )}
          {c.audioUrl ? (
            <TouchableOpacity
              style={styles.audioRow}
              onPress={() => Linking.openURL(c.audioUrl)}
              activeOpacity={0.85}
              data-testid="officer-case-audio"
            >
              <Mic size={16} color="#00E5FF" />
              <Text style={styles.audioText}>Open SOS audio recording</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.emptyChip}>
              <Mic size={13} color="rgba(255,255,255,0.45)" />
              <Text style={styles.emptyChipText}>No audio captured</Text>
            </View>
          )}
        </View>

        {/* Field actions */}
        <View style={styles.card}>
          <SectionHeader icon={Siren} title="Field Actions" />
          {!isAssignedToMe && (
            <View style={styles.warnBox}>
              <Text style={styles.warnText}>
                You aren&apos;t assigned to this case. Actions are read-only until your station dispatches you.
              </Text>
            </View>
          )}
          <ActionRow
            label="Mark arrived"
            icon={Siren}
            color="#00E5FF"
            disabled={acting || isTerminal || c.status === 'in_progress' || !isAssignedToMe}
            onPress={() => onAction('in_progress', 'Officer arrived on scene.')}
            testID="officer-action-arrived"
          />
          <ActionRow
            label="Resolve case"
            icon={CheckCircle2}
            color="#22E08C"
            disabled={acting || isTerminal || !isAssignedToMe}
            onPress={() => onAction('resolved', 'Resolved on-site.')}
            testID="officer-action-resolve"
          />
          <ActionRow
            label="Escalate for backup"
            icon={Flag}
            color="#FFB020"
            disabled={acting || isTerminal || !isAssignedToMe}
            onPress={() => onAction('escalated', 'Escalated for backup.')}
            testID="officer-action-escalate"
          />
          <ActionRow
            label="Mark false alarm"
            icon={ShieldX}
            color="#9CA3AF"
            disabled={acting || isTerminal || !isAssignedToMe}
            onPress={() => onAction('false_alarm', 'Marked false alarm.')}
            testID="officer-action-false-alarm"
          />
        </View>

        {/* Notes */}
        <View style={styles.card}>
          <SectionHeader icon={MessageSquarePlus} title="Updates & Notes" />
          {notes.length === 0 ? (
            <View style={styles.emptyChip}>
              <Text style={styles.emptyChipText}>No updates logged yet.</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {notes.map((n, i) => (
                <View key={i} style={styles.noteBox}>
                  <Text style={styles.noteMeta}>
                    {n.by} · {typeof n.at === 'string' ? new Date(n.at).toLocaleString() : ''}
                  </Text>
                  <Text style={styles.noteText}>{n.text}</Text>
                </View>
              ))}
            </View>
          )}

          {!isTerminal && isAssignedToMe && (
            <View style={{ marginTop: 12 }}>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="Add an update for dispatch…"
                placeholderTextColor="rgba(255,255,255,0.4)"
                multiline
                data-testid="officer-note-input"
              />
              <TouchableOpacity
                style={[styles.actionBtn, (!note.trim() || acting) && { opacity: 0.5 }]}
                onPress={onAddNote}
                disabled={!note.trim() || acting}
                data-testid="officer-note-submit"
              >
                <Send size={16} color="#0F1226" />
                <Text style={styles.actionBtnText}>Log update</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

function SectionHeader({ icon: Icon, title }) {
  return (
    <View style={styles.sectionHead}>
      <Icon size={16} color="#00E5FF" />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function DetailRow({ label, value, onPress, testID }) {
  const content = (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, onPress && { color: '#00E5FF' }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} data-testid={testID}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

function ActionRow({ label, icon: Icon, color, disabled, onPress, testID }) {
  return (
    <TouchableOpacity
      style={[styles.actionRow, disabled && { opacity: 0.4 }]}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.8}
      data-testid={testID}
    >
      <View style={[styles.actionIcon, { backgroundColor: color + '20', borderColor: color + '55' }]}>
        <Icon size={16} color={color} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { color: 'rgba(255,255,255,0.6)', marginTop: 12, fontSize: 13 },
  notFoundTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  notFoundMsg: { color: 'rgba(255,255,255,0.6)', marginTop: 8, textAlign: 'center' },

  header: {
    paddingHorizontal: 20, paddingBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  statusPill: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },

  scroll: { paddingHorizontal: 16, gap: 14 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  victimHead: { flexDirection: 'row', alignItems: 'center' },
  victimIcon: {
    width: 46, height: 46, borderRadius: 12,
    backgroundColor: 'rgba(255,59,59,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,59,59,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  victimName: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  caseIdText: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  rowDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 12 },

  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6,
  },
  detailLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  detailValue: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600', maxWidth: '60%' },

  coordText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 12 },
  actionBtn: {
    backgroundColor: '#00E5FF', borderRadius: 12, paddingVertical: 13,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 8,
  },
  actionBtnText: { color: '#0F1226', fontWeight: '800', fontSize: 14 },

  evidenceImageWrap: {
    borderRadius: 14, overflow: 'hidden', marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  evidenceImage: { width: '100%', height: 180 },
  audioRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 12,
    backgroundColor: 'rgba(0,229,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(0,229,255,0.25)',
  },
  audioText: { color: '#00E5FF', fontSize: 13, fontWeight: '600' },
  emptyChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10, borderWidth: 1, borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 8,
  },
  emptyChipText: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },

  warnBox: {
    padding: 12, borderRadius: 10,
    backgroundColor: 'rgba(255,176,32,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,176,32,0.3)',
    marginBottom: 10,
  },
  warnText: { color: 'rgba(255,176,32,0.9)', fontSize: 12, lineHeight: 17 },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
  },
  actionIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  actionLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', flex: 1 },

  noteBox: {
    padding: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  noteMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  noteText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 18 },
  noteInput: {
    minHeight: 70, padding: 12, color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    fontSize: 13, textAlignVertical: 'top',
  },

  primaryBtn: {
    backgroundColor: '#00E5FF', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 24, marginTop: 20,
  },
  primaryBtnText: { color: '#0F1226', fontWeight: '800', fontSize: 14 },
});
