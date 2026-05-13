"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  Calendar,
  Phone,
  Shield,
  TrendingUp,
  Users,
  Volume2,
} from "lucide-react";
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DashboardShell } from "@/components/dashboard/shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";

interface Stats {
  totalUsers: number;
  totalSOS: number;
  totalAlarms: number;
  totalFakeCalls: number;
  activeUsersToday: number;
}

interface DailyStat {
  date: string;
  sosCount: number;
  alarmCount: number;
  newUsers: number;
}

interface AnalyticsEvent {
  id: string;
  eventType: string;
  userId?: string;
  userEmail?: string;
  timestamp?: Timestamp;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

function fmtTime(ts?: Timestamp): string {
  if (!ts?.toDate) return "—";
  const d = ts.toDate();
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const EVENT_META: Record<string, { label: string; icon: any; accent: string }> = {
  SOS_TRIGGERED: { label: "SOS Triggered", icon: AlertCircle, accent: "text-pink" },
  LOUD_ALARM_TRIGGERED: { label: "Loud Alarm Used", icon: Volume2, accent: "text-amber" },
  FAKE_CALL_USED: { label: "Fake Call Used", icon: Phone, accent: "text-pink" },
  USER_REGISTERED: { label: "New User Registered", icon: Users, accent: "text-ok" },
  USER_LOGIN: { label: "User Login", icon: Activity, accent: "text-cyan" },
  APP_OPENED: { label: "App Opened", icon: Activity, accent: "text-cyan" },
};

function eventMeta(type: string) {
  return (
    EVENT_META[type] || {
      label: type.replace(/_/g, " "),
      icon: Shield,
      accent: "text-white/60",
    }
  );
}

export default function MobileStatsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalSOS: 0,
    totalAlarms: 0,
    totalFakeCalls: 0,
    activeUsersToday: 0,
  });
  const [recentEvents, setRecentEvents] = useState<AnalyticsEvent[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      await Promise.all([loadStats(), loadRecentEvents(), loadDailyStats()]);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    const safeCount = async (qq: any): Promise<number> => {
      try {
        const s = await getCountFromServer(qq);
        return s.data().count;
      } catch (e) {
        console.warn("[mobile-stats] count failed", e);
        return 0;
      }
    };
    const [totalUsers, totalSOS, totalAlarms, totalFakeCalls] = await Promise.all([
      safeCount(query(collection(db, "users"))),
      safeCount(query(collection(db, "analytics_events"), where("eventType", "==", "SOS_TRIGGERED"))),
      safeCount(query(collection(db, "analytics_events"), where("eventType", "==", "LOUD_ALARM_TRIGGERED"))),
      safeCount(query(collection(db, "analytics_events"), where("eventType", "==", "FAKE_CALL_USED"))),
    ]);

    // Active users today — unique userIds emitting analytics events since 00:00 local
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let activeUsersToday = 0;
    try {
      const docs = await getDocs(
        query(collection(db, "analytics_events"), where("timestamp", ">=", today)),
      );
      const set = new Set<string>();
      docs.forEach((d) => {
        const data = d.data() as any;
        if (data.userId) set.add(data.userId);
      });
      activeUsersToday = set.size;
    } catch (e) {
      console.warn("[mobile-stats] active today failed", e);
    }

    setStats({ totalUsers, totalSOS, totalAlarms, totalFakeCalls, activeUsersToday });
  };

  const loadRecentEvents = async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "analytics_events"), orderBy("timestamp", "desc"), limit(20)),
      );
      setRecentEvents(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AnalyticsEvent, "id">) })),
      );
    } catch (e) {
      console.warn("[mobile-stats] recent events failed", e);
      setRecentEvents([]);
    }
  };

  const loadDailyStats = async () => {
    try {
      const last7: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last7.push(d.toISOString().split("T")[0]);
      }
      const rows = await Promise.all(
        last7.map(async (date) => {
          try {
            const snap = await getDocs(
              query(collection(db, "analytics_summary"), where("date", "==", date)),
            );
            if (!snap.empty) {
              const data = snap.docs[0].data() as any;
              return {
                date,
                sosCount: data.sosActivations || 0,
                alarmCount: data.alarmActivations || 0,
                newUsers: data.newUsers || 0,
              };
            }
          } catch (e) {
            // ignore
          }
          return { date, sosCount: 0, alarmCount: 0, newUsers: 0 };
        }),
      );
      setDailyStats(rows);
    } catch (e) {
      console.warn("[mobile-stats] daily stats failed", e);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <DashboardShell allow={["super_admin"]} title="Mobile App Analytics">
      <div className="space-y-6" data-testid="mobile-stats-page">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70">
              Mobile · Realtime
            </div>
            <h1 className="text-3xl font-semibold text-white">App Analytics</h1>
            <p className="mt-1 max-w-xl text-sm text-white/50">
              All the stats the in-app admin dashboard used to see — now in one
              web console.
            </p>
          </div>
          <Badge variant="default" className="!normal-case">
            Refreshed{" "}
            {new Date().toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Badge>
        </header>

        {/* Overview */}
        <section>
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
            Overview
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard
              testId="mstat-users"
              label="Total Users"
              value={stats.totalUsers}
              icon={Users}
              accent="cyan"
            />
            <StatCard
              testId="mstat-active"
              label="Active Today"
              value={stats.activeUsersToday}
              icon={Activity}
              accent="ok"
            />
            <StatCard
              testId="mstat-sos"
              label="SOS Triggers"
              value={stats.totalSOS}
              icon={AlertCircle}
              accent="pink"
            />
            <StatCard
              testId="mstat-alarms"
              label="Loud Alarms"
              value={stats.totalAlarms}
              icon={Volume2}
              accent="amber"
            />
            <StatCard
              testId="mstat-fakecalls"
              label="Fake Calls"
              value={stats.totalFakeCalls}
              icon={Phone}
              accent="pink"
            />
          </div>
        </section>

        {/* 7-day */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-cyan" /> 7-Day Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-6 text-center text-xs text-white/40">Loading…</div>
            ) : (
              <div className="divide-y divide-white/5">
                {dailyStats.map((s) => (
                  <div
                    key={s.date}
                    className="flex items-center justify-between py-3"
                    data-testid={`daily-${s.date}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg border border-[var(--border)] bg-white/[0.02] p-1.5">
                        <Calendar className="h-3.5 w-3.5 text-white/40" />
                      </div>
                      <div className="text-sm text-white/80">{fmtDate(s.date)}</div>
                    </div>
                    <div className="flex items-center gap-6">
                      <Metric label="SOS" value={s.sosCount} color="text-pink" />
                      <Metric label="Alarm" value={s.alarmCount} color="text-amber" />
                      <Metric label="New" value={s.newUsers} color="text-ok" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-cyan" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-6 text-center text-xs text-white/40">Loading…</div>
            ) : recentEvents.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No mobile activity yet"
                description="As soon as the mobile app emits analytics events, they will appear here."
              />
            ) : (
              <div className="divide-y divide-white/5">
                {recentEvents.map((ev) => {
                  const meta = eventMeta(ev.eventType);
                  const Icon = meta.icon;
                  return (
                    <div
                      key={ev.id}
                      className="flex items-center gap-3 py-3"
                      data-testid={`event-${ev.id}`}
                    >
                      <div className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-2">
                        <Icon className={`h-4 w-4 ${meta.accent}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-white">
                          {meta.label}
                        </div>
                        <div className="truncate text-xs text-white/40">
                          {ev.userEmail || ev.userId || "Anonymous"}
                        </div>
                      </div>
                      <div className="font-mono text-[11px] text-white/40">
                        {fmtTime(ev.timestamp)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-right">
      <div className={`font-mono text-base font-semibold ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</div>
    </div>
  );
}
