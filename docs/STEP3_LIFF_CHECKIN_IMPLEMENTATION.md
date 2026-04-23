# Step 3: LIFF Check-in Page Implementation

## Overview
Implemented complete LIFF check-in page with dual-path identity flow (Path A: verified users, Path B: unverified users with site password).

## Implementation Date
April 5, 2026

## Files Created/Modified

### 1. LIFF Check-in Page
**File:** `src/app/liff/checkin/page.tsx`

**Features:**
- LIFF SDK initialization with error handling
- Dual-path identity flow (Path A & Path B)
- Front-facing camera integration (no gallery access)
- Site and guard selection dropdowns
- Photo capture and preview
- Form validation and submission

**Path A (Verified Users):**
1. LIFF init → get LINE userId
2. Call `/api/checkin/identity` → status: 'verified'
3. Show site dropdown (from identity response)
4. On site select → fetch guards for that site
5. Show guard dropdown
6. Camera → capture photo
7. Submit check-in

**Path B (Unverified Users):**
1. LIFF init → get LINE userId
2. Call `/api/checkin/identity` → status: 'unverified'
3. Show 6-digit password input (numeric keyboard)
4. Verify password → `/api/checkin/verify-site-password`
5. On success → show guard dropdown for that site
6. Camera → capture photo
7. Submit check-in

### 2. API Endpoints

#### GET /api/checkin/guards-by-site
**File:** `src/app/api/checkin/guards-by-site/route.ts`

**Purpose:** Fetch active guards assigned to a specific site

**Request:**
```
GET /api/checkin/guards-by-site?siteId=xxx
```

**Response:**
```json
{
  "guards": [
    {
      "id": "uuid",
      "fullName": "ทดสอบ สมศักดิ์",
      "employeeCode": "G-002",
      "photoUrl": "https://...",
      "isPrimary": true
    }
  ]
}
```

**Logic:**
- Query `guard_site_assignments` where `siteId` matches
- Filter by `guard.employmentStatus = 'active'`
- Order by guard name ascending

#### POST /api/checkin
**File:** `src/app/api/checkin/route.ts`

**Purpose:** Submit check-in with photo upload and shift calculations

**Request:**
```json
{
  "guardId": "uuid",
  "siteId": "uuid",
  "photo": "data:image/jpeg;base64,...",
  "lineUserId": "U123...",
  "pathType": "A" | "B",
  "lat": 13.7563,
  "lng": 100.5018
}
```

**Response:**
```json
{
  "ok": true,
  "checkinId": "uuid",
  "status": "on_time" | "late_minor" | "late_major",
  "lateMinutes": 0
}
```

**Logic:**
1. Validate guard is active and assigned to site
2. Upload photo to Supabase Storage `checkin-photos` bucket
3. Calculate shift type (day: 6:00-18:00, night: 18:00-6:00)
4. Calculate late minutes based on site shift start times
5. Calculate status (on_time ≤0, late_minor ≤15, late_major >15)
6. Check geofence (if GPS provided)
7. Calculate consecutive shifts (last 7 days)
8. Calculate consecutive hours (total worked hours)
9. Check double shift (2 shifts same day)
10. Insert `shift_checkins` record

**Auto-calculated Fields:**
- `shift_type`: 'day' | 'night'
- `status`: 'on_time' | 'late_minor' | 'late_major'
- `late_minutes`: Integer
- `consecutive_shifts`: Count of consecutive days worked
- `consecutive_hours`: Total hours worked in recent shifts
- `is_double_shift`: Boolean (2+ shifts same day)
- `checkin_within_site`: Boolean (within geofence radius)

#### POST /api/checkout
**File:** `src/app/api/checkout/route.ts`

**Purpose:** Submit check-out with photo

**Request:**
```json
{
  "checkinId": "uuid",
  "photo": "data:image/jpeg;base64,...",
  "lineUserId": "U123..."
}
```

**Response:**
```json
{
  "ok": true,
  "checkoutId": "uuid",
  "checkinAt": "2026-04-05T10:00:00Z",
  "checkoutAt": "2026-04-05T18:00:00Z"
}
```

**Logic:**
1. Find checkin record by ID
2. Validate not already checked out
3. Upload checkout photo to Supabase Storage
4. Update `shift_checkins` record with checkout timestamp and photo

## Environment Variables Required

```env
# LIFF
NEXT_PUBLIC_LIFF_ID=your-liff-id

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Supabase Storage Setup

**Bucket:** `checkin-photos`
- Public access enabled
- File naming: `{guardId}_{timestamp}.jpg` (checkin)
- File naming: `checkout_{guardId}_{timestamp}.jpg` (checkout)

## Shift Calculation Logic

### 1. Shift Type
```typescript
function calculateShiftType(hour: number): 'day' | 'night' {
  return hour >= 6 && hour < 18 ? 'day' : 'night';
}
```

### 2. Late Minutes
```typescript
const shiftStartTime = shiftType === 'day' 
  ? site.shiftStartDay   // e.g., "06:00"
  : site.shiftStartNight; // e.g., "18:00"

const [startHour, startMinute] = shiftStartTime.split(':').map(Number);
const shiftStart = new Date(now);
shiftStart.setHours(startHour, startMinute, 0, 0);

const lateMinutes = Math.max(0, Math.floor((now - shiftStart) / 60000));
```

### 3. Status
```typescript
function calculateStatus(lateMinutes: number): string {
  if (lateMinutes <= 0) return 'on_time';
  if (lateMinutes <= 15) return 'late_minor';
  return 'late_major';
}
```

### 4. Consecutive Shifts
Counts how many consecutive days the guard has worked (including today).

### 5. Consecutive Hours
Sum of all worked hours in recent shifts (where checkout exists).

### 6. Double Shift
Checks if guard has 2+ check-ins on the same day.

### 7. Geofence Check
Uses Haversine formula to calculate distance between checkin GPS and site coordinates.

```typescript
function calculateDistance(lat1, lon1, lat2, lon2): number {
  // Returns distance in meters
  // checkinWithinSite = distance <= site.geofenceRadiusM
}
```

## User Flow

### Path A: Verified User
```
1. Open LIFF → LIFF SDK init
2. Get LINE profile → lineUserId
3. Call /api/checkin/identity → verified
4. Select site from dropdown
5. Fetch guards → /api/checkin/guards-by-site?siteId=xxx
6. Select guard from dropdown
7. Open camera (front-facing)
8. Capture photo
9. Submit → POST /api/checkin
10. Success → Close LIFF window
```

### Path B: Unverified User
```
1. Open LIFF → LIFF SDK init
2. Get LINE profile → lineUserId
3. Call /api/checkin/identity → unverified
4. Enter 6-digit site password
5. Verify → POST /api/checkin/verify-site-password
6. Success → Show site name + guard dropdown
7. Select guard from dropdown
8. Open camera (front-facing)
9. Capture photo
10. Submit → POST /api/checkin
11. Success → Close LIFF window
```

## Security Features

1. **LIFF-only Access:** Page checks `liff.isInClient()` - shows error if opened in browser
2. **Guard Validation:** API validates guard is active and assigned to site
3. **Photo Required:** Cannot submit without capturing photo
4. **Front-facing Camera:** No gallery access, must take live photo
5. **Rate Limiting:** Password verification has 5 attempts/minute/IP (from Step 2)

## Testing Checklist

- [ ] LIFF initialization works
- [ ] Path A: Verified user can select site and guard
- [ ] Path B: Unverified user can enter password
- [ ] Camera opens (front-facing only)
- [ ] Photo capture and preview works
- [ ] Check-in submission successful
- [ ] Photo uploaded to Supabase
- [ ] Shift calculations correct
- [ ] Geofence check works (if GPS provided)
- [ ] Check-out works
- [ ] LIFF window closes after success

## Known Limitations

1. **No Face Verification:** Photo routing and face verification not implemented yet (Step 4)
2. **No GPS Fallback:** If GPS denied, checkin_within_site will be null
3. **No Offline Support:** Requires internet connection
4. **No Photo Compression:** Base64 photos may be large

## Next Steps

- Implement photo routing (Step 4)
- Add face verification with CompreFace
- Add offline support with service workers
- Optimize photo compression
- Add loading states and better error handling
- Add checkout LIFF page (currently only checkin implemented)

## Dependencies

- `@line/liff`: ^2.28.0 (LIFF SDK)
- `@supabase/supabase-js`: ^2.101.1 (Storage)
- `@prisma/client`: ^7.6.0 (Database)

## Database Tables Used

- `guards` - Guard information
- `sites` - Site information and shift times
- `guard_site_assignments` - Guard-site relationships
- `shift_checkins` - Check-in/out records
- `line_mappings` - LINE identity mappings (Path B)
