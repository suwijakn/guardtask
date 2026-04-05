// TypeScript types matching DB schema

// Site
export interface Site {
  id: string;
  name: string;
  short_name: string;
  address?: string;
  lat?: number;
  lng?: number;
  geofence_radius_m?: number;
  required_guards_day: number;
  required_guards_night: number;
  shift_start_day: string;
  shift_start_night: string;
  has_shared_device?: boolean;
  client_contact_name?: string;
  client_contact_line?: string;
  photo_routing?: PhotoRoutingConfig;
  leave_protocol?: LeaveProtocolConfig;
  created_at: Date;
  updated_at: Date;
}

export interface PhotoRoutingConfig {
  checkin?: {
    send_to_client_group?: boolean;
    client_line_group_id?: string;
    include_guard_name?: boolean;
    include_timestamp?: boolean;
    include_status?: boolean;
    include_replacement_info?: boolean;
  };
}

export interface LeaveProtocolConfig {
  notify_client_on_leave?: boolean;
  notify_client_on_replacement?: boolean;
  client_line_group_id?: string;
  replacement_notice_hours?: number;
  message_template?: string;
}

// Guard
export interface Guard {
  id: string;
  employee_code: string;
  full_name: string;
  nickname?: string;
  phone?: string;
  photo_url?: string;
  current_site_id?: string;
  position: 'guard' | 'shift_leader' | 'patrol';
  employment_status: 'active' | 'resigned' | 'terminated';
  allow_any_site?: boolean;
  start_date?: Date;
  end_date?: Date;
  resignation_date?: Date;
  guard_score?: number;
  leave_balance?: LeaveBalance;
  face_enrolled?: boolean;
  face_enrolled_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface LeaveBalance {
  sick: number;
  annual: number;
  personal: number;
}

// Guard-Site Assignment
export interface GuardSiteAssignment {
  guard_id: string;
  site_id: string;
  is_primary: boolean;
  created_at: Date;
}

// Shift Check-in
export interface ShiftCheckin {
  id: string;
  guard_id: string;
  site_id: string;
  checkin_at: Date;
  checkin_photo_url: string;
  checkin_lat?: number;
  checkin_lng?: number;
  checkin_within_site?: boolean;
  checkout_at?: Date;
  checkout_photo_url?: string;
  shift_type: 'day' | 'night';
  status: 'on_time' | 'late';
  late_minutes?: number;
  consecutive_shifts?: number;
  consecutive_hours?: number;
  replacement_for_guard_id?: string;
  face_similarity?: number;
  face_verified?: boolean;
  face_verified_by?: 'system' | 'admin';
  face_verified_at?: Date;
  face_review_note?: string;
  created_at: Date;
  updated_at: Date;
}

// Leave Request
export interface LeaveRequest {
  id: string;
  ticket_number: string;
  guard_id: string;
  site_id: string;
  leave_type: 'sick' | 'personal' | 'annual' | 'urgent';
  start_date: Date;
  end_date: Date;
  total_days: number;
  original_message: string;
  ai_interpretation?: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: Date;
  review_note?: string;
  replacement_guard_id?: string;
  replacement_set_at?: Date;
  client_notified?: boolean;
  client_notified_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// Manpower Alert
export interface ManpowerAlert {
  id: string;
  type: string;
  severity: 'P1' | 'P2';
  site_id?: string;
  guard_id?: string;
  message: string;
  recommendation?: string;
  acknowledged?: boolean;
  acknowledged_at?: Date;
  acknowledged_by?: string;
  created_at: Date;
}

// LINE Mapping
export interface LineMapping {
  id: string;
  line_user_id: string;
  guard_id?: string;
  display_name?: string;
  is_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

// Conversation
export interface Conversation {
  id: string;
  line_user_id: string;
  guard_id?: string;
  message_text: string;
  ai_intent?: string;
  ai_confidence?: number;
  action_taken?: string;
  created_at: Date;
}

// Guard Photo
export interface GuardPhoto {
  id: string;
  guard_id: string;
  photo_url: string;
  photo_type: 'profile' | 'checkin' | 'checkout';
  taken_at: Date;
  site_id?: string;
  created_at: Date;
}

// Secretary Ping
export interface SecretaryPing {
  id: string;
  pinged_at: Date;
  items_count: number;
  items_summary?: Record<string, unknown>[];
  snoozed_until?: Date;
  created_at: Date;
}

// Admin User
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin';
  created_at: Date;
  updated_at: Date;
}
