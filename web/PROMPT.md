# SAHELI WEB DASHBOARD — IN-DEPTH BUILD PROMPT

> A production-grade companion build prompt and architecture blueprint for the **Saheli** Women Safety web dashboard platform. This document is written so that a senior engineer (or a capable AI agent) can implement the entire web platform end-to-end, starting from an existing React Native Expo + Firebase + FastAPI/Mongo + Cloudinary system.

---

## 1. CONTEXT — WHAT ALREADY EXISTS

The mobile application (Expo SDK 54, React 19) is **production-complete** and located at the root of the `maitri2` repo. It already writes to and reads from:

### Existing Firebase Project
| Key | Value |
|---|---|
| projectId | `maitri-b92e0` |
| authDomain | `maitri-b92e0.firebaseapp.com` |
| storageBucket | `maitri-b92e0.firebasestorage.app` |

Firebase **Authentication** (email/password + phone OTP), **Firestore**, **Storage**.

### Existing Firestore collections (discovered from app code)
| Collection | Purpose | Key fields |
|---|---|---|
| `users` | end-user profiles | `name`, `email`, `phone`, `emergencyContacts[]`, `role` |
| `sos_events` | every SOS triggered from the app | `userName`, `location`, `imageUrl`, `audioUrl`, `sms`, `call`, `timestamp` |
| `safety_markers` | crowd-sourced safe/unsafe markers | `coordinates`, `status` (safe/caution/unsafe), `attributes`, `safetyScore`, `verifications[]` |
| `analytics_events` | telemetry: SOS_TRIGGERED, LOUD_ALARM_TRIGGERED, FAKE_CALL_USED, USER_REGISTERED, APP_OPENED, USER_LOGIN | `eventType`, `userId`, `userEmail`, `timestamp` |
| `analytics_summary` | per-day aggregates | `date`, `sosActivations`, `alarmActivations`, `newUsers` |

### Existing FastAPI backend (`/backend/server.py`)
- `POST /api/sos/upload` — multipart upload of SOS image+audio to Cloudinary
- `POST /api/sos/upload-base64` — base64 fallback
- `POST /api/sos/sign-upload` — returns Cloudinary signed payload (cloud_name=`dbs5egjdh`)
- `POST /api/sos/notify` — duplicates the SOS event to MongoDB (`sos_events` collection)
- `GET /api/sos/events/{user_id}` — history per user
- `GET /api/sos/health` — health check

### Cloudinary
- `cloud_name=dbs5egjdh`, signed uploads via FastAPI sign-upload route. SOS images saved to `sos/images/{user_id}`, audio to `sos/audio/{user_id}` (resource_type=`video`).

The web dashboard MUST keep these contracts intact — it is a **new consumer**, not a replacement.

---

## 2. WEB DASHBOARD — TECH STACK (LOCKED)

| Layer | Choice | Reason |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | RSC, edge-ready, file-based routing |
| Language | **TypeScript 5.6+** strict | type-safety across roles |
| Styling | **Tailwind CSS 3.4** + CSS vars | utility-first, themeable |
| UI kit | **shadcn/ui** (Radix primitives) | accessible, composable |
| State | **Zustand 5** | tiny, no boilerplate |
| Server state | **TanStack Query v5** | for FastAPI calls + caching |
| Auth/DB | **Firebase v11 Web SDK** | reuse existing project |
| Realtime | **Firestore `onSnapshot`** | already used in mobile |
| Maps | **Leaflet 1.9 + react-leaflet 4** | free, no key needed for OSM |
| Charts | **Recharts 2** | already a project dep |
| Animation | **Framer Motion 11** | hero animations, transitions |
| Icons | **lucide-react** | matches mobile |
| Forms | **react-hook-form + zod** | strict validation |
| Notifications | **sonner** | toast |
| QR | `qrcode.react` (generation), `html5-qrcode` (scanning) | station QR & officer scan-on-mobile |
| Deployment | **Vercel** primary, Firebase Hosting alternative | edge functions optional |

---

## 3. ROLES & ACCESS MATRIX

| Capability | super_admin | police_station | police_officer |
|---|:--:|:--:|:--:|
| View all emergency cases (any city) | ✅ | only assigned to station | only assigned to officer |
| Approve police_station registrations | ✅ | ❌ | ❌ |
| Suspend / reject stations | ✅ | ❌ | ❌ |
| Approve officer onboarding (QR) | ✅ | ✅ (own station) | ❌ |
| Generate station QR | ✅ | ✅ (own station) | ❌ |
| Accept / dispatch / resolve SOS | ❌ | ✅ | ✅ (assigned only) |
| View analytics & heatmaps | ✅ (global) | ✅ (district scoped) | view-only |
| Create unsafe-route reports | ❌ | ✅ | ✅ |

Roles are stored on the **Firebase user custom claims** *and* mirrored as `role` in `users/{uid}` for client-side gating.

---

## 4. NEW FIRESTORE COLLECTIONS (EXTEND EXISTING)

```
users/                        (existing — extend with role, stationId)
policeStations/               (NEW)
policeOfficers/               (NEW)
emergencyCases/               (alias for sos_events, with extra triage fields)
safeRoutes/                   (NEW)
unsafeRoutes/                 (NEW — derived from safety_markers.status='unsafe')
notifications/                (NEW)
activityLogs/                 (NEW — audit trail)
stationRequests/              (NEW — registration queue)
officerRequests/              (NEW — QR-onboarded officers awaiting approval)
qrCodes/                      (NEW)
```

### `policeStations/{stationId}`
```ts
{
  stationId: string,            // doc id == short slug e.g. "MH-MUM-BANDRA-001"
  name: string,
  officerInCharge: string,
  phone: string,
  email: string,
  address: string,
  district: string,
  state: string,
  geo: GeoPoint,                // for nearest-station calc
  govtVerificationId: string,
  documents: { name: string, url: string }[],
  status: "pending" | "approved" | "rejected" | "suspended",
  qrCodeUrl?: string,           // PNG hosted on Cloudinary
  createdAt: Timestamp,
  approvedBy?: string,
  approvedAt?: Timestamp,
  online: boolean,              // heartbeat
  lastSeenAt: Timestamp
}
```

### `policeOfficers/{officerId}`
```ts
{
  officerId: string,
  uid: string,                  // firebase auth uid
  stationId: string,
  name: string,
  badgeNumber: string,
  phone: string,
  email: string,
  rank: string,
  status: "pending" | "approved" | "rejected" | "deactivated",
  online: boolean,
  lastLocation?: GeoPoint,
  createdAt: Timestamp
}
```

### `emergencyCases/{caseId}`  (created alongside / from `sos_events`)
```ts
{
  caseId: string,
  sourceEventId: string,        // sos_events doc id
  userId: string,
  userName: string,
  userPhone?: string,
  location: { lat: number, lng: number, accuracy?: number },
  imageUrl?: string,
  audioUrl?: string,
  status: "new" | "acknowledged" | "dispatched" | "in_progress" | "resolved" | "false_alarm" | "escalated",
  priority: "low" | "medium" | "high" | "critical",
  assignedStationId?: string,
  assignedOfficers: string[],
  acceptedAt?: Timestamp,
  resolvedAt?: Timestamp,
  notes: { by: string, text: string, at: Timestamp }[],
  createdAt: Timestamp
}
```

### `stationRequests/{requestId}` — registration queue (super-admin reviews)
### `officerRequests/{requestId}` — officer onboarding queue (station reviews)
### `activityLogs/{logId}` — `{ actor, role, action, target, at }`

---

## 5. PROJECT STRUCTURE

```
web/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx           # PAGE 1 (already shipped)
│   │   ├── register-station/page.tsx
│   │   └── layout.tsx               # centered split layout
│   ├── (dashboard)/
│   │   ├── layout.tsx               # sidebar + topbar shell, role gate
│   │   ├── super-admin/
│   │   │   ├── page.tsx             # KPIs + live feed
│   │   │   ├── stations/page.tsx
│   │   │   ├── stations/requests/page.tsx
│   │   │   ├── users/page.tsx
│   │   │   ├── emergencies/page.tsx
│   │   │   ├── analytics/page.tsx
│   │   │   ├── heatmap/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── station/
│   │   │   ├── page.tsx             # SOS command center
│   │   │   ├── officers/page.tsx
│   │   │   ├── officers/qr/page.tsx
│   │   │   ├── incidents/page.tsx
│   │   │   ├── live-map/page.tsx
│   │   │   └── profile/page.tsx
│   │   └── officer/
│   │       ├── page.tsx             # assigned cases
│   │       └── case/[id]/page.tsx
│   ├── api/                         # next route handlers (proxy to FastAPI)
│   │   ├── cloudinary-sign/route.ts
│   │   └── claims/route.ts          # set custom claims (Admin SDK)
│   ├── layout.tsx
│   ├── page.tsx                     # marketing landing → /login
│   ├── globals.css
│   └── error.tsx / loading.tsx / not-found.tsx
├── components/
│   ├── ui/                          # shadcn primitives
│   ├── auth/
│   │   ├── login-form.tsx
│   │   ├── otp-form.tsx
│   │   └── role-guard.tsx
│   ├── dashboard/
│   │   ├── stat-card.tsx
│   │   ├── live-feed.tsx
│   │   ├── sos-card.tsx
│   │   ├── sidebar.tsx
│   │   ├── topbar.tsx
│   │   └── role-switcher.tsx
│   ├── map/
│   │   ├── leaflet-map.tsx          # dynamic import (ssr:false)
│   │   ├── sos-marker.tsx
│   │   ├── station-marker.tsx
│   │   └── heatmap-layer.tsx
│   ├── analytics/
│   │   ├── sos-chart.tsx
│   │   ├── response-time-chart.tsx
│   │   └── unsafe-trend-chart.tsx
│   └── shared/
│       ├── theme-provider.tsx
│       ├── query-provider.tsx
│       ├── audio-player.tsx
│       └── empty-state.tsx
├── lib/
│   ├── firebase.ts                  # client SDK init
│   ├── firebase-admin.ts            # for /api routes only
│   ├── auth.ts                      # signIn, signOut, role detection
│   ├── firestore/
│   │   ├── stations.ts
│   │   ├── officers.ts
│   │   ├── cases.ts
│   │   ├── markers.ts
│   │   └── analytics.ts
│   ├── realtime/
│   │   ├── useEmergencyCases.ts
│   │   ├── useStationRequests.ts
│   │   ├── useOfficerRequests.ts
│   │   └── useStationOnline.ts
│   ├── stores/
│   │   ├── auth.store.ts
│   │   ├── ui.store.ts
│   │   └── alert.store.ts
│   ├── cloudinary.ts
│   ├── geo.ts                       # haversine, nearest station, clusters
│   └── utils.ts                     # cn, formatDate
├── middleware.ts                    # protect /super-admin, /station, /officer
├── public/
│   ├── logo.svg
│   ├── alarm.mp3                    # SOS audible alert
│   └── grain.png                    # bg texture
├── styles/
│   └── tokens.css                   # CSS variables (futuristic palette)
├── .env.local.example
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
├── tsconfig.json
├── components.json                  # shadcn
└── package.json
```

---

## 6. AUTHENTICATION FLOW

### 6.1 Email + Password
1. `app/(auth)/login/page.tsx` → react-hook-form + zod
2. `signInWithEmailAndPassword(auth, email, password)`
3. Read `users/{uid}` → role
4. Persist user in Zustand `auth.store`
5. Redirect:
   - `super_admin` → `/super-admin`
   - `police_station` → `/station`
   - `police_officer` → `/officer`

### 6.2 Phone OTP (used for officer / station OIC self-service)
1. Render invisible `RecaptchaVerifier`
2. `signInWithPhoneNumber(auth, "+91…", verifier)` → `confirmationResult`
3. User enters 6-digit OTP → `confirmationResult.confirm(otp)`
4. If first time → ask for name/badge → write `policeOfficers` request

### 6.3 Persistence & Session
- `setPersistence(auth, browserLocalPersistence)`
- `onAuthStateChanged` → hydrates Zustand
- `middleware.ts` reads `__session` cookie set via `getIdToken()` → if missing, redirect `/login`
- Idle timeout 30 min for `super_admin`, 60 min for others

### 6.4 Custom Claims (server-side guarantee)
Inside `app/api/claims/route.ts`, using firebase-admin:
```ts
await admin.auth().setCustomUserClaims(uid, { role, stationId? })
```
Client must `getIdToken(true)` after claim change.

---

## 7. STATION REGISTRATION & APPROVAL FLOW

```
[Public form]  →  stationRequests/{id} status=pending
   │
   ▼ super_admin reviews
[Approve]      →  policeStations/{stationId} created
                  + qrCodeUrl generated (Cloudinary upload of PNG)
                  + email station OIC with credentials
                  + activityLogs entry
[Reject]       →  status=rejected  + reason
[Suspend]      →  status=suspended (later)
```

Station QR encodes: `saheli://onboard?stationId=XYZ&token=…` (HMAC).

---

## 8. OFFICER VERIFICATION (QR + STATION APPROVAL)

```
Mobile officer flow (already exists in app):
  Tap "Register as Police Officer"
  → expo-camera scans station QR
  → POST officerRequests/{id} {stationId, badgeNumber, phone, name}

Web station dashboard:
  /station/officers → realtime list of pending officerRequests
  Approve → policeOfficers/{officerId} {status:'approved'}
            + Firebase custom claim role='police_officer', stationId
            + officer becomes notified of new SOS in their geofence
```

---

## 9. SOS / EMERGENCY LIFECYCLE

```
Mobile triggers SOS
    │
    ▼
sos_events/{evt}                 (existing collection)
    │
    ▼ Cloud Function (NEW, optional) OR client-side dual-write
emergencyCases/{caseId}          status=new, priority=high
    │
    ▼ Firestore onSnapshot listeners
[Web]   super_admin live feed
[Web]   police_station with nearest-station rule (geohash)
[Sound] sonner.toast + /alarm.mp3 plays once
    │
    ▼ Station accepts
status=acknowledged, assignedStationId=…, acceptedAt=now
    │
    ▼ Assign officer
status=dispatched, assignedOfficers=[uid…]
notifications/* push to officer
    │
    ▼ Officer arrives
status=in_progress
    │
    ▼ Resolve / Escalate / False alarm
final status, resolvedAt
activityLogs/* audit entry
```

Each step is a transactional `updateDoc` so both station + officer + admin views update in <500ms.

---

## 10. REALTIME ARCHITECTURE

Use Firestore `onSnapshot` ONLY (no separate websocket layer needed):

```ts
// lib/realtime/useEmergencyCases.ts
export function useEmergencyCases(scope: { stationId?: string }) {
  const [cases, setCases] = useState<Case[]>([]);
  useEffect(() => {
    const base = collection(db, "emergencyCases");
    const q = scope.stationId
      ? query(base,
          where("status","in",["new","acknowledged","dispatched","in_progress","escalated"]),
          where("assignedStationId","==", scope.stationId),
          orderBy("createdAt","desc"), limit(50))
      : query(base,
          where("status","in",["new","acknowledged","dispatched","in_progress","escalated"]),
          orderBy("createdAt","desc"), limit(50));
    return onSnapshot(q, snap => setCases(snap.docs.map(d=>({id:d.id,...d.data()} as Case))));
  }, [scope.stationId]);
  return cases;
}
```

For **online presence** of stations/officers:
- Use Realtime DB `.info/connected` with `onDisconnect()` updating `online: false` (Firestore alone cannot detect disconnect cheaply).

---

## 11. MAPS & HEATMAPS (Leaflet)

- `components/map/leaflet-map.tsx` is `dynamic(() => import("..."), { ssr: false })`
- OpenStreetMap tile layer (no key) — fallback to Google via `@react-google-maps/api` if key present
- Marker clustering via `leaflet.markercluster`
- Heatmap via `leaflet.heat` from `safety_markers` where `status==='unsafe'` weighted by `1 / (verificationCount+1)` * `safetyScore inversion`
- Nearest-station calc: pre-compute geohash on station create, query 9 cells around incident.

---

## 12. CLOUDINARY (REUSED)

- For station registration documents (PDF, images)
- Web upload uses **signed** uploads via `app/api/cloudinary-sign/route.ts` → calls FastAPI `/api/sos/sign-upload` (already exists) with `folder=stations/docs`
- Use `next/image` for optimized previews via `res.cloudinary.com/dbs5egjdh/...`

---

## 13. FIRESTORE SECURITY RULES (PRODUCTION)

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {

    function isSignedIn() { return request.auth != null; }
    function role() { return request.auth.token.role; }
    function isAdmin() { return role() == 'super_admin'; }
    function isStation() { return role() == 'police_station'; }
    function isOfficer() { return role() == 'police_officer'; }
    function myStation() { return request.auth.token.stationId; }

    match /users/{uid} {
      allow read: if isSignedIn() && (request.auth.uid == uid || isAdmin());
      allow write: if request.auth.uid == uid;
    }

    match /policeStations/{sid} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    match /stationRequests/{id} {
      allow create: if true;          // public form
      allow read, update, delete: if isAdmin();
    }

    match /policeOfficers/{oid} {
      allow read: if isSignedIn() && (isAdmin() || (isStation() && resource.data.stationId == myStation()) || resource.data.uid == request.auth.uid);
      allow write: if isAdmin() || (isStation() && resource.data.stationId == myStation());
    }

    match /emergencyCases/{cid} {
      allow read: if isSignedIn() && (
        isAdmin()
        || (isStation() && resource.data.assignedStationId == myStation())
        || (isOfficer() && request.auth.uid in resource.data.assignedOfficers)
      );
      allow update: if isAdmin() || isStation() || isOfficer();
      allow create: if true;          // mobile clients write
      allow delete: if isAdmin();
    }

    match /sos_events/{id} {
      allow read: if isSignedIn() && (isAdmin() || isStation() || isOfficer());
      allow create: if true;
      allow update, delete: if isAdmin();
    }

    match /safety_markers/{id} {
      allow read: if true;
      allow create: if isSignedIn();
      allow update: if isSignedIn();  // upvote/verify transactions
      allow delete: if isAdmin();
    }

    match /activityLogs/{id} {
      allow read: if isAdmin();
      allow create: if isSignedIn();
    }
  }
}
```

---

## 14. UI / UX DESIGN SYSTEM

**Mood:** Government-grade emergency response operating system (think NCMEC + Tesla service ops).
**Theme:** dark by default, with a slate-cyan-amber-rose palette.

```css
/* styles/tokens.css */
:root {
  --bg-0:      #07090f;
  --bg-1:      #0c1220;
  --bg-2:      #131a2c;
  --border:    rgba(255,255,255,0.06);
  --border-hi: rgba(0,229,255,0.25);
  --text:      #e7ecf3;
  --text-dim:  #8a93a6;
  --cyan:      #00e5ff;
  --pink:      #ff2d95;
  --amber:     #ffb020;
  --green:     #22e08c;
  --red:       #ff3b3b;
  --glass:     rgba(20,28,48,0.55);
}
```

- Glass cards: `backdrop-blur-xl bg-[var(--glass)] border border-[var(--border)] rounded-2xl`
- Pulsing SOS marker: `keyframes ping` ring + 0.5s heartbeat
- Sidebar: 240px → 72px collapsed, slide-spring with framer-motion
- Typography: **Geist Sans** (UI) + **JetBrains Mono** (badges, IDs)
- 8-pt grid spacing, 16px corner radius default, 24px on hero cards
- Reduce motion when `prefers-reduced-motion`

### Pages required (with deep specs)
1. `/login` — split: left brand panel with animated radar SVG, right form
2. `/register-station` — multi-step (Station Info → Address+Geo → Documents → Review)
3. `/super-admin` — 6 KPI cards + Live Feed + Recent Incidents table + Map preview
4. `/super-admin/stations` — table w/ filter (status, district), drawer detail
5. `/super-admin/stations/requests` — Kanban (pending/approved/rejected)
6. `/super-admin/users` — searchable, pagination, suspend
7. `/super-admin/emergencies` — global SOS list + map split view
8. `/super-admin/analytics` — Recharts (line: SOS over time, bar: top districts, donut: outcome)
9. `/super-admin/heatmap` — full-screen Leaflet heat
10. `/station` — Command center (live SOS pulse cards on left, map on right with assigned officers)
11. `/station/officers` — pending QR onboardings + active roster
12. `/station/officers/qr` — print-ready QR poster (qrcode.react `level=H`)
13. `/station/incidents` — historical
14. `/officer` — only my assigned cases, accept/decline/arrived/resolve buttons
15. `/officer/case/[id]` — case detail w/ live victim location, audio, image

---

## 15. PERFORMANCE & SECURITY CHECKLIST

- [ ] Firestore composite indexes for every realtime `where + orderBy`
- [ ] `revalidate=0` on dashboard pages (always SSR fresh)
- [ ] `dynamic={ssr:false}` for Leaflet to avoid window errors
- [ ] Image optimisation (`next/image`) for Cloudinary URLs (configure remotePatterns in `next.config.mjs`)
- [ ] Server actions disabled where Firebase client SDK is used (avoid double init)
- [ ] CSP headers via `next.config.mjs` headers()
- [ ] `httpOnly` __session cookie for middleware
- [ ] Rate-limit `/api/*` via `@upstash/ratelimit` or KV
- [ ] Audit log every approve/reject/escalate action
- [ ] Sound alert is one-shot per case (Set-based dedup)
- [ ] No PII in logs

---

## 16. DEPLOYMENT (VERCEL)

```
Project: saheli-web
Framework: Next.js 15
Build cmd: next build
Output:    .next
Env vars:  copy .env.local.example → set in Vercel → tag for Production+Preview
Domains:   dashboard.saheli.app
```

Firebase Admin SDK key (for /api/claims) stored as `FIREBASE_ADMIN_PRIVATE_KEY` (with `\n` preserved).

---

## 17. STEP-BY-STEP BUILD ORDER

1. **Page 1 — Login** (this delivery) — Firebase email/password, role detect, redirect
2. Sidebar shell + dashboard layout + middleware
3. Super-admin landing (KPIs from `analytics_summary` + live feed from `sos_events`)
4. Stations CRUD + approval flow
5. Police Station dashboard + live SOS panel
6. Officer onboarding (QR generate + scan request review)
7. Map + heatmap pages
8. Analytics page
9. Notifications + sound
10. Audit log + settings
11. Security rules + indexes deploy
12. End-to-end test (super_admin, station, officer journeys)
13. Vercel production deploy

---

*End of build prompt — every section above is implementable verbatim and matches the existing Firebase / Cloudinary / FastAPI contracts.*
