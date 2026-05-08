"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DashboardShell } from "@/components/dashboard/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SummaryRow {
  date: string;
  sosActivations?: number;
  alarmActivations?: number;
  newUsers?: number;
}

const COLORS = ["#00e5ff", "#ff2d95", "#ffb020", "#22e08c", "#ff3b3b"];

export default function AnalyticsPage() {
  const [summaries, setSummaries] = useState<SummaryRow[]>([]);
  const [outcomeData, setOutcomeData] = useState<{ name: string; value: number }[]>([]);
  const [districtData, setDistrictData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const sumSnap = await getDocs(query(collection(db, "analytics_summary")));
        const rows: SummaryRow[] = sumSnap.docs.map((d) => ({ date: d.id, ...(d.data() as SummaryRow) }));
        rows.sort((a, b) => a.date.localeCompare(b.date));
        setSummaries(rows.slice(-14));

        const casesSnap = await getDocs(query(collection(db, "emergencyCases")));
        const outcomes: Record<string, number> = {};
        const districts: Record<string, number> = {};
        casesSnap.docs.forEach((d) => {
          const data = d.data() as any;
          outcomes[data.status] = (outcomes[data.status] || 0) + 1;
          if (data.assignedStationId) {
            districts[data.assignedStationId] = (districts[data.assignedStationId] || 0) + 1;
          }
        });
        setOutcomeData(Object.entries(outcomes).map(([name, value]) => ({ name, value })));
        setDistrictData(
          Object.entries(districts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([name, value]) => ({ name, value })),
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <DashboardShell allow={["super_admin"]} title="Analytics">
      <div className="space-y-6" data-testid="analytics-page">
        <header>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70">Insights</div>
          <h1 className="text-3xl font-semibold text-white">Network Analytics</h1>
        </header>

        {loading ? (
          <div className="py-8 text-center text-xs text-white/40">Aggregating data…</div>
        ) : (
          <>
            <Card>
              <CardHeader><CardTitle className="text-base">SOS Activations · last 14 days</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                {summaries.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-white/40">
                    No analytics_summary data yet — values will appear once the mobile app emits daily aggregates.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={summaries}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="date" stroke="#8a93a6" fontSize={11} />
                      <YAxis stroke="#8a93a6" fontSize={11} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ color: "#8a93a6", fontSize: 11 }} />
                      <Line type="monotone" dataKey="sosActivations" stroke="#ff2d95" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="alarmActivations" stroke="#00e5ff" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="newUsers" stroke="#22e08c" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Cases by station (top 8)</CardTitle></CardHeader>
                <CardContent className="h-[280px]">
                  {districtData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-xs text-white/40">No assigned cases yet</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={districtData}>
                        <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="name" stroke="#8a93a6" fontSize={10} interval={0} angle={-15} textAnchor="end" height={60} />
                        <YAxis stroke="#8a93a6" fontSize={11} allowDecimals={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="value" fill="#00e5ff" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Case outcomes</CardTitle></CardHeader>
                <CardContent className="h-[280px]">
                  {outcomeData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-xs text-white/40">No cases yet</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={outcomeData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                          {outcomeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ color: "#8a93a6", fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

const tooltipStyle = {
  background: "rgba(20,28,48,0.95)",
  border: "1px solid rgba(0,229,255,0.2)",
  borderRadius: 12,
  color: "#e7ecf3",
  fontSize: 12,
};
