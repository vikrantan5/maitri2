import type { Timestamp } from "firebase/firestore";

export type CaseStatus =
  | "new"
  | "acknowledged"
  | "dispatched"
  | "in_progress"
  | "resolved"
  | "false_alarm"
  | "escalated";

export type Priority = "low" | "medium" | "high" | "critical";

export interface EmergencyCase {
  id: string;
  caseId?: string;
  sourceEventId?: string;
  userId: string;
  userName: string;
  userPhone?: string;
  location?: { lat: number; lng: number; accuracy?: number };
  imageUrl?: string;
  audioUrl?: string;
  status: CaseStatus;
  priority: Priority;
  assignedStationId?: string;
  assignedOfficers?: string[];
  acceptedAt?: Timestamp;
  resolvedAt?: Timestamp;
  notes?: { by: string; text: string; at: Timestamp }[];
  createdAt?: Timestamp;
}

export interface SosEvent {
  id: string;
  userId?: string;
  userName?: string;
  location?: { lat: number; lng: number } | null;
  imageUrl?: string;
  audioUrl?: string;
  sms?: boolean;
  call?: boolean;
  timestamp?: Timestamp | string;
  // Backward-compat from mobile schema:
  latitude?: number;
  longitude?: number;
}

export interface PoliceStation {
  id: string;
  stationId: string;
  name: string;
  officerInCharge: string;
  phone: string;
  email: string;
  address: string;
  district: string;
  state: string;
  geo?: { lat: number; lng: number };
  govtVerificationId?: string;
  documents?: { name: string; url: string }[];
  status: "pending" | "approved" | "rejected" | "suspended";
  qrCodeUrl?: string;
  createdAt?: Timestamp;
  approvedBy?: string;
  approvedAt?: Timestamp;
  online?: boolean;
}

export interface PoliceOfficer {
  id: string;
  officerId?: string;
  uid?: string;
  stationId: string;
  name: string;
  badgeNumber: string;
  phone: string;
  email?: string;
  rank?: string;
  status: "pending" | "approved" | "rejected" | "deactivated";
  online?: boolean;
  lastLocation?: { lat: number; lng: number };
  createdAt?: Timestamp;
}

export interface SafetyMarker {
  id: string;
  coordinates?: { lat: number; lng: number } | null;
  latitude?: number;
  longitude?: number;
  status?: "safe" | "caution" | "unsafe";
  attributes?: string[];
  safetyScore?: number;
  verifications?: { uid: string }[];
  userId?: string;
  createdAt?: Timestamp;
}
