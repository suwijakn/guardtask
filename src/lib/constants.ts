// Leave rules, shift times, keyword lists for routing

// Leave types
export const LEAVE_TYPES = ['sick', 'personal', 'annual', 'urgent'] as const;

// Employment statuses
export const EMPLOYMENT_STATUSES = ['active', 'resigned', 'terminated'] as const;

// Shift types
export const SHIFT_TYPES = ['day', 'night'] as const;

// Alert types
export const ALERT_TYPES = [
  'NO_SHOW',
  'DOUBLE_SHIFT',
  'SITE_UNDERSTAFFED',
  'LEAVE_NO_REPLACEMENT',
  'LATE_SEVERE',
  'LATE_MILD',
  'FACE_MISMATCH',
  'PATTERN_LATE',
  'PATTERN_ABSENT',
] as const;

// Alert severities
export const ALERT_SEVERITIES = ['P1', 'P2'] as const;

// Default leave balance (new guard)
export const DEFAULT_LEAVE_BALANCE = {
  sick: 30,
  annual: 6,
  personal: 3,
};

// Default shift times
export const DEFAULT_SHIFT_TIMES = {
  day: '07:00',
  night: '19:00',
};

// Default geofence radius (meters)
export const DEFAULT_GEOFENCE_RADIUS = 200;

// Face verification thresholds
export const FACE_THRESHOLDS = {
  auto_verified: 0.85,
  uncertain: 0.60,
};

// Late minutes thresholds
export const LATE_THRESHOLDS = {
  mild: 5,    // 5-30 minutes = P2
  severe: 30, // >30 minutes = P1
};

// Multi-shift thresholds
export const MULTI_SHIFT_THRESHOLDS = {
  p2: 2, // 2 consecutive shifts = P2
  p1: 3, // 3+ consecutive shifts = P1
};
