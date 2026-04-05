# SakornGuard Manpower Management System — Complete Spec

> **Version:** 2.0 — 2 เม.ย. 2569
> **สถานะ:** พร้อมส่ง Dev (Windsurf)
> **Stack:** Next.js (App Router) + PostgreSQL + BetterAuth + LINE OA (LIFF) + Claude API
> **Hosting:** Vercel + Supabase (เริ่มจาก free tier)
>
> **เปลี่ยนแปลงจาก v1.0:**
> - เพิ่ม LINE Identity Binding + Site Password fallback (Section 4.1, 4.6, 6.2, 11F) — ป้องกันการเห็น guard list ทั้งหมด, rate limit, pending mapping approval — security layer สำหรับ LIFF check-in
> - เพิ่ม CompreFace Face Verification (Section 11E) — self-hosted บน Hetzner, enrollment flow, similarity threshold, integration กับ Next.js
> - เพิ่ม Secretary Agent (Section 11D) — morning briefing 07:00, realtime ping, cooldown, snooze via LINE
> - เพิ่ม Leave Protocol per-site (Section 11C) — auto push LINE แจ้งลูกค้าเมื่อมีคนแทน, deadline reminder, ตั้งค่าแยกแต่ละ site
> - เพิ่ม 2-Layer AI Routing (Section 11A) — Layer 1 rule-based + fuzzy match ก่อน ไม่ส่งทุก message เข้า Claude
> - เพิ่ม Prompt Caching สำหรับทุก Claude call (Section 11B)
> - ปรับ Cron no-show ให้มี DB pre-filter ก่อนเรียก Claude (Section 21.1)
> - เพิ่ม Cross-check Cron ทุกเช้า/เย็น (Section 21.5) — safety net จับ edge case ที่หลุดทั้งสอง layer
> - ปรับ Webhook handler ให้ผ่าน routing layer ก่อนเสมอ (Section 19.1)
> - เพิ่ม Cron schedule สำหรับ cross-check ใน vercel.json (Section 25.3)

---

## 1. Product Overview

### 1.1 ปัญหาที่แก้

SakornGuard (บริษัท รักษาความปลอดภัย สาครการ์ด จำกัด) บริหาร รปภ ~65 คน กระจาย 23+ ไซต์ ปัจจุบันจัดการกำลังพลผ่าน LINE chat ทั้งหมด — ไม่มี record เป็นระบบ ไม่มี alert อัตโนมัติ ไม่มีข้อมูลตัดสินใจ

ปัญหาซ้ำๆ: ควงกะ, ไม่เข้ากะ, มาสาย, ลาแล้วไม่มีคนแทน, ลูกค้าไม่เห็นรูปเข้ากะ

### 1.2 Solution

Web app ฝังใน LINE OA (ผ่าน LIFF) + AI-powered alerts ที่:
- รปภ เช็คอินด้วยการ **เลือกชื่อ → เลือกไซต์ → ถ่ายรูป** (ไม่ต้อง login)
- รูปถ่ายถูก **route อัตโนมัติ** ไปยังกลุ่ม LINE ลูกค้า (ตาม config ของแต่ละ site)
- **AI (Claude API) ตรวจ condition** ทั้งหมด: มาสาย, ควงกะ, pattern ขาดงาน, ลาไม่มีคนแทน
- รปภ **ขอลาโดยพิมพ์ข้อความ** ใน LINE → AI สร้าง ticket → admin อนุมัติ/ปฏิเสธ
- Admin dashboard ดูรูปเช็คอิน เทียบกับรูปโปรไฟล์ ตรวจ identity ทีหลัง

### 1.3 Users & Roles

| Role | จำนวน | ใช้งานผ่าน | ทำอะไร |
|------|--------|-----------|--------|
| **รปภ (guard)** | ~65 คน | LINE OA (LIFF + chat) | เช็คอิน/เอาท์, ขอลา, ดูตารางกะตัวเอง |
| **หัวหน้าชุด (shift_leader)** | ~5–8 คน | LINE OA (LIFF) + Admin | ดูกำลังพลไซต์ตัวเอง, verify เช็คอิน |
| **สายตรวจ (patrol)** | ~2–3 คน | Admin dashboard | ดูหลายไซต์, ช่วย onboard |
| **Admin (Suwijak)** | 1 คน | Admin dashboard | ทุกอย่าง: อนุมัติลา, จัดการ guard/site, ดู alert, reports |

---

## 2. Tech Stack

| Layer | Technology | หมายเหตุ |
|-------|-----------|---------|
| **Framework** | Next.js 14+ (App Router) | SSR + API routes + LIFF pages |
| **Language** | TypeScript | ทั้ง frontend + backend |
| **Database** | PostgreSQL (Supabase) | Relational — ดี query ซับซ้อน |
| **ORM** | Prisma หรือ Drizzle | Windsurf เลือกตามถนัด |
| **Auth** | BetterAuth | Admin login (email+password) |
| **Object Storage** | Supabase Storage หรือ S3-compatible | เก็บรูปเช็คอิน |
| **LINE Integration** | LINE Messaging API + LIFF SDK | Webhook + Rich Menu + LIFF pages |
| **AI** | Claude API (claude-sonnet-4-20250514) | Intent classification + Alert condition checking |
| **Hosting** | Vercel | Next.js deploy |
| **Cron** | Vercel Cron | Scheduled checks (no-show, pattern detect, weekly digest) |
| **Styling** | Tailwind CSS | |
| **Face Verification** | CompreFace (self-hosted) | Docker Compose บน Hetzner CX22 |

---

## 3. Core Modules

### Module Overview

```
┌──────────────────────────────────────────────────────┐
│                SakornGuard Manpower                  │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐ │
│  │ Shift    │ │ Leave &  │ │ Workforce            │ │
│  │ Tracking │ │ Absence  │ │ Lifecycle            │ │
│  └────┬─────┘ └────┬─────┘ └──────────┬───────────┘ │
│       │            │                  │             │
│       └──────┬─────┴──────────────────┘             │
│              ▼                                      │
│  ┌───────────────────────────────────────┐          │
│  │  Layer 1 — Routing (rule-based/fuzzy) │          │
│  │  keyword match → ไม่ใช้ Claude เลย   │          │
│  └────────────────┬──────────────────────┘          │
│                   │ match เท่านั้น                   │
│                   ▼                                  │
│     ┌──────────────────────┐                        │
│     │  Layer 2 — Claude API│                        │
│     │  (batch · cached)    │                        │
│     └──────────┬───────────┘                        │
│                ▼                                    │
│     ┌──────────────────────┐                        │
│     │  LINE Notify +       │                        │
│     │  Photo Routing       │                        │
│     └──────────────────────┘                        │
└──────────────────────────────────────────────────────┘
```

---

## 4. Module A: Shift Tracking (เช็คอิน/เช็คเอาท์)

### 4.1 Check-in Flow — LINE Identity Binding + Site Password Fallback

**Entry point:** ปุ่ม Rich Menu ใน LINE OA → เปิด LIFF page `/liff/checkin`

LIFF เรียก `liff.getProfile()` ทันทีเพื่อดึง `lineUserId` ก่อนแสดง UI ใดๆ

```
เปิด /liff/checkin
        │
        ▼
liff.getProfile() → lineUserId
        │
        ▼
GET /api/checkin/identity?lineUserId=Uxxxxx
        │
        ├── MAPPED + VERIFIED ✅
        │   Path A: Verified Flow
        │   → เลือก site (dropdown เฉพาะ site ที่ whitelist)
        │   → เลือกชื่อ (dropdown เฉพาะ guards ของ site นั้น)
        │   → ถ่ายรูป → submit
        │
        └── ไม่มีใน DB / pending / unverified
            Path B: Site Password Fallback
            → แสดงฟอร์ม "ใส่รหัสผ่านไซต์"
            → POST /api/checkin/verify-site-password
            → password ตรง → รู้ว่าอยู่ site ไหน
            → เลือกชื่อ (dropdown เฉพาะ guards ของ site นั้น)
            → ถ่ายรูป → submit
            + สร้าง pending line_mapping อัตโนมัติ (รอ admin approve)
```

#### Path A — Verified Flow (LINE mapped แล้ว)

1. **เลือก site** — dropdown เฉพาะ sites ที่ guard_site_assignments ของ LINE userId นั้น
2. **เลือกชื่อ** — dropdown เฉพาะ guards ที่ assigned กับ site ที่เลือก (ทุกคน — รองรับเครื่องรวม)
3. **ถ่ายรูป** — กล้องหน้า (`capture="user"`) ถ่ายสดเท่านั้น
4. **Submit**

#### Path B — Site Password Fallback (ยังไม่ verified)

1. **ใส่ site password** — 6-digit code ที่ admin generate ให้แต่ละ site
2. **POST /api/checkin/verify-site-password** → ระบบตรวจ bcrypt hash → คืน site_id
3. **เลือกชื่อ** — dropdown เฉพาะ guards ของ site นั้น
4. **ถ่ายรูป** — กล้องหน้าเท่านั้น
5. **Submit** → เช็คอินสำเร็จ
6. **[Background]** สร้าง `line_mappings` record:
   - `line_user_id` = lineUserId จาก LIFF
   - `guard_id` = guard ที่เลือก
   - `site_id` = site ที่ password ตรง
   - `is_verified` = false (รอ admin approve)
   - Admin เห็นใน `/admin/line-mapping` → กด approve

> **หมายเหตุ:** รปภ ที่ยัง pending ต้องใส่ password ทุกครั้ง จนกว่า admin จะ approve
> เมื่อ approve แล้ว → ครั้งถัดไปใช้ Path A (ไม่ต้องใส่ password อีก)

### 4.6 Site Password Management

แต่ละ site มี 6-digit checkin password ใช้สำหรับ Path B fallback

**Admin สร้าง/เปลี่ยน password ใน `/admin/sites/[id]`:**

```
กด [Generate New Password]
        │
        ▼
ระบบสร้าง random 6-digit code เช่น "847293"
bcrypt hash → เก็บใน sites.checkin_password_hash
        │
        ├── แสดง code ให้ admin copy (ครั้งเดียว ไม่เก็บ plaintext)
        └── แสดง QR code สำหรับ admin ส่งให้ รปภ ทาง LINE กลุ่มไซต์
```

**กฎ:**
- generate ใหม่ = code เก่าใช้ไม่ได้ทันที
- ไม่เก็บ plaintext ใน DB — เก็บแค่ bcrypt hash
- แสดง `password_updated_at` ใน admin UI เพื่อให้รู้ว่า code นี้อายุเท่าไหร่
- แนะนำเปลี่ยนทุก 30 วัน หรือเมื่อมี รปภ ลาออก

**DB fields เพิ่มใน `sites` table:**
```sql
checkin_password_hash  VARCHAR(255),   -- bcrypt hash ของ 6-digit code
password_updated_at    TIMESTAMPTZ,    -- เวลาที่ generate ล่าสุด
```

**API:**
```
POST /api/sites/[id]/generate-password
  → สร้าง 6-digit code
  → bcrypt hash → update sites.checkin_password_hash + password_updated_at
  → return { plaintext_code: "847293" }  ← แสดงครั้งเดียว ไม่เก็บ

POST /api/checkin/verify-site-password
  body: { password: "847293", lineUserId: "Uxxxxx" }
  → ค้นหา site ที่ bcrypt.compare(password, hash) = true
  → return { site_id, site_name }  ← ถ้าตรง
  → return 401 ← ถ้าไม่ตรง (ไม่บอกว่า site ไหนผิด)
```

---

### 4.2 Check-out Flow

เหมือน check-in แต่เป็น LIFF page `/liff/checkout`
- เลือกชื่อ → เลือกไซต์ → ถ่ายรูป → submit
- ระบบ update `checkout_at` + `checkout_photo_url` ใน `shift_checkins` record ล่าสุดของ guard+site วันนั้น

### 4.3 Auto-calculated Fields เมื่อเช็คอิน

| Field | Logic |
|-------|-------|
| `shift_type` | ถ้าเช็คอิน 05:00–13:00 → `'day'`, ถ้า 17:00–01:00 → `'night'` (configurable per site) |
| `status` | เทียบ `checkin_at` กับ scheduled start time ของ site: ตรงเวลา / สาย / ฯลฯ |
| `late_minutes` | `checkin_at - scheduled_start` (ถ้า > 0) |
| `is_double_shift` | ตรวจว่า guard มี checkin อีก record ใน 24 ชม.ที่ผ่านมา |
| `checkin_within_site` | คำนวณ haversine distance ระหว่าง GPS กับ site location, เทียบกับ `geofence_radius_m` |

### 4.4 Photo Routing (ส่งรูปไปกลุ่ม LINE ลูกค้าอัตโนมัติ)

แต่ละ site มี `photo_routing` config (JSON field):

```json
{
  "checkin": {
    "send_to_client_group": true,
    "client_line_group_id": "C_xxxxx",
    "include_guard_name": true,
    "include_timestamp": true,
    "include_status": true,
    "include_replacement_info": true
  },
  "checkout": {
    "send_to_client_group": true,
    "client_line_group_id": "C_xxxxx"
  }
}
```

**เมื่อ check-in สำเร็จ + site มี routing config:**
- สร้าง LINE Flex Message พร้อม: รูปเช็คอิน, ชื่อ รปภ, เวลา, สถานะ (ตรงเวลา/สาย), ข้อมูลแทนกะ (ถ้ามี)
- Push ไปยังกลุ่ม LINE ลูกค้าตาม `client_line_group_id`

**รปภ ถ่ายรูปครั้งเดียว → ระบบส่งให้ลูกค้าเอง — ไม่ต้องถ่ายรูปลงกลุ่มซ้ำอีก**

### 4.5 Replacement Handling

ถ้า guard B เลือกไซต์ที่ปกติ guard A ประจำอยู่ (และ guard A มี leave request approved วันนั้น):
- ระบบแสดง prompt: "วันนี้กะนี้ตารางเป็นของ [ชื่อ A] — คุณเข้าแทนใช่ไหม?"
- ถ้าใช่ → บันทึก `replacement_for_guard_id = A`
- รูปที่ส่งไปกลุ่มลูกค้าจะแสดง: "สมศักดิ์ (แทน สมชาย)"

---

## 5. Module B: Leave & Absence Management

### 5.1 Flow: รปภ ขอลาผ่าน LINE Chat → AI สร้าง Ticket

**Entry point:** รปภ พิมพ์ข้อความขอลาใน LINE OA chat (ไม่ต้องเปิด LIFF)

**ตัวอย่าง:**
```
รปภ: "พรุ่งนี้ขอลาป่วยครับ ไม่สบาย"
รปภ: "ขอลา 20-22 เมษา ลากิจครับ ไปงานบวช"
รปภ: "วันนี้ไม่สบายมากครับ ขอลาด่วน"
```

**AI Processing (Claude API):**

Claude API รับข้อความ + context (guard profile, leave history, site schedule) แล้ว:
1. **Extract entities:** ประเภทลา, วันที่เริ่ม, วันที่สิ้นสุด, จำนวนวัน, เหตุผล
2. **Create ticket:** Insert `leave_requests` record พร้อม status `'pending'`
3. **Reply to รปภ:** ยืนยันว่ารับเรื่องแล้ว พร้อมสรุปรายละเอียด
4. **Notify admin:** Push message ไป LINE ของ Suwijak พร้อม quick reply [อนุมัติ ✅] [ไม่อนุมัติ ❌]

**Claude API System Prompt สำหรับ Leave Module:**

```
คุณเป็นระบบจัดการขอลาของบริษัท สาครการ์ด
รับข้อความจาก รปภ แล้ววิเคราะห์ว่าเป็นการขอลาหรือไม่
ถ้าใช่ ให้ extract ข้อมูลออกมาเป็น JSON

ตอบเป็น JSON เท่านั้น:
{
  "is_leave_request": true/false,
  "leave_type": "sick" | "personal" | "annual" | "urgent",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "total_days": number,
  "reason": "string",
  "confidence": 0.0-1.0,
  "reply_message": "ข้อความตอบกลับ รปภ ภาษาไทย"
}

วันนี้คือ: {today}
รปภ: {guard_name} ({guard_id})
ไซต์ประจำ: {site_name}
วันลาเหลือ: ลาป่วย {sick_remaining} วัน, ลาพักร้อน {annual_remaining} วัน, ลากิจ {personal_remaining} วัน
```

### 5.2 Leave Ticket Management (Admin)

**Admin Dashboard `/admin/leave`:**
- แสดง leave tickets ทั้งหมด สถานะ: pending / approved / rejected
- Filter by: site, guard, status, date range
- กดเข้าดู ticket → เห็นรายละเอียด + ข้อความ original ที่ รปภ พิมพ์มา + AI interpretation
- กด [อนุมัติ] หรือ [ไม่อนุมัติ] + ใส่เหตุผล (optional)

**เมื่อ Admin อนุมัติ/ปฏิเสธ:**
- Update `leave_requests.status`
- ส่ง LINE Push กลับไปบอก รปภ: "✅ อนุมัติลาป่วยวันที่ 16 เม.ย. แล้วครับ" หรือ "❌ ไม่อนุมัติ เนื่องจาก..."

**Admin ยังสามารถ approve/reject ผ่าน LINE ได้เลย** (ผ่าน Quick Reply ที่ส่งมาตอน notify):

```
[System → LINE Push to Suwijak]

📋 คำขอลาใหม่ #LV-2569-0042
รปภ: สมชาย (G-001)
ไซต์: Kibun
ประเภท: ลาป่วย
วันที่: 16 เม.ย. 69 (1 วัน)
เหตุผล: ไม่สบาย
ข้อความต้นฉบับ: "พรุ่งนี้ขอลาป่วยครับ ไม่สบาย"

[อนุมัติ ✅] [ไม่อนุมัติ ❌]
```

### 5.3 Leave Types & Rules

| ประเภท | Key | สิทธิ์/ปี | หมายเหตุ |
|--------|-----|----------|---------|
| ลาป่วย | `sick` | 30 วัน | > 3 วันต่อเนื่อง → ต้องมีใบรับรองแพทย์ |
| ลาพักร้อน | `annual` | 6 วัน (หลังทำงานครบ 1 ปี) | ต้องขอล่วงหน้า ≥ 3 วัน |
| ลากิจ | `personal` | 3 วัน | ต้องขอล่วงหน้า ≥ 1 วัน |
| ลาด่วน | `urgent` | นับรวมลากิจ | ไม่ต้องขอล่วงหน้า แต่ต้องแจ้งโดยเร็ว |
| ขาดงาน (ไม่แจ้ง) | `absent_no_notice` | — | Admin สร้าง record เอง (ไม่ใช่ รปภ ขอ) |

---

## 6. Module C: Workforce Lifecycle

### 6.1 Guard Onboarding (เริ่มงานใหม่)

**Admin สร้าง guard ใน `/admin/guards/new`:**
- กรอก: ชื่อ, ชื่อเล่น, เบอร์โทร, รหัสพนักงาน, ไซต์ประจำ, ตำแหน่ง, วันเริ่มงาน
- อัปโหลดรูปโปรไฟล์ (ใช้เทียบกับรูปเช็คอิน)
- กำหนด whitelist sites (`guard_site_assignments`)
- ระบบส่ง LINE notify ไปหัวหน้าชุดไซต์นั้น: "🆕 รปภ ใหม่: สมชาย เริ่มงาน 1 พ.ค."

### 6.2 LINE Account Mapping

**line_mappings ใช้สำหรับ 2 จุดหลัก:**
1. ระบุตัวตน รปภ เมื่อพิมพ์ข้อความใน LINE OA (ขอลา, ถามข้อมูล, snooze)
2. **ควบคุม LIFF check-in** — verified = true → ใช้ Path A (ไม่ต้องใส่ password)

**3 วิธีสร้าง mapping:**

**วิธี A: Auto-create จาก LIFF check-in (Path B)**
รปภ ใส่ site password + เลือกชื่อ + เช็คอินสำเร็จ
→ ระบบสร้าง `line_mappings` record อัตโนมัติ (is_verified = false)
→ Admin เห็นใน `/admin/line-mapping` → กด [Approve] → is_verified = true

**วิธี B: รปภ ส่งข้อความ "ลงทะเบียน" ใน LINE OA**
→ ระบบรับ LINE userId → สร้าง pending record
→ Admin เลือก guard ที่ตรงใน `/admin/line-mapping` → กด [Map + Approve]

**วิธี C: Admin ส่ง registration link ให้ รปภ โดยตรง**
→ Admin สร้าง unique token สำหรับ guard คนนั้น
→ รปภ กด link → LIFF เปิด → จับ LINE userId → auto-map + is_verified = true

**Admin UI `/admin/line-mapping`:**

| Column | Description |
|--------|-------------|
| LINE display name | ชื่อที่แสดงใน LINE |
| LINE userId | Uxxxxx |
| Guard | ชื่อ guard ที่ map (หรือ "รอเลือก") |
| Site | site ที่เช็คอินมา (Path B) |
| วิธีที่มา | auto_checkin / line_message / admin_link |
| สถานะ | 🟡 Pending / ✅ Verified |
| Action | [Approve] [Reject] [เปลี่ยน guard] |

**เมื่อ Admin กด Approve:**
- `line_mappings.is_verified = true`
- `line_mappings.mapped_by = admin_id`
- LINE push แจ้ง รปภ: "✅ ลงทะเบียนเรียบร้อยแล้วครับ ครั้งถัดไปไม่ต้องใส่รหัสผ่านอีก"

**fields เพิ่มใน `line_mappings` table:**
```sql
site_id        UUID REFERENCES sites(id),  -- site ที่ใช้ password ตรง (Path B)
mapping_method VARCHAR(20),                -- 'auto_checkin' | 'line_message' | 'admin_link'
```

### 6.3 Resignation

**2 ช่องทาง:**

1. **รปภ พิมพ์ใน LINE:** "ขอลาออกครับ สิ้นเดือนนี้" → AI classify → สร้าง ticket แจ้ง admin
2. **Admin บันทึกเอง** ใน dashboard

**เมื่อ resignation ถูกบันทึก:**
- Update `guards.employment_status = 'resigned'`
- Update `guards.resignation_date` + `guards.resignation_reason`
- สร้าง P2 alert → notify Suwijak
- Trigger headcount check → ถ้าไซต์ขาดคน → P1 alert

### 6.4 Guard Profile

**`/admin/guards/[id]` แสดง:**
- ข้อมูลส่วนตัว + รูปโปรไฟล์
- ไซต์ประจำ + whitelist sites
- สถิติ 90 วัน: เข้ากะตรงเวลา%, มาสาย (ครั้ง + เฉลี่ย), ขาด, ควงกะ
- Photo timeline: รูปเช็คอิน 30 วันล่าสุด (เทียบกับรูปโปรไฟล์)
- Leave balance: วันลาเหลือแต่ละประเภท
- Guard Score (0–100)
- ประวัติ warnings + complaints (จาก complaint system อื่นที่จะ integrate ทีหลัง)

---

## 7. Module D: AI Alert Engine

### 7.1 หลักการ

**AI (Claude API) ทำหน้าที่ตรวจ condition แทนคน** — ไม่ใช่แค่ if/else ง่ายๆ แต่เข้าใจ context เช่น:
- "รปภ คนนี้ปกติมาตรงเวลาทุกวัน วันนี้สาย 30 นาทียังไม่แจ้ง → น่าเป็นห่วง → P1"
- "รปภ คนนี้มาสายวันจันทร์ทุกสัปดาห์ → pattern → แจ้ง admin"
- "มีคนขอลา 3 คนพร้อมกันจากไซต์เดียว → site จะขาดคน → P1"

### 7.2 Alert Types & Triggers

| Alert Type | Trigger | Severity | ใคร trigger | AI ช่วยอย่างไร |
|-----------|---------|----------|------------|---------------|
| **No-show** | ไม่มี check-in ภายใน 15 นาทีหลังเริ่มกะ | P1 | Cron job (ทุก 15 นาที) | AI ดู context: มีขอลาไว้ไหม? มีแจ้งมาสายไหม? เคย no-show บ่อยไหม? |
| **Late (สาย)** | check-in หลัง scheduled start > 5 นาที | P2 (>5 นาที), P1 (>30 นาที) | Realtime (เมื่อ check-in) | auto-calculate |
| **Multi-shift (ควงกะ)** | guard มี checkin ครั้งที่ 2+ โดยยังไม่ครบ rest period | P2 (กะ 2) / P1 (กะ 3+) | Realtime (เมื่อ check-in) | คำนวณ consecutive_shifts + consecutive_hours อัตโนมัติ |
| **Leave — no replacement** | Leave approved แต่ไม่มีคนแทน ภายใน 4 ชม.ก่อนกะ | P1 | Cron job | AI suggest ว่าใครว่างเข้าแทนได้ |
| **Pattern — frequent late** | มาสาย ≥ 3 ครั้งใน 30 วัน | P2 | Cron job (รายวัน) | AI ดู pattern: สายวันไหนบ่อย? กะไหน? trend ดีขึ้นหรือแย่ลง? |
| **Pattern — frequent absent** | ขาดงาน ≥ 2 ครั้งใน 30 วัน | P1 | Realtime (ครั้งที่ 2) | AI recommend: ออกใบเตือน? ย้ายไซต์? |
| **Site understaffed** | จำนวน active guards < required headcount | P1 | Realtime (เมื่อมีคนลาออก/ขอลา) | AI คำนวณ shortage + suggest solution |
| **Resignation** | guard ลาออก | P2 | Realtime | auto-alert |
| **New hire** | guard ใหม่เข้าระบบ | Info | Realtime | notify หัวหน้าชุด |

### 7.3 AI Alert Processing (Claude API)

**Cron job ทุก 15 นาที → รวบรวม events → ส่ง batch ให้ Claude วิเคราะห์:**

```
Claude API System Prompt:

คุณเป็นระบบตรวจสอบกำลังพลของบริษัท สาครการ์ด
วิเคราะห์ events ที่เกิดขึ้นและสร้าง alerts ตามความเหมาะสม

Context:
- วันที่/เวลาปัจจุบัน: {now}
- จำนวนไซต์: {total_sites}
- จำนวน รปภ active: {total_guards}

Events ที่ต้องวิเคราะห์:
{events_json}

Guard history (90 วัน) ของคนที่เกี่ยวข้อง:
{guard_stats_json}

ตอบเป็น JSON array ของ alerts:
[
  {
    "type": "no_show" | "late" | "double_shift" | "pattern_late" | "pattern_absent" | "leave_no_replacement" | "site_understaffed",
    "severity": "P1" | "P2" | "P3",
    "guard_id": "xxx",
    "site_id": "xxx",
    "message_th": "ข้อความแจ้งเตือนภาษาไทย สั้นกระชับ",
    "recommendation": "คำแนะนำว่าควรทำอะไร",
    "notify_to": ["admin", "shift_leader_site_xxx"]
  }
]

ถ้าไม่มี alert → ตอบ []
```

### 7.4 Alert Notification

เมื่อ AI สร้าง alert:
1. **Insert `manpower_alerts` table**
2. **LINE Push** ไปยังผู้รับตาม `notify_to`
3. **Dashboard** แสดง alert badge + list

**LINE Alert Message Format:**

```
🚨 [P1] ไม่เข้ากะ
👤 สมชาย (G-001)
📍 Kibun — กะเช้า 07:00
⏰ ผ่านไป 15 นาที ยังไม่เช็คอิน
💡 แนะนำ: ติดต่อสมชาย / หาคนแทนด่วน

[ดูรายละเอียด] ← deep link ไป admin
[รับทราบ ✅]
```

### 7.5 Weekly Digest

**Cron: ทุกวันจันทร์ 07:00 → Claude API สรุปรายสัปดาห์:**

Input: ข้อมูล shift_checkins + leave_requests + alerts ทั้งสัปดาห์
Output: สรุปภาษาไทย สั้นกระชับ + highlight ปัญหา + recommendation

**ส่งผ่าน LINE Push ไป Suwijak:**

```
📋 สรุปกำลังพล สัปดาห์ 7–13 เม.ย. 69

👥 กำลังพลรวม: 65 คน
✅ เข้ากะตรงเวลา: 89.2%
⚠️ มาสาย: 14 ครั้ง (8 คน)
🔴 ขาดงาน: 3 ครั้ง (2 คน)
🔄 ควงกะ: 2 ครั้ง
📝 ลางาน: 5 ครั้ง

🚨 ต้องดำเนินการ:
- สมชาย: มาสาย 4 ครั้ง/เดือน → ใกล้เกณฑ์เตือน
- ไซต์ Siam Clothing: ขาดคน 1 ตำแหน่ง

[ดูรายละเอียด]
```

---

## 8. Database Schema

### 8.1 Tables

```sql
-- =============================================
-- SITES
-- =============================================
CREATE TABLE sites (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(100) NOT NULL,
  short_name            VARCHAR(20) NOT NULL UNIQUE,
  address               TEXT,
  lat                   DECIMAL(10,7),
  lng                   DECIMAL(10,7),
  geofence_radius_m     INT DEFAULT 200,
  required_guards_day   INT NOT NULL DEFAULT 1,
  required_guards_night INT NOT NULL DEFAULT 1,
  shift_start_day       TIME DEFAULT '07:00',
  shift_start_night     TIME DEFAULT '19:00',
  has_shared_device     BOOLEAN DEFAULT false,
  client_contact_name   VARCHAR(100),
  client_contact_line   VARCHAR(50),
  photo_routing         JSONB DEFAULT '{}',
  leave_protocol        JSONB DEFAULT '{}',
  checkin_password_hash  VARCHAR(255),          -- bcrypt hash ของ 6-digit site password
  password_updated_at    TIMESTAMPTZ,           -- เวลาที่ generate password ล่าสุด
  -- leave_protocol schema:
  -- {
  --   "notify_client_on_leave": true,
  --     ← แจ้งลูกค้าทันทีเมื่ออนุมัติลา (แม้ยังไม่มีคนแทน)
  --   "notify_client_on_replacement": true,
  --     ← auto push LINE ลูกค้าเมื่อ admin set คนแทนแล้ว
  --   "client_line_group_id": "C_xxxxx",
  --     ← LINE group ID ของลูกค้า site นี้
  --   "replacement_notice_hours": 4,
  --     ← ต้องหาคนแทนล่วงหน้ากี่ชม.ก่อนกะเริ่ม (config per-site)
  --     ← null = ไม่บังคับ deadline ไม่มี reminder
  --     ← ตัวอย่าง: Siam Clothing=2, Kibun=4, อพาร์ทเมนต์=null
  --   "message_template": "เรียน{contact_name} วันที่ {date} {guard_name} ลา{leave_type} ผู้แทนคือ {replacement_name} จะเข้ากะเวลา {shift_time} ครับ"
  --     ← variables: {contact_name} {date} {guard_name} {leave_type} {replacement_name} {shift_time}
  -- }
  -- default {} → ไม่แจ้งลูกค้าอัตโนมัติ ไม่มี deadline
  is_active             BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- GUARDS
-- =============================================
CREATE TABLE guards (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code       VARCHAR(10) UNIQUE NOT NULL,
  full_name           VARCHAR(100) NOT NULL,
  nickname            VARCHAR(50),
  phone               VARCHAR(20),
  photo_url           VARCHAR(500),
  current_site_id     UUID REFERENCES sites(id),
  position            VARCHAR(20) DEFAULT 'guard',
  employment_status   VARCHAR(20) DEFAULT 'active',
  allow_any_site      BOOLEAN DEFAULT false,
  start_date          DATE NOT NULL,
  end_date            DATE,
  resignation_date    DATE,
  resignation_reason  TEXT,
  guard_score         INT DEFAULT 100,
  leave_balance       JSONB DEFAULT '{"sick": 30, "annual": 6, "personal": 3}',
  face_enrolled        BOOLEAN DEFAULT false,  -- ลงทะเบียน CompreFace แล้วหรือยัง
  face_enrolled_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- GUARD ↔ SITE WHITELIST
-- =============================================
CREATE TABLE guard_site_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_id    UUID NOT NULL REFERENCES guards(id) ON DELETE CASCADE,
  site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  is_primary  BOOLEAN DEFAULT false,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(guard_id, site_id)
);

-- =============================================
-- LINE MAPPING
-- =============================================
CREATE TABLE line_mappings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id    VARCHAR(50) UNIQUE NOT NULL,
  guard_id        UUID REFERENCES guards(id),
  display_name    VARCHAR(100),
  mapped_by       UUID,                          -- admin ที่ approve
  is_verified     BOOLEAN DEFAULT false,
  site_id         UUID REFERENCES sites(id),     -- site ที่ใช้ password (Path B)
  mapping_method  VARCHAR(20) DEFAULT 'auto_checkin',
  -- 'auto_checkin' = สร้างจาก LIFF Path B
  -- 'line_message' = รปภ ส่ง "ลงทะเบียน" ใน LINE
  -- 'admin_link'   = admin ส่ง unique link ให้
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SHIFT CHECK-INS (standalone — ไม่ต้องมี schedule ก่อน)
-- =============================================
CREATE TABLE shift_checkins (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_id                  UUID NOT NULL REFERENCES guards(id),
  site_id                   UUID NOT NULL REFERENCES sites(id),
  
  -- Check-in
  checkin_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checkin_photo_url         VARCHAR(500) NOT NULL,
  checkin_lat               DECIMAL(10,7),
  checkin_lng               DECIMAL(10,7),
  checkin_within_site       BOOLEAN,
  device_info               TEXT,
  
  -- Check-out
  checkout_at               TIMESTAMPTZ,
  checkout_photo_url        VARCHAR(500),
  
  -- Auto-calculated
  shift_type                VARCHAR(10),
  status                    VARCHAR(20) DEFAULT 'on_time',
  late_minutes              INT DEFAULT 0,
  consecutive_shifts        INT DEFAULT 0,         -- จำนวนกะที่ควงต่อเนื่อง (0=ปกติ, 1=ควง2กะ, 2=ควง3กะ ฯลฯ)
  consecutive_hours         INT DEFAULT 0,         -- ชม.สะสมที่ทำงานต่อเนื่อง (คำนวณจาก checkin ก่อนหน้า)
  is_double_shift           BOOLEAN DEFAULT false, -- deprecated: ใช้ consecutive_shifts แทน (คงไว้เพื่อ backward compat)
  
  -- Replacement
  replacement_for_guard_id  UUID REFERENCES guards(id),
  
  notes                     TEXT,

  -- Face verification (CompreFace v2.0)
  face_similarity      DECIMAL(4,3),          -- 0.000–1.000
  face_verified        BOOLEAN,               -- null=pending, true=match, false=mismatch
  face_verified_by     VARCHAR(10),           -- 'system' | 'admin' | null
  face_verified_at     TIMESTAMPTZ,
  face_review_note     TEXT,                  -- admin note ถ้า override

  created_at                TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- LEAVE REQUESTS (ticket system)
-- =============================================
CREATE TABLE leave_requests (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number           VARCHAR(20) UNIQUE NOT NULL,
  guard_id                UUID NOT NULL REFERENCES guards(id),
  site_id                 UUID NOT NULL REFERENCES sites(id),
  leave_type              VARCHAR(20) NOT NULL,
  start_date              DATE NOT NULL,
  end_date                DATE NOT NULL,
  total_days              INT NOT NULL,
  reason                  TEXT,
  original_message        TEXT,
  ai_interpretation       JSONB,
  document_url            VARCHAR(500),
  
  status                  VARCHAR(20) DEFAULT 'pending',
  reviewed_by             UUID,
  reviewed_at             TIMESTAMPTZ,
  review_note             TEXT,
  
  replacement_guard_id    UUID REFERENCES guards(id),
  replacement_confirmed   BOOLEAN DEFAULT false,
  replacement_set_at      TIMESTAMPTZ,              -- เวลาที่ admin ใส่คนแทน
  client_notified         BOOLEAN DEFAULT false,     -- ส่ง LINE แจ้งลูกค้าแล้วหรือยัง
  client_notified_at      TIMESTAMPTZ,              -- เวลาที่ส่ง LINE แจ้งลูกค้า
  
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- GUARD PHOTOS
-- =============================================
CREATE TABLE guard_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_id    UUID NOT NULL REFERENCES guards(id),
  photo_type  VARCHAR(20) NOT NULL,
  photo_url   VARCHAR(500) NOT NULL,
  taken_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lat         DECIMAL(10,7),
  lng         DECIMAL(10,7),
  device_info TEXT,
  checkin_id  UUID REFERENCES shift_checkins(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- MANPOWER ALERTS
-- =============================================
CREATE TABLE manpower_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            VARCHAR(30) NOT NULL,
  severity        VARCHAR(5) NOT NULL,
  site_id         UUID REFERENCES sites(id),
  guard_id        UUID REFERENCES guards(id),
  
  message         TEXT NOT NULL,
  recommendation  TEXT,
  ai_context      JSONB,
  
  notified_to     TEXT[],
  notified_via    VARCHAR(10) DEFAULT 'line',
  
  acknowledged    BOOLEAN DEFAULT false,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  resolution      VARCHAR(50),
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- AI CONVERSATION LOG
-- =============================================
CREATE TABLE conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id  VARCHAR(50),
  guard_id      UUID REFERENCES guards(id),
  message_text  TEXT NOT NULL,
  message_type  VARCHAR(20),
  
  ai_intent     VARCHAR(30),
  ai_confidence DECIMAL(3,2),
  ai_entities   JSONB,
  ai_response   TEXT,
  
  action_taken  VARCHAR(50),
  action_ref_id UUID,
  
  processing_ms INT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ADMIN USERS (BetterAuth)
-- =============================================
-- BetterAuth จัดการ table users/sessions เอง
-- เพิ่ม fields:
-- role: 'admin' | 'shift_leader' | 'patrol'
-- guard_id: link to guards (ถ้า shift_leader)
-- site_id: link to sites (ถ้า shift_leader)
```

### 8.2 Key Indexes

```sql
CREATE INDEX idx_guard_status ON guards(employment_status);
CREATE INDEX idx_guard_site ON guards(current_site_id);
CREATE INDEX idx_checkins_guard_date ON shift_checkins(guard_id, checkin_at);
CREATE INDEX idx_checkins_site_date ON shift_checkins(site_id, checkin_at);
CREATE INDEX idx_checkins_status ON shift_checkins(status) WHERE status != 'on_time';
CREATE INDEX idx_leave_guard ON leave_requests(guard_id, start_date);
CREATE INDEX idx_leave_status ON leave_requests(status) WHERE status = 'pending';
CREATE INDEX idx_alerts_unresolved ON manpower_alerts(created_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_line_mapping ON line_mappings(line_user_id);
CREATE INDEX idx_guard_photos_guard ON guard_photos(guard_id, taken_at);
CREATE INDEX idx_guard_site_assign ON guard_site_assignments(guard_id);
CREATE INDEX idx_secretary_pings_time ON secretary_pings(pinged_at DESC);
CREATE INDEX idx_checkins_face_review ON shift_checkins(face_verified) WHERE face_verified IS NULL OR face_verified = false;
```

### 8.3 Useful Views

```sql
-- รปภ ที่มาสายบ่อย (30 วัน)
CREATE VIEW v_frequent_late AS
SELECT 
  g.id, g.full_name, g.employee_code, s.name as site_name,
  COUNT(*) as late_count,
  ROUND(AVG(sc.late_minutes)) as avg_late_minutes
FROM shift_checkins sc
JOIN guards g ON g.id = sc.guard_id
JOIN sites s ON s.id = sc.site_id
WHERE sc.status = 'late'
  AND sc.checkin_at >= NOW() - INTERVAL '30 days'
GROUP BY g.id, g.full_name, g.employee_code, s.name
HAVING COUNT(*) >= 3;

-- สรุปกำลังพลรายสัปดาห์
CREATE VIEW v_weekly_summary AS
SELECT 
  DATE_TRUNC('week', sc.checkin_at) as week_start,
  COUNT(*) as total_checkins,
  COUNT(*) FILTER (WHERE sc.status = 'on_time') as on_time,
  COUNT(*) FILTER (WHERE sc.status = 'late') as late,
  COUNT(*) FILTER (WHERE sc.is_double_shift = true) as double_shifts,
  ROUND(
    COUNT(*) FILTER (WHERE sc.status = 'on_time')::DECIMAL / 
    NULLIF(COUNT(*), 0) * 100, 1
  ) as on_time_rate
FROM shift_checkins sc
WHERE sc.checkin_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('week', sc.checkin_at);
```

---

## 9. API Routes

```
/app
├── /api
│   ├── /line
│   │   └── /webhook              POST — LINE OA webhook (ข้อความ + postback)
│   │
│   ├── /ai
│   │   ├── /classify-leave       POST — Claude API: วิเคราะห์ข้อความขอลา
│   │   ├── /check-alerts         POST — Claude API: ตรวจ conditions + สร้าง alerts
│   │   └── /weekly-digest        POST — Claude API: สรุปรายสัปดาห์
│   │
│   ├── /checkin
│   │   ├── /prepare              GET  — autocomplete ชื่อ รปภ (?search=xxx)
│   │   ├── /sites                GET  — dropdown ไซต์ (?guardId=xxx)
│   │   └── /                     POST — บันทึกเช็คอิน (photo + guard + site + GPS)
│   │
│   ├── /checkout
│   │   └── /                     POST — บันทึกเช็คเอาท์
│   │
│   ├── /guards
│   │   ├── /                     GET/POST — list + create guards
│   │   ├── /[id]                 GET/PUT  — guard detail + update
│   │   ├── /[id]/stats           GET  — attendance stats 90 วัน
│   │   ├── /[id]/photos          GET  — photo history
│   │   └── /[id]/leave-balance   GET  — วันลาเหลือ
│   │
│   ├── /sites
│   │   ├── /                     GET/POST — list + create sites
│   │   ├── /[id]                 GET/PUT  — site detail + update routing config
│   │   ├── /[id]/assignments     GET/POST — manage guard whitelist
│   │   └── /[id]/generate-password POST  — generate new 6-digit site password → return plaintext once
│   │
│   ├── /leave
│   │   ├── /                     GET/POST — list + create leave requests
│   │   ├── /[id]/review          POST — approve/reject
│   │   └── /[id]/replacement     POST — set replacement guard → auto notify client if protocol set
│   │
│   ├── /alerts
│   │   ├── /                     GET  — list alerts (filter: unresolved, by type, by site)
│   │   └── /[id]/acknowledge     POST — mark acknowledged
│   │
│   ├── /line-mapping
│   │   ├── /                     GET  — list all mappings
│   │   ├── /pending              GET  — unmapped/unverified LINE users
│   │   ├── /map                  POST — map LINE userId to guard + approve
│   │   └── /approve/[id]         POST — approve pending mapping
│   │
│   ├── /checkin
│   │   ├── /identity             GET  — ตรวจ LINE userId → verified หรือไม่
│   │   ├── /verify-site-password POST — ตรวจ site password → return site_id
│   │
│   ├── /guards
│   │   ├── /[id]/enroll-face     POST — upload profile photo to CompreFace (enrollment)
│   │   └── /[id]/face-review     POST — admin override face verification result
│   │
│   ├── /secretary
│   │   ├── /ping                 POST — trigger check + ping admin ถ้ามี items + ยังไม่ cooldown
│   │   └── /snooze               POST — Suwijak reply → set snoozed_until
│   │
│   └── /cron
│       ├── /no-show-check        — ทุก 15 นาที ช่วงเปลี่ยนกะ
│       ├── /secretary-briefing   — ทุกวัน 07:00 morning briefing
│       ├── /daily-pattern        — ทุกวัน 08:00 ตรวจ pattern
│       └── /weekly-digest        — ทุกวันจันทร์ 07:00
│
├── /liff
│   ├── /checkin                  — LIFF เช็คอิน (ชื่อ + ไซต์ + ถ่ายรูป)
│   ├── /checkout                 — LIFF เช็คเอาท์
│   └── /leave                    — LIFF ขอลา (alternative สำหรับคนไม่อยากพิมพ์)
│
├── /admin
│   ├── /dashboard                — overview: alerts, today's shifts, stats
│   ├── /checkins                 — วันนี้: รูปเช็คอิน + identity verification
│   ├── /guards                   — guard list
│   ├── /guards/new               — สร้าง guard ใหม่
│   ├── /guards/[id]              — guard profile + photo timeline + stats
│   ├── /sites                    — site list + config
│   ├── /sites/[id]               — site detail + photo routing + guard assignments
│   ├── /leave                    — leave tickets (pending / approved / rejected)
│   ├── /alerts                   — alert center
│   ├── /line-mapping             — map LINE accounts to guards
│   └── /reports                  — weekly / monthly summary
│
└── /auth
    ├── /login                    — BetterAuth admin login
    └── /...                      — BetterAuth routes
```

---

## 10. LINE OA Configuration

### 10.1 Rich Menu — 2 ชุด

**ชุด A: สำหรับ รปภ**

| ปุ่ม | Action | ไปที่ |
|------|--------|------|
| 📸 เช็คอิน | Open LIFF | `/liff/checkin` |
| 📸 เช็คเอาท์ | Open LIFF | `/liff/checkout` |
| 📝 ขอลา | Open LIFF | `/liff/leave` |
| 📋 ตารางกะ | Open LIFF | `/liff/schedule` (Phase 2) |
| 🚨 แจ้งเหตุ | Open LIFF | `/liff/incident` (Phase 2) |
| ❓ ช่วยเหลือ | Send message | ระบบ AI ตอบ |

**ชุด B: สำหรับ Admin / หัวหน้าชุด**

| ปุ่ม | Action | ไปที่ |
|------|--------|------|
| 📊 Dashboard | Open URL | `/admin/dashboard` |
| ⚠️ Alerts | Open URL | `/admin/alerts` |
| 👥 เช็คอินวันนี้ | Open URL | `/admin/checkins` |
| ✅ อนุมัติลา | Open URL | `/admin/leave?status=pending` |
| 📋 รายงาน | Open URL | `/admin/reports` |
| ⚙️ ตั้งค่า | Open URL | `/admin/sites` |

**Switch Rich Menu ตาม user tag:** LINE OA API → tag users เป็น "guard" หรือ "admin" → link rich menu ตาม tag

### 10.2 Webhook Events ที่ต้อง handle

| Event | Action |
|-------|--------|
| `message.text` | → ตรวจว่าเป็น ลงทะเบียน / ขอลา / คำถาม → route ตาม intent |
| `postback` | → handle quick reply buttons (อนุมัติลา, รับทราบ alert ฯลฯ) |
| `follow` | → รับ LINE userId ใหม่ → สร้าง pending mapping |
| `unfollow` | → log ว่า unfollow |

### 10.3 LIFF Apps ที่ต้องสร้าง

| LIFF ID | Path | ขนาด | ใช้สำหรับ |
|---------|------|------|---------|
| LIFF-checkin | `/liff/checkin` | Full | เช็คอิน |
| LIFF-checkout | `/liff/checkout` | Full | เช็คเอาท์ |
| LIFF-leave | `/liff/leave` | Tall | ขอลา (form) |

---

## 11. AI Integration Details

### 11.1 Claude API Usage (หลัง 2-Layer Routing)

| Function | Model | Max tokens | เมื่อไหร่ | ความถี่จริง |
|----------|-------|-----------|----------|-------------|
| Leave intent classification | claude-sonnet-4-20250514 | 500 | ผ่าน Layer 1 match แล้วเท่านั้น | ~10–20 ครั้ง/วัน |
| Alert condition check | claude-sonnet-4-20250514 | 1000 | Cron ทุก 15 นาที (เฉพาะเมื่อมี events) | ~3–8 ครั้ง/วัน |
| Daily pattern detection | claude-sonnet-4-20250514 | 1000 | Cron ทุกวัน 08:00 | 1 ครั้ง/วัน |
| Weekly digest | claude-sonnet-4-20250514 | 2000 | Cron ทุกวันจันทร์ 07:00 | 1 ครั้ง/สัปดาห์ |
| Cross-check (ใหม่) | claude-sonnet-4-20250514 | 1000 | Cron 06:30 + 18:30 ทุกวัน | 2 ครั้ง/วัน |
| Secretary briefing (ใหม่) | claude-sonnet-4-20250514 | 800 | Cron ทุกวัน 07:00 + realtime ping | 1–5 ครั้ง/วัน |

**Estimated cost: ~100–300 บาท/เดือน** (ลดลงจาก v1.0 ด้วย Layer 1 + caching)

---

### 11A. 2-Layer AI Routing (ใหม่ใน v2.0)

**หลักการ:** ไม่ส่งทุก message เข้า Claude — ใช้ rule-based routing ก่อนเสมอ

#### Layer 1 — Keyword + Fuzzy Match (`lib/ai.ts` → `routeMessage()`)

**ทำงานใน <1ms, ฟรี, deterministic — ห้ามใช้ AI ใน Layer 1 เด็ดขาด**

```typescript
// lib/ai.ts

const KEYWORDS = {
  LEAVE_HIGH: [
    'ขอลา', 'ลาป่วย', 'ลากิจ', 'ลาพักร้อน', 'ลาด่วน',
    'ไม่สบาย', 'ป่วย', 'ไม่มา', 'หยุด', 'วันหยุด',
    'ไม่ไหว', 'ไม่ได้มา', 'หยุดงาน'
  ],
  LEAVE_MEDIUM: [
    'ไม่ว่าง', 'ติดธุระ', 'ท้องเสีย', 'ไปไม่ได้',
    'พักก่อน', 'ไม่สะดวก', 'ธุระด่วน', 'ขอหยุด', 'หยุดวันนี้'
  ],
  LATE_NOTICE: [
    'สาย', 'ไปไม่ทัน', 'รถติด', 'ออกจากบ้าน',
    'กำลังเดินทาง', 'ช้า', 'ช้านิดหน่อย', 'ไม่ทัน'
  ],
  RESIGNATION: [
    'ลาออก', 'ออกจากงาน', 'ไม่ทำแล้ว',
    'ขอลาออก', 'เลิกทำ', 'ออกแล้ว', 'ไม่อยู่แล้ว'
  ],
  QUESTION: [
    'ตาราง', 'กะ', 'เหลือกี่วัน', 'วันลา', 'เช็คอิน', 'วันหยุด'
  ],
  SECRETARY_SNOOZE: [
    'โอเค', 'ok', 'รับทราบ', 'เดี๋ยวจัดการ', 'ไม่ต้องเตือน', 'ทราบแล้ว', 'โอเคครับ', 'okครับ'
  ]
}

// Fuzzy match threshold ตามความยาวคำ
function getThreshold(keyword: string): number {
  const len = keyword.length
  if (len <= 3) return 1   // คำสั้น: ผิดได้ 1 ตัว
  if (len <= 6) return 2   // คำกลาง: ผิดได้ 2 ตัว
  return 2                 // คำยาว: ผิดได้ 2 ตัว
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[a.length][b.length]
}

function fuzzyIncludes(text: string, keywords: string[]): boolean {
  return keywords.some(kw =>
    text.includes(kw) ||                              // exact match
    levenshtein(text, kw) <= getThreshold(kw) ||     // full fuzzy
    (text.length > kw.length &&                       // substring fuzzy
      [...Array(text.length - kw.length + 1)].some((_, i) =>
        levenshtein(text.slice(i, i + kw.length), kw) <= getThreshold(kw)
      ))
  )
}

export type RouteResult =
  | 'LEAVE_REQUEST'
  | 'LATE_NOTICE'
  | 'RESIGNATION'
  | 'QUESTION'
  | 'SECRETARY_SNOOZE'
  | 'IGNORE'

export function routeMessage(text: string): RouteResult {
  if (fuzzyIncludes(text, KEYWORDS.SECRETARY_SNOOZE)) return 'SECRETARY_SNOOZE'
  if (fuzzyIncludes(text, KEYWORDS.RESIGNATION))  return 'RESIGNATION'
  if (fuzzyIncludes(text, KEYWORDS.LATE_NOTICE))  return 'LATE_NOTICE'
  if (fuzzyIncludes(text, KEYWORDS.LEAVE_HIGH))   return 'LEAVE_REQUEST'
  if (fuzzyIncludes(text, KEYWORDS.LEAVE_MEDIUM)) return 'LEAVE_REQUEST'
  if (fuzzyIncludes(text, KEYWORDS.QUESTION))     return 'QUESTION'
  return 'IGNORE'
}
```

**เมื่อ IGNORE (ไม่ match):** reply escape hatch message

```
"ขอโทษครับ ไม่แน่ใจว่าต้องการอะไร ลองใช้เมนูด้านล่างนะครับ

📋 เมนูด่วน:
• พิมพ์ 'ขอลา' — แจ้งลางาน
• พิมพ์ 'สาย' — แจ้งมาสาย
• พิมพ์ 'วันลา' — เช็คสิทธิ์คงเหลือ
หรือกดปุ่มในเมนูด้านล่างครับ"
```

#### Layer 2 — Claude API (เฉพาะที่ผ่าน Layer 1 แล้ว)

ส่ง `routeResult` เป็น hint ให้ Claude เพื่อลด ambiguity:

```typescript
// api/ai/classify-intent/route.ts

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 500,
  system: [
    {
      type: 'text',
      text: MASTER_INTENT_CLASSIFIER_PROMPT,
      cache_control: { type: 'ephemeral' }   // ← Section 11B
    }
  ],
  messages: [{
    role: 'user',
    content: `Pre-classified by Layer 1 as: ${routeResult}
วันนี้: ${today} (${todayThai})
รปภ: ${guardName} (${employeeCode})
ไซต์: ${siteName}
สถานะเช็คอินวันนี้: ${todayCheckinStatus}
วันลาคงเหลือ: ป่วย ${sickRemaining} วัน, พักร้อน ${annualRemaining} วัน, กิจ ${personalRemaining} วัน

ข้อความ: "${messageText}"`
  }]
})
```

**กฎ routing priority (Layer 1):**
1. RESIGNATION ตรวจก่อนเสมอ (เพื่อไม่ให้ "ออกจากบ้าน" ถูก classify ผิด)
2. LATE_NOTICE ก่อน LEAVE (เพื่อไม่ให้ "ไปไม่ทัน" กลายเป็น leave)
3. LEAVE_HIGH → LEAVE_MEDIUM (confidence tier)
4. QUESTION สุดท้าย

---

### 11B. Prompt Caching (ใหม่ใน v2.0)

**ใช้กับทุก Claude call ที่มี system prompt คงที่ — ลด input token cost ~40%**

```typescript
// ✅ ทุก Claude call ต้องใช้ pattern นี้
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: ...,
  system: [
    {
      type: 'text',
      text: SYSTEM_PROMPT,                     // prompt คงที่ → cache
      cache_control: { type: 'ephemeral' }     // cache 5 นาที
    }
  ],
  messages: [{
    role: 'user',
    content: dynamicContextString              // เฉพาะส่วนที่เปลี่ยน
  }]
})

// ❌ ห้ามใช้ pattern นี้ (ไม่มี cache)
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  messages: [{ role: 'user', content: systemPrompt + dynamicContext }]
})
```

**Apply กับทุก function ใน Section 11.1:**

| Function | System prompt (cache) | Dynamic (ไม่ cache) |
|---|---|---|
| classify-intent | MASTER_INTENT_CLASSIFIER_PROMPT | guard context + message |
| check-alerts | ALERT_CONDITION_CHECKER_PROMPT | shift_data + leave_data |
| daily-pattern | DAILY_PATTERN_DETECTOR_PROMPT | guard_stats_30d |
| weekly-digest | WEEKLY_DIGEST_GENERATOR_PROMPT | weekly_data |
| cross-check | CROSS_CHECK_PROMPT | conversations + tickets |

---

### 11C. Leave Protocol — Site-level Notification (v2.0)

**หลักการ:** แต่ละ site ตั้งค่า protocol ของตัวเองได้อิสระ
ระบบจะ auto push LINE กลุ่มลูกค้าเฉพาะเมื่อ:
1. site มี `leave_protocol.notify_client_on_replacement = true`
2. มีการ set `replacement_guard_id` (ไม่ใช่ตอน approve)

**Trigger: `POST /api/leave/[id]/replacement`**

```typescript
// api/leave/[id]/replacement/route.ts

export async function POST(req, { params }) {
  const { replacementGuardId } = await req.json()
  const ticket = await db.leave_requests.findUnique({ where: { id: params.id } })
  const site = await db.sites.findUnique({ where: { id: ticket.site_id } })

  // 1. บันทึกคนแทนเสมอ ไม่ว่า site จะมี protocol หรือไม่
  await db.leave_requests.update({
    where: { id: params.id },
    data: {
      replacement_guard_id: replacementGuardId,
      replacement_confirmed: true,
      replacement_set_at: new Date()
    }
  })

  const protocol = site.leave_protocol ?? {}

  // 2. Auto push LINE ลูกค้าเฉพาะ site ที่ตั้ง protocol ไว้
  if (protocol.notify_client_on_replacement && protocol.client_line_group_id) {
    const replacement = await db.guards.findUnique({ where: { id: replacementGuardId } })
    const message = buildReplacementMessage(protocol.message_template, {
      contact_name: site.client_contact_name,
      date: formatDate(ticket.start_date),
      guard_name: ticket.guard.full_name,
      leave_type: ticket.leave_type,
      replacement_name: replacement.full_name,
      shift_time: site.shift_start_day
    })

    await lineClient.pushMessage(protocol.client_line_group_id, {
      type: 'text',
      text: message
    })

    await db.leave_requests.update({
      where: { id: params.id },
      data: { client_notified: true, client_notified_at: new Date() }
    })
  }

  return Response.json({ ok: true, client_notified: protocol.notify_client_on_replacement ?? false })
}
```

**Cron reminder สำหรับ leave ที่ยังไม่มีคนแทน:**

no-show-check cron ที่มีอยู่แล้ว ให้เพิ่ม check นี้ด้วย:

```typescript
// ใน no-show-check cron — เพิ่ม check replacement deadline
const pendingReplacement = await db.leave_requests.findMany({
  where: {
    status: 'approved',
    replacement_guard_id: null,
    start_date: { gte: today },
    site: { leave_protocol: { path: ['notify_client_on_replacement'], equals: true } }
  }
})

for (const ticket of pendingReplacement) {
  const protocol = ticket.site.leave_protocol
  const deadlineHours = protocol.replacement_notice_hours ?? 2
  const shiftStart = /* คำนวณจาก site.shift_start_day วันที่ ticket.start_date */
  const hoursRemaining = (shiftStart - Date.now()) / 3600000

  if (hoursRemaining <= deadlineHours) {
    // แจ้ง admin ว่ายังไม่มีคนแทน
    await lineClient.pushMessage(process.env.ADMIN_LINE_USER_ID, {
      type: 'text',
      text: `⚠️ ยังไม่มีคนแทน: ${ticket.guard.full_name} (${ticket.site.name})
` +
            `กะเริ่ม ${formatTime(shiftStart)} — เหลือ ${Math.round(hoursRemaining)} ชม.
` +
            `กรุณาเลือกคนแทนและแจ้งลูกค้าด้วยครับ`
    })
  }
}
```

**ตัวอย่าง leave_protocol config ของแต่ละ site:**

```json
// Siam Clothing — ต้องแจ้งทันที deadline เข้ม
{
  "notify_client_on_leave": true,
  "notify_client_on_replacement": true,
  "client_line_group_id": "C_siam_xxxxx",
  "replacement_notice_hours": 2,
  "message_template": "เรียนคุณพี่เจี๊ยบ วันที่ {date} {guard_name} ลา{leave_type} ผู้แทนคือ {replacement_name} จะเข้ากะเวลา {shift_time} ครับ"
}

// Kibun — แจ้งเหมือนกัน deadline ยืดหยุ่นกว่า
{
  "notify_client_on_leave": true,
  "notify_client_on_replacement": true,
  "client_line_group_id": "C_kibun_xxxxx",
  "replacement_notice_hours": 4,
  "message_template": "เรียนคุณพลอย วันที่ {date} {guard_name} ลา ผู้แทนคือ {replacement_name} เข้ากะ {shift_time} ครับ"
}

// อพาร์ทเมนต์ — ไม่ต้องแจ้งลูกค้า
{}
```

---


---

### 11D. Secretary Agent — งานค้าง & การแจ้งเตือนอัจฉริยะ (v2.0)

**แนวคิด:** Agent ทำหน้าที่เหมือนเลขาส่วนตัว — รู้ context ทั้งหมดในระบบ
แล้วตัดสินใจเองว่าอะไรสำคัญพอที่จะเตือน Suwijak และเรียงลำดับความเร่งด่วนให้

**ข้อตกลงสำคัญ:**
- Agent ไม่มี tool ไม่ action เอง — แจ้งแล้วรอ Suwijak ตัดสินใจเสมอ
- มี cooldown ป้องกัน notification flood: item เดิม ping ซ้ำได้ทุก 2 ชม. เท่านั้น
- Suwijak reply ใน LINE ได้เพื่อ snooze หรือ acknowledge item นั้น

---

#### สิ่งที่ Agent track

| แหล่งข้อมูล | condition ที่ track | threshold |
|---|---|---|
| `leave_requests` | status = 'pending' | > 2 ชม. ยังไม่ approve/reject |
| `leave_requests` | approved + replacement_guard_id = null | ≤ deadline_hours ก่อนกะ |
| `manpower_alerts` | acknowledged = false | P1 > 30 นาที, P2 > 2 ชม. |
| `conversations` | cross-check gap ที่ยังไม่ถูก action | > 1 ชม. หลัง cross-check report |
| `leave_requests` | client_notified = false + site มี protocol | > 30 นาทีหลัง set replacement |

---

#### Trigger 2 แบบ

**Scheduled — ทุกเช้า 07:00 (Morning Briefing)**

```
Path:     /api/cron/secretary-briefing
Schedule: "0 7 * * *"
```

Agent รวบรวมทุกอย่างแล้วส่ง briefing เดียว:

```
📋 สรุปงานค้าง — เช้า 3 เม.ย. 69

🔴 เร่งด่วน (ทำก่อน 10:00):
• Siam Clothing: ยังไม่มีคนแทนสมชาย
  กะเริ่ม 11:00 — เหลือ 3 ชม.

🟡 วันนี้:
• อนุมัติลา: สมศักดิ์ (G-002) ขอมา 6 ชม.แล้ว
• Alert ควงกะ Kibun ยังไม่ ack (P2)

⚪ รอได้:
• Cross-check เมื่อคืน: สมหญิง พิมพ์ "ไม่สบาย"
  ยังไม่มี ticket — ยืนยันกับสมหญิงด้วย

[ดู dashboard]
```

**Realtime Ping — เมื่อมี event ใหม่ที่ต้องการ attention**

```
Path:     /api/secretary/ping   (เรียกจาก modules อื่น)
Trigger:  หลัง approve leave แต่ไม่มี replacement ภายใน 30 นาที
          หลัง P1 alert สร้าง แต่ไม่ถูก ack ภายใน 30 นาที
          หลัง cross-check พบ gap แต่ผ่านไป 1 ชม.ยังไม่ action
```

Agent รวม pending items ทั้งหมดก่อน ping ไม่ส่ง message แยกต่อ event:

```typescript
// lib/secretary.ts

export async function pingIfNeeded() {
  const pending = await collectPendingItems()
  if (pending.length === 0) return

  // cooldown check: ถ้า ping ไปแล้วใน 2 ชม. → skip
  const lastPing = await getLastPingTime()
  if (lastPing && Date.now() - lastPing < 2 * 60 * 60 * 1000) return

  const briefing = await generateBriefing(pending)  // Claude call
  await lineClient.pushMessage(process.env.ADMIN_LINE_USER_ID, {
    type: 'text',
    text: briefing
  })
  await recordPingTime()
}
```

---

#### System Prompt สำหรับ Secretary Agent

```
คุณเป็นเลขาส่วนตัวของ Suwijak เจ้าของบริษัทรักษาความปลอดภัย สาครการ์ด
หน้าที่: สรุปงานค้างและเรียงลำดับความเร่งด่วนให้ชัดเจน

กฎการเรียงลำดับ:
- 🔴 เร่งด่วน: กระทบกะที่กำลังจะเริ่ม หรือ P1 alert ที่ยังไม่ได้ดู
- 🟡 วันนี้: ต้องทำวันนี้แต่ยังมีเวลา
- ⚪ รอได้: ไม่กระทบ operation ทันที แต่ควรรับทราบ

สไตล์การเขียน:
- กระชับ อ่านจบใน 30 วินาที
- ระบุชื่อคน + ไซต์ + เวลาที่เหลือเสมอ
- เสนอ action ชัดๆ ว่าควรทำอะไร
- ห้ามใช้ภาษาทางการหรือศัพท์เทคนิค
- ใช้ภาษาไทยทั้งหมด

ตอบเป็น plain text (ไม่ใช่ JSON) — นี่คือข้อความที่จะส่งทาง LINE โดยตรง
ถ้าไม่มีงานค้างให้ตอบว่า "✅ ไม่มีงานค้างครับ"
```

---

#### Suwijak Reply ใน LINE → Snooze / Acknowledge

รองรับ reply text สั้นๆ เพื่อไม่ให้ agent ping ซ้ำ:

| Suwijak พิมพ์ | ระบบทำ |
|---|---|
| "โอเค" / "ok" / "รับทราบ" | snooze ทุก items 2 ชม. |
| "เดี๋ยวจัดการ" | snooze 4 ชม. |
| "ไม่ต้องเตือนแล้ว [item]" | dismiss item นั้นถาวร |

Layer 1 routing จะ detect คำเหล่านี้และ route ไปยัง secretary handler แทน leave/late handler

---

#### DB Table ใหม่: `secretary_pings`

```sql
CREATE TABLE secretary_pings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pinged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  items_count   INT NOT NULL,
  items_summary JSONB,           -- snapshot ของ items ที่ ping
  snoozed_until TIMESTAMPTZ,     -- ถ้า Suwijak snooze
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### API Routes ใหม่

```
/api/secretary/
├── /ping        POST — trigger check + ping ถ้ามี items + ยังไม่ cooldown
└── /snooze      POST — Suwijak reply → set snoozed_until

/api/cron/
└── /secretary-briefing   GET — morning briefing ทุก 07:00
```



---

### 11E. CompreFace Face Verification (v2.0)

**แนวคิด:** ตรวจสอบ identity รปภ อัตโนมัติทุกครั้งที่เช็คอิน โดยเปรียบเทียบรูปที่ถ่ายสดกับรูปโปรไฟล์ใน DB
ลด manual review ของ admin ลงได้ ~80% เหลือแค่กรณีที่ uncertain

**Self-hosted บน Hetzner CX22** — รูปหน้า รปภ ไม่ออกนอก server ตัวเอง ปลอดภัยตาม PDPA

---

#### Infrastructure

```
Hetzner CX22 (~145 บาท/เดือน)
- 2 vCPU / 4GB RAM / 40GB SSD
- Location: Singapore (ใกล้ไทยสุด latency ~30–50ms)
- OS: Ubuntu 22.04 LTS

Docker Compose (5 containers):
├── compreface-core     ← neural network embedding
├── compreface-api      ← REST API
├── compreface-admin    ← management UI
├── compreface-ui       ← web dashboard
└── compreface-postgres ← database
```

**Setup คำสั่งหลัก:**

```bash
# บน Hetzner server
curl -fsSL https://get.docker.com | sh
git clone https://github.com/exadel-inc/CompreFace.git
cd CompreFace
docker compose up -d
# รอ ~30 วินาที → เข้า http://<server-ip>:8000
```

**Security: ไม่ expose port 8000 ออก internet โดยตรง**
ใช้ Nginx reverse proxy + ตั้ง firewall ให้รับเฉพาะ request จาก IP ของ Vercel functions

---

#### Enrollment Flow (ลงทะเบียนรูปโปรไฟล์ครั้งแรก)

ทำครั้งเดียวตอน onboard รปภ ใหม่ — admin upload รูปโปรไฟล์คุณภาพดีผ่าน `/admin/guards/new`

```
Admin upload profile photo
        │
        ▼
Next.js API: POST /api/guards/[id]/enroll-face
        │
        ▼
ดึงรูปจาก Supabase Storage
        │
        ▼
POST http://<hetzner-ip>/api/v1/recognition/faces
     ?subject={guard_id}
     body: multipart/form-data { file: photo }
        │
        ▼
CompreFace บันทึก face embedding ของ guard_id นี้
        │
        ▼
Update guards.face_enrolled = true
```

**กฎคุณภาพรูปโปรไฟล์สำหรับ enrollment:**
- รูปหน้าตรง ไม่บดบัง
- แสงสว่างพอ ไม่มืด
- ขนาด ≥ 300×300px
- ถ้า CompreFace detect face ไม่ได้ → reject + แจ้ง admin ให้ถ่ายใหม่

---

#### Verification Flow (ทุกครั้งที่เช็คอิน)

```
รปภ เช็คอิน → ถ่ายรูป → submit
        │
        ▼
Next.js API: POST /api/checkin
        │
        ├── บันทึก shift_checkins (เหมือนเดิม)
        │
        └── [async] ส่งรูปไป verify
                │
                ▼
        POST http://<hetzner-ip>/api/v1/verification/verify
             body: {
               source_image: checkin_photo,
               target_image: profile_photo_url
             }
                │
                ▼
        CompreFace response:
        { result: [{ similarity: 0.92, face_matches: true }] }
                │
        ┌───────┴───────────────────────────┐
        │       Similarity threshold        │
        │                                   │
        │  ≥ 0.85 → ✅ auto-verified        │
        │           verified_by = 'system'   │
        │           skip admin review        │
        │                                   │
        │  0.60–0.84 → ⚠️ uncertain         │
        │              flag for admin review │
        │              badge สีเหลืองใน UI  │
        │                                   │
        │  < 0.60 → 🚨 likely mismatch      │
        │           P1 alert → LINE admin    │
        │           badge สีแดงใน UI        │
        └───────────────────────────────────┘
                │
                ▼
        Update shift_checkins:
        - face_similarity: 0.92
        - face_verified: true/false/null
        - face_verified_by: 'system'/'admin'/null
        - face_verified_at: timestamp
```

**ทำแบบ async หลัง checkin response** — รปภ ไม่ต้องรอ verification ก่อนได้รับ success screen

---

#### DB Fields เพิ่มใน `shift_checkins`

```sql
-- เพิ่มหลัง checkout_photo_url
face_similarity      DECIMAL(4,3),          -- 0.000–1.000
face_verified        BOOLEAN,               -- null = pending, true = match, false = mismatch
face_verified_by     VARCHAR(10),           -- 'system' | 'admin' | null
face_verified_at     TIMESTAMPTZ,
face_review_note     TEXT                   -- admin note ถ้า override
```

#### DB Fields เพิ่มใน `guards`

```sql
face_enrolled        BOOLEAN DEFAULT false, -- ลงทะเบียน CompreFace แล้วหรือยัง
face_enrolled_at     TIMESTAMPTZ
```

---

#### Admin Dashboard ปรับ `/admin/checkins`

**เดิม:** admin ดูรูปเองแล้วกด [✓ ตรง] [✗ ไม่ตรง] ทุก record

**ใหม่ (v2.0):**
- Records ที่ `face_verified = true` (auto) → แสดง badge 🟢 System ✓ — ไม่ต้องดู
- Records ที่ `face_verified = null` (uncertain 0.60–0.84) → badge 🟡 Review — admin ดูและกด override
- Records ที่ `face_verified = false` (mismatch) → badge 🔴 Mismatch — admin ดูและตัดสินใจ
- Filter: "รอ review เท่านั้น" เพื่อกรองเฉพาะที่ต้องทำ

**Admin override:**
กด [✓ ยืนยันตรง] หรือ [✗ ยืนยันไม่ตรง] + optional note → update `face_verified_by = 'admin'`

---

#### Integration Code ใน Next.js

```typescript
// lib/compreface.ts

const COMPREFACE_URL = process.env.COMPREFACE_URL  // http://<hetzner-ip>
const COMPREFACE_API_KEY = process.env.COMPREFACE_API_KEY

export async function enrollFace(guardId: string, photoBuffer: Buffer): Promise<boolean> {
  const form = new FormData()
  form.append('file', new Blob([photoBuffer], { type: 'image/jpeg' }))

  const res = await fetch(
    `${COMPREFACE_URL}/api/v1/recognition/faces?subject=${guardId}`,
    {
      method: 'POST',
      headers: { 'x-api-key': COMPREFACE_API_KEY },
      body: form
    }
  )
  return res.ok
}

export async function verifyFace(
  checkinPhotoUrl: string,
  profilePhotoUrl: string
): Promise<{ similarity: number; verified: boolean }> {
  // ดึงรูปทั้งสองจาก Supabase Storage
  const [checkinBuf, profileBuf] = await Promise.all([
    fetch(checkinPhotoUrl).then(r => r.arrayBuffer()),
    fetch(profilePhotoUrl).then(r => r.arrayBuffer())
  ])

  const form = new FormData()
  form.append('source_image', new Blob([checkinBuf], { type: 'image/jpeg' }))
  form.append('target_image', new Blob([profileBuf], { type: 'image/jpeg' }))

  const res = await fetch(
    `${COMPREFACE_URL}/api/v1/verification/verify`,
    {
      method: 'POST',
      headers: { 'x-api-key': COMPREFACE_API_KEY },
      body: form
    }
  )

  const data = await res.json()
  const similarity = data.result?.[0]?.similarity ?? 0

  return {
    similarity,
    verified: similarity >= 0.85
  }
}

// Threshold helper
export function classifyVerification(similarity: number): 'auto_verified' | 'uncertain' | 'mismatch' {
  if (similarity >= 0.85) return 'auto_verified'
  if (similarity >= 0.60) return 'uncertain'
  return 'mismatch'
}
```

```typescript
// api/checkin/route.ts — เรียก verify แบบ async หลัง save

export async function POST(req: Request) {
  const { guardId, siteId, photoUrl, ... } = await req.json()

  // 1. บันทึก checkin ก่อน (ไม่รอ verify)
  const checkin = await db.shift_checkins.create({ ... })

  // 2. verify แบบ async — รปภ ได้รับ response ทันที
  verifyAndUpdateCheckin(checkin.id, guardId, photoUrl).catch(console.error)

  return Response.json({ ok: true, checkinId: checkin.id })
}

async function verifyAndUpdateCheckin(checkinId, guardId, checkinPhotoUrl) {
  const guard = await db.guards.findUnique({ where: { id: guardId } })
  if (!guard.face_enrolled || !guard.photo_url) return  // ยังไม่ enroll → skip

  const { similarity, verified } = await verifyFace(checkinPhotoUrl, guard.photo_url)
  const status = classifyVerification(similarity)

  await db.shift_checkins.update({
    where: { id: checkinId },
    data: {
      face_similarity: similarity,
      face_verified: verified,
      face_verified_by: 'system',
      face_verified_at: new Date()
    }
  })

  // P1 alert ถ้า mismatch ชัด
  if (status === 'mismatch') {
    await createAlert({
      type: 'FACE_MISMATCH',
      severity: 'P1',
      guardId,
      message: `รูปเช็คอินไม่ตรงกับโปรไฟล์ (similarity: ${(similarity * 100).toFixed(0)}%)`,
      recommendation: 'ตรวจสอบว่า รปภ คนนี้เช็คอินแทนคนอื่นหรือไม่'
    })
  }
}
```

---

#### Environment Variables เพิ่ม

```env
# CompreFace (Hetzner)
COMPREFACE_URL=http://<hetzner-server-ip>
COMPREFACE_API_KEY=<api-key-from-compreface-ui>
```

---

#### Cost Summary

| รายการ | ราคา/เดือน |
|---|---|
| Hetzner CX22 (CompreFace) | ~145 บาท |
| Per-verification cost | ฟรี (ไม่มี per-call) |
| Privacy | ✅ รูปไม่ออกนอก server |

เทียบ AWS Rekognition: 65 รปภ × 2 ครั้ง/วัน × 30 วัน = 3,900 calls/เดือน × $0.001 = $3.90 (~140 บาท) — ราคาใกล้กัน แต่ CompreFace ไม่มี per-call cost เมื่อ scale ขึ้น



---

### 11F. LINE Identity Binding — LIFF Check-in Security (v2.0)

**แนวคิด:** ก่อน LIFF แสดง UI ใดๆ ให้ตรวจ LINE userId ก่อนเสมอ
ป้องกันไม่ให้คนที่เปิด URL เห็นรายชื่อ รปภ ทั้งหมด

---

#### GET `/api/checkin/identity`

```typescript
// GET /api/checkin/identity?lineUserId=Uxxxxx

export async function GET(req: Request) {
  const lineUserId = new URL(req.url).searchParams.get('lineUserId')
  if (!lineUserId) return Response.json({ status: 'no_line_id' }, { status: 400 })

  const mapping = await db.line_mappings.findUnique({
    where: { line_user_id: lineUserId },
    include: { guard: { include: { guard_site_assignments: { include: { site: true } } } } }
  })

  if (!mapping || !mapping.is_verified) {
    return Response.json({ status: 'unverified' })
    // → LIFF แสดงหน้าใส่ site password (Path B)
  }

  return Response.json({
    status: 'verified',
    guard_id: mapping.guard_id,
    guard_name: mapping.guard.full_name,
    sites: mapping.guard.guard_site_assignments.map(a => ({
      id: a.site_id,
      name: a.site.name,
      is_primary: a.is_primary
    }))
    // → LIFF แสดง site dropdown + ชื่อตัวเอง (Path A)
  })
}
```

---

#### POST `/api/checkin/verify-site-password`

```typescript
// POST /api/checkin/verify-site-password
// body: { password: "847293", lineUserId: "Uxxxxx" }

export async function POST(req: Request) {
  const { password, lineUserId } = await req.json()

  // ค้นหา site ที่ password ตรง
  const sites = await db.sites.findMany({
    where: { is_active: true, checkin_password_hash: { not: null } }
  })

  let matchedSite = null
  for (const site of sites) {
    if (await bcrypt.compare(password, site.checkin_password_hash)) {
      matchedSite = site
      break
    }
  }

  if (!matchedSite) {
    return Response.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 401 })
    // ไม่บอกว่า site ไหนผิด — ป้องกัน enumeration
  }

  // ดึง guards ของ site นี้
  const guards = await db.guard_site_assignments.findMany({
    where: { site_id: matchedSite.id },
    include: { guard: { where: { employment_status: 'active' } } }
  })

  return Response.json({
    site_id: matchedSite.id,
    site_name: matchedSite.name,
    guards: guards.map(a => ({
      id: a.guard_id,
      full_name: a.guard.full_name,
      nickname: a.guard.nickname
    }))
  })
  // → LIFF แสดง dropdown เฉพาะ guards ของ site นี้
}
```

---

#### สร้าง Pending Mapping หลังเช็คอินสำเร็จ (Path B)

```typescript
// ใน POST /api/checkin หลัง insert shift_checkins สำเร็จ
// ถ้า checkin มาจาก Path B (มี lineUserId แต่ยังไม่ verified)

if (pathB && lineUserId && guardId && siteId) {
  const existing = await db.line_mappings.findUnique({
    where: { line_user_id: lineUserId }
  })

  if (!existing) {
    await db.line_mappings.create({
      data: {
        line_user_id: lineUserId,
        guard_id: guardId,
        site_id: siteId,
        display_name: lineDisplayName,
        is_verified: false,
        mapping_method: 'auto_checkin'
      }
    })

    // notify admin ใน LINE
    await lineClient.pushMessage(process.env.ADMIN_LINE_USER_ID, {
      type: 'text',
      text: `🔔 มีคำขอลงทะเบียนใหม่
` +
            `รปภ: ${guardName}
` +
            `ไซต์: ${siteName}
` +
            `LINE: ${lineDisplayName}
` +
            `กรุณา approve ที่ /admin/line-mapping`
    })
  }
  // ถ้ามีอยู่แล้ว (pending ซ้ำ) → ไม่สร้างใหม่ ไม่ error
}
```

---

#### POST `/api/sites/[id]/generate-password`

```typescript
export async function POST(req: Request, { params }: { params: { id: string } }) {
  // สุ่ม 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const hash = await bcrypt.hash(code, 10)

  await db.sites.update({
    where: { id: params.id },
    data: {
      checkin_password_hash: hash,
      password_updated_at: new Date()
    }
  })

  // return plaintext ครั้งเดียว — ไม่เก็บ plaintext ใน DB
  return Response.json({ code })
}
```

---

#### Admin UI `/admin/sites/[id]` — Password Section

```
Site Password สำหรับเช็คอิน
─────────────────────────────────────
อัปเดตล่าสุด: 1 เม.ย. 69 (5 วันที่แล้ว)

[Generate New Password]

⚠️ code เก่าจะใช้ไม่ได้ทันที — แจก code ใหม่ให้ รปภ ก่อนกด
```

เมื่อกด Generate → modal แสดง:
```
รหัสผ่านใหม่: 847293

[Copy] [QR Code]

⚠️ แสดงครั้งเดียว — ส่งให้ รปภ ก่อนปิด
```

---

#### Admin UI `/admin/line-mapping` — Pending Approvals

ตารางแสดง pending mappings:

| LINE Name | Guard | Site | วิธีที่มา | วันที่ | Action |
|-----------|-------|------|---------|-------|--------|
| สมชาย LINE | สมชาย ใจดี | Kibun | เช็คอิน | 2 เม.ย. | [✅ Approve] [❌ Reject] [✏️ เปลี่ยน guard] |

กด **Approve** → `is_verified = true` + LINE push แจ้ง รปภ
กด **เปลี่ยน guard** → dropdown เลือก guard ใหม่ก่อน approve (กรณี รปภ เลือกชื่อผิด)

---

#### Security Notes

| Risk | Mitigation |
|------|-----------|
| คนอื่นเดา 6-digit code | bcrypt compare ทุก site → rate limit 5 ครั้ง/นาที/IP |
| รปภ เลือกชื่อผิดตอน Path B | Admin ตรวจเทียบกับรูปเช็คอิน + เปลี่ยน guard ได้ตอน approve |
| password leak ใน LINE group | Generate ใหม่ได้ทันที → code เก่าใช้ไม่ได้ |
| ไม่มี LIFF context (เปิดผ่าน browser) | `liff.getProfile()` fail → redirect ไปหน้า error "กรุณาเปิดผ่าน LINE" |

---

### 11.2 AI Fallback สำหรับ LINE Chat (ปรับ v2.0)

เมื่อ Layer 1 return `IGNORE` → ไม่เรียก Claude — ใช้ escape hatch reply แทน

เมื่อ Layer 1 return intent → ส่ง Layer 2 classify → route by intent:
- **LEAVE_REQUEST** → สร้าง ticket + notify admin
- **LATE_NOTICE** → log + แจ้งหัวหน้าชุด
- **RESIGNATION** → P2 alert เท่านั้น (ห้าม auto-update employment_status)
- **QUESTION** → query DB + ตอบ inline

---

## 12. Guard Score Integration

**Attendance เป็น 25% ของ Guard Score (0–100):**

```
Attendance Score คำนวณจาก:

Base: 100
หัก:
- มาสาย 5–15 นาที      = -2/ครั้ง
- มาสาย 16–30 นาที     = -5/ครั้ง
- มาสาย > 30 นาที      = -10/ครั้ง
- ขาดงาน (no-show)      = -15/ครั้ง
- ควงกะ (unauthorized)   = -10/ครั้ง
- ลาไม่แจ้งล่วงหน้า      = -8/ครั้ง

Rolling 90-day window
Recalculate: ทุกวัน 00:00 + realtime เมื่อมี event ใหม่
```

**Guard Score ยังไม่ต้อง implement ใน phase แรก** — แค่เก็บข้อมูลให้ครบ แล้วค่อยเพิ่ม calculation ทีหลัง

---

## 13. Admin Dashboard Pages

### 13.1 `/admin/dashboard` — Overview

- **Alert badge:** จำนวน unresolved alerts (P1 สีแดง, P2 สีเหลือง)
- **Today's shifts:** กราฟวงกลม เช็คอินแล้ว / ยังไม่เช็คอิน / สาย / ขาด
- **Pending leave:** จำนวน ticket รอ approve
- **Quick stats:** on-time rate 7 วัน, จำนวน guards active, sites active

### 13.2 `/admin/checkins` — เช็คอินวันนี้

- **ตาราง:** รูปเช็คอิน | ชื่อที่เลือก | ไซต์ | เวลา | สถานะ | GPS ตรง? | Face badge
- **Filter:** กะเช้า/ดึก, ไซต์, สถานะ, **face status (all / review needed / mismatch)**
- **Face badge per record (v2.0):**
  - 🟢 System ✓ (similarity ≥ 0.85) — ไม่ต้อง review
  - 🟡 Review (similarity 0.60–0.84) — กดดูและ override
  - 🔴 Mismatch (similarity < 0.60) — P1 alert แล้ว ต้องตรวจ
  - ⚪ No data — รปภ ยังไม่ enroll หรือ CompreFace timeout
- **กดที่รูป:** เปิด popup เทียบ รูปเช็คอิน vs รูปโปรไฟล์ + แสดง similarity score
- **Admin override:** [✓ ยืนยันตรง] [✗ ยืนยันไม่ตรง] + optional note → face_verified_by = 'admin'

### 13.3 `/admin/guards/[id]` — Guard Profile

- ข้อมูล + รูปโปรไฟล์
- **Photo timeline:** grid รูปเช็คอิน 30 วัน (click เพื่อดูใหญ่)
- **Stats 90 วัน:** on-time%, late count + avg minutes, absent count, double shift count
- **Leave balance:** แต่ละประเภท
- **Leave history:** tickets ทั้งหมด
- **Alert history:** alerts ที่เกี่ยวข้อง

### 13.4 `/admin/leave` — Leave Management

- **Tab:** Pending | Approved (รอคนแทน) | Approved (ครบ) | Rejected | All
- **Card per ticket:** ticket#, ชื่อ, ไซต์, ประเภท, วันที่, เหตุผล, ข้อความต้นฉบับ
- **Action (Pending):** [อนุมัติ ✅] [ไม่อนุมัติ ❌] + optional note
- **Action (Approved — รอคนแทน):**
  - แสดง badge ⚠️ "รอคนแทน" + เวลาที่เหลือก่อน deadline
  - Dropdown: [เลือก รปภ ▼] จาก pool ที่ว่างวันนั้น (query จาก guard_site_assignments ที่ไม่มี checkin หรือ leave วันนั้น)
  - ปุ่ม [ยืนยันคนแทน → แจ้งลูกค้า] — กดแล้ว:
    1. update `replacement_guard_id` + `replacement_set_at`
    2. ถ้า site มี `leave_protocol.notify_client_on_replacement = true` → **AUTO PUSH LINE กลุ่มลูกค้าทันที**
    3. update `client_notified = true` + `client_notified_at`
  - ถ้า site ไม่มี leave_protocol → ปุ่มแสดงแค่ [บันทึกคนแทน] ไม่มี auto push
- **Badge สีบน card:**
  - 🔴 รอคนแทน + เกิน deadline แล้ว
  - 🟡 รอคนแทน + ยังไม่เกิน deadline
  - 🟢 มีคนแทนแล้ว + แจ้งลูกค้าแล้ว
  - ⚪ มีคนแทนแล้ว + ไม่ต้องแจ้งลูกค้า (site ไม่มี protocol)

### 13.5 `/admin/sites/[id]` — Site Config

- ข้อมูลไซต์ + location + geofence
- **Photo routing config:** toggle ส่งรูปไปกลุ่มลูกค้า on/off + LINE group ID
- **Guard assignments:** whitelist รปภ + primary flag
- **Shift config:** เวลาเริ่ม/สิ้นสุดกะเช้า-ดึก + จำนวน รปภ ที่ต้องการ
- **Site Password config (v2.0):**
  - แสดง `password_updated_at` (อัปเดตล่าสุดเมื่อไหร่)
  - ปุ่ม [Generate New Password] → modal แสดง 6-digit code + QR (ครั้งเดียว)
  - ⚠️ warning ว่า code เก่าจะใช้ไม่ได้ทันทีหลัง generate ใหม่
- **Leave Protocol config (v2.0):** ตั้งค่า per-site ว่าระบบจะแจ้งลูกค้าอย่างไรเมื่อ รปภ ลา
  - Toggle: แจ้งลูกค้าเมื่ออนุมัติลา (on/off)
  - Toggle: auto push LINE เมื่อมีคนแทน (on/off)
  - LINE group ID สำหรับแจ้งลูกค้า (ใช้ร่วมกับ photo_routing ได้)
  - Deadline แจ้งเตือน admin (ชั่วโมง): 1 / 2 / 4 / ไม่ตั้ง
  - Message template: text area พร้อม variable hints
    ({contact_name} {date} {guard_name} {leave_type} {replacement_name} {shift_time})
  - Preview button: แสดงตัวอย่าง message ก่อน save

---

## 14. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| **Check-in page load** | < 2 วินาที |
| **Photo upload + submit** | < 5 วินาที |
| **AI response (leave classification)** | < 3 วินาที |
| **Photo routing to client group** | < 10 วินาที หลัง check-in |
| **No-show alert** | ภายใน 15 นาทีหลังเริ่มกะ |
| **Photo storage retention** | 90 วัน (configurable) |
| **Concurrent users** | 20–30 คน (ช่วงเปลี่ยนกะ) |
| **Uptime** | 99.5% (ไม่ใช่ life-critical) |
| **Mobile responsive** | ทุกหน้า ต้องใช้ได้บน mobile |
| **Language** | Thai (UI + AI responses) |

---

## 15. Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# BetterAuth
BETTER_AUTH_SECRET=xxx
BETTER_AUTH_URL=https://your-domain.com

# LINE
LINE_CHANNEL_ACCESS_TOKEN=xxx
LINE_CHANNEL_SECRET=xxx
NEXT_PUBLIC_LIFF_CHECKIN_ID=xxx
NEXT_PUBLIC_LIFF_CHECKOUT_ID=xxx
NEXT_PUBLIC_LIFF_LEAVE_ID=xxx

# Claude API
ANTHROPIC_API_KEY=xxx

# Storage
SUPABASE_URL=xxx
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_KEY=xxx
STORAGE_BUCKET=checkin-photos

# App
NEXT_PUBLIC_APP_URL=https://your-domain.com
ADMIN_LINE_USER_ID=xxx  # Suwijak's LINE userId for push notifications

# CompreFace (Hetzner CX22)
COMPREFACE_URL=http://<hetzner-server-ip>
COMPREFACE_API_KEY=<api-key-from-compreface-admin-ui>
```

---

## 16. Development Phases

### Phase 1 (MVP) — 4–6 สัปดาห์

**ทำ:**
- [x] Database setup (Supabase Postgres + schema)
- [x] BetterAuth admin login
- [x] LIFF check-in page (ชื่อ autocomplete + ไซต์ dropdown + ถ่ายรูป)
- [x] LIFF check-out page
- [x] Photo upload to Storage
- [x] Photo routing to LINE client groups
- [x] Admin: dashboard overview
- [x] Admin: checkins today (รูป + identity review)
- [x] Admin: guard CRUD + profile + photo timeline
- [x] Admin: site CRUD + photo routing config + guard assignment
- [x] LINE webhook: รับข้อความ → AI classify → leave ticket
- [x] Admin: leave ticket list + approve/reject
- [x] Admin: leave ticket — set replacement guard → auto push LINE ลูกค้า (ถ้า site มี leave_protocol)
- [x] Admin: site config — leave_protocol settings (toggle + deadline + template)
- [x] LINE push: ผล approve/reject กลับ รปภ
- [x] Cron: no-show check (ทุก 15 นาที)
- [x] LINE push: alert ไป admin

**ยังไม่ทำ:**
- [ ] Guard Score calculation
- [ ] Pattern detection
- [ ] Weekly digest
- [ ] LINE mapping admin UI
- [ ] Rich Menu setup (ทำ manual ใน LINE Developer Console)

### Phase 2 — เพิ่มเติม (รวม CompreFace)

- [ ] LINE mapping admin UI
- [ ] Pattern detection (daily cron + Claude)
- [ ] Weekly digest (weekly cron + Claude)
- [ ] Guard Score auto-calculation
- [ ] Reports page
- [ ] LIFF leave form (alternative)
- [ ] Rich Menu ชุด admin
- [ ] **CompreFace setup บน Hetzner + enrollment flow** (Section 11E)
- [ ] **Face verification async ทุก checkin + admin review UI**
- [ ] Secretary Agent morning briefing + realtime ping (Section 11D)

### Phase 3 — ต่อยอด

- [ ] Shift scheduling (จัดตารางกะล่วงหน้า)
- [ ] Replacement pool suggestion
- [ ] Client-facing LIFF (ลูกค้าดูรูปเช็คอิน/ข้อร้องเรียนเอง)
- [ ] Integration กับ Complaint system + Quarterly Report

---

## 17. Open Questions (ยังไม่ได้ confirm)

| # | คำถาม | ค่าเริ่มต้นที่ใช้ใน spec นี้ |
|---|-------|---------------------------|
| 1 | GPS enforcement — Soft (flag แต่ไม่ block) หรือ Hard (บังคับอยู่ในพื้นที่)? | **Soft** — flag แต่ยังเช็คอินได้ |
| 2 | ลาออกแจ้งล่วงหน้ากี่วัน? | **30 วัน** (ตามกฎหมายแรงงาน) < 30 วัน = flag sudden |
| 3 | ควงกะ — block หรือ allow with approval? | **Allow with flag** — AI detect + alert แต่ไม่ block |
| 4 | LINE OA — ตัวเดิมหรือสร้างใหม่? | **สร้างใหม่** (สำหรับระบบนี้โดยเฉพาะ) |
| 5 | Hosting — Vercel+Supabase หรือ VPS? | **Vercel + Supabase** (free tier เริ่มต้น) |
| 6 | รูปเช็คอิน เก็บนานแค่ไหน? | **90 วัน** rolling |
| 7 | CompreFace similarity threshold — ปรับได้หลัง go-live? | **ใช่** — ปรับใน `lib/compreface.ts` constants ได้ทันที ไม่ต้อง redeploy CompreFace |
| 8 | รปภ ที่ยังไม่ enroll face — ทำอย่างไร? | **skip verification** — badge ⚪ ใน dashboard, admin enroll ทีหลังได้ |

---

## 18. Estimated Monthly Cost

| รายการ | ประมาณ |
|--------|-------|
| Vercel (Hobby → Pro) | 0–700 บาท |
| Supabase (Free → Pro) | 0–900 บาท |
| Storage (photos ~65 คน × 2 รูป/วัน × 90 วัน) | 100–300 บาท |
| Claude API | 100–300 บาท |
| LINE Messaging API | 0–400 บาท |
| Domain | 35 บาท |
| Hetzner CX22 (CompreFace) | ~145 บาท |
| **รวม** | **~380–2,780 บาท/เดือน** |

เริ่มจาก free tier ทั้งหมด → ค่าใช้จ่ายจริงช่วงแรก ~380–650 บาท/เดือน (รวม Hetzner)
CompreFace เพิ่มแค่ ~145 บาท/เดือน ไม่มี per-verification cost

---

## 19. LINE Webhook Handler — Detailed Logic

### 19.1 Webhook Entry Point `/api/line/webhook`

```
POST /api/line/webhook
│
├── Verify signature (X-Line-Signature header)
│
├── For each event:
│   │
│   ├── event.type === 'follow'
│   │   → Insert line_mappings { line_user_id, display_name, is_verified: false }
│   │   → Reply: "สวัสดีครับ ยินดีต้อนรับสู่ระบบ SakornGuard
│   │            กรุณารอผู้จัดการยืนยันตัวตนครับ 🙏"
│   │   → Push to ADMIN_LINE_USER_ID: "🆕 LINE ใหม่: {displayName} รอผูก"
│   │
│   ├── event.type === 'message' && event.message.type === 'text'
│   │   │
│   │   ├── Lookup line_mappings → guard_id
│   │   │   ├── NOT FOUND or NOT VERIFIED
│   │   │   │   → Reply: "คุณยังไม่ได้ลงทะเบียน กรุณาติดต่อผู้จัดการครับ"
│   │   │   │   → STOP
│   │   │   │
│   │   │   └── FOUND + VERIFIED → continue
│   │   │
│   │   ├── [Layer 1] routeMessage(text) ← ทำก่อนเสมอ ไม่เรียก Claude ยังไม่ได้
│   │   │   │
│   │   │   ├── result === 'IGNORE'
│   │   │   │   → Reply: escape hatch message (quick menu)
│   │   │   │   → Log conversation (ai_intent: 'IGNORE')
│   │   │   │   → STOP ← ไม่เรียก Claude เลย
│   │   │   │
│   │   │   └── result !== 'IGNORE' → continue (ส่ง Layer 2)
│   │   │
│   │   ├── Load guard context:
│   │   │   - guard profile (name, site, position, employment_status)
│   │   │   - leave_balance
│   │   │   - today's shift_checkins (already checked in?)
│   │   │   - pending leave_requests
│   │   │
│   │   ├── [Layer 2] Call Claude API /api/ai/classify-intent
│   │   │   → Send: routeResult (Layer 1 hint) + message_text + guard_context
│   │   │   → system prompt: cache_control ephemeral
│   │   │   → Receive: { intent, confidence, entities, reply_message }
│   │   │
│   │   ├── Route by intent:
│   │   │   │
│   │   │   ├── LEAVE_REQUEST (confidence ≥ 0.7)
│   │   │   │   → Generate ticket_number: LV-{year}-{sequential 4 digits}
│   │   │   │   → Insert leave_requests (status: 'pending')
│   │   │   │   → Reply to guard: AI reply_message
│   │   │   │   → Push to admin: Leave ticket notification with Quick Reply buttons
│   │   │   │   → Log conversation
│   │   │   │
│   │   │   ├── LATE_NOTICE
│   │   │   │   → Update today's shift_checkins notes if exists
│   │   │   │   → Push to shift_leader: "{name} แจ้งว่าจะมาสาย: {reason}"
│   │   │   │   → Reply: "รับทราบครับ แจ้งหัวหน้าชุดให้แล้ว"
│   │   │   │   → Log conversation
│   │   │   │
│   │   │   ├── RESIGNATION
│   │   │   │   → Create P2 alert
│   │   │   │   → Push to admin with full context
│   │   │   │   → Reply: confirmation message
│   │   │   │   → DO NOT auto-update employment_status (admin ต้อง confirm)
│   │   │   │   → Log conversation
│   │   │   │
│   │   │   ├── SECRETARY_SNOOZE  ← ไม่เรียก Claude (rule-based ล้วนๆ)
│   │   │   │   → POST /api/secretary/snooze
│   │   │   │   → set snoozed_until: "เดี๋ยวจัดการ" = +4ชม., อื่นๆ = +2ชม.
│   │   │   │   → Reply: "รับทราบครับ จะแจ้งอีกครั้ง [เวลา]"
│   │   │   │   → Log conversation (ai_intent: 'SECRETARY_SNOOZE')
│   │   │   │
│   │   │   ├── QUESTION (ถามตารางกะ, วันลาเหลือ, etc.)
│   │   │   │   → Query DB based on AI entities
│   │   │   │   → Reply with data
│   │   │   │   → Log conversation
│   │   │   │
│   │   │   └── UNKNOWN / LOW CONFIDENCE
│   │   │       → Reply: escape hatch message
│   │   │       → Log conversation
│   │   │
│   │   └── DONE
│   │
│   ├── event.type === 'postback'  ← ไม่ใช้ AI เลย (rule-based ล้วนๆ)
│   │   │
│   │   ├── Parse postback.data (format: "action=xxx&id=xxx")
│   │   │
│   │   ├── action === 'approve_leave'
│   │   │   → Update leave_requests.status = 'approved'
│   │   │   → Update leave_requests.reviewed_by = admin
│   │   │   → Push to guard: "✅ อนุมัติ {leave_type} วันที่ {dates} แล้วครับ"
│   │   │   → Reply to admin: "✅ อนุมัติแล้ว"
│   │   │
│   │   ├── action === 'reject_leave'
│   │   │   → Update leave_requests.status = 'rejected'
│   │   │   → Push to guard: "❌ ไม่อนุมัติ {leave_type} กรุณาติดต่อผู้จัดการ"
│   │   │   → Reply to admin: "❌ ปฏิเสธแล้ว"
│   │   │
│   │   └── action === 'acknowledge_alert'
│   │       → Update manpower_alerts.acknowledged = true
│   │       → Reply: "✅ รับทราบแล้ว"
│   │
│   └── event.type === 'unfollow'
│       → Log: update line_mappings or soft-delete
│
└── Return 200 OK
```

### 19.2 Postback Data Format

```
# Leave approval
action=approve_leave&ticket_id={uuid}

# Leave rejection
action=reject_leave&ticket_id={uuid}

# Alert acknowledgment
action=ack_alert&alert_id={uuid}
```

---

## 20. AI System Prompts — Complete Set

### 20.1 Master Intent Classifier

```
ใช้เมื่อ: รปภ ส่งข้อความใดๆ เข้ามาใน LINE OA

---
System Prompt:
---

คุณเป็นระบบจัดการกำลังพลของบริษัทรักษาความปลอดภัย สาครการ์ด
หน้าที่: วิเคราะห์ข้อความจาก รปภ แล้วจำแนกว่าเป็น intent ประเภทไหน
พร้อมดึงข้อมูลสำคัญออกมา

ตอบเป็น JSON เท่านั้น ห้ามมี markdown, backtick, หรือคำอธิบายใดๆ

{
  "intent": "LEAVE_REQUEST" | "LATE_NOTICE" | "RESIGNATION" | "QUESTION" | "UNKNOWN",
  "confidence": 0.0-1.0,
  "entities": {
    // สำหรับ LEAVE_REQUEST:
    "leave_type": "sick" | "personal" | "annual" | "urgent",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "total_days": number,
    "reason": "string"

    // สำหรับ LATE_NOTICE:
    "estimated_arrival": "HH:MM",
    "reason": "string"

    // สำหรับ QUESTION:
    "topic": "schedule" | "leave_balance" | "other",
    "detail": "string"
  },
  "reply_message": "ข้อความตอบกลับ รปภ เป็นภาษาไทย สุภาพ กระชับ"
}

กฎ:
- ถ้ามีคำว่า "ลา", "หยุด", "ไม่มา", "ไม่สบาย" → มักเป็น LEAVE_REQUEST
- ถ้ามีคำว่า "สาย", "ไปไม่ทัน", "รถติด" → มักเป็น LATE_NOTICE
- ถ้ามีคำว่า "ลาออก", "ออกจากงาน", "ไม่ทำแล้ว" → RESIGNATION
- ถ้ามีคำว่า "กะ", "ตาราง", "เหลือกี่วัน" → QUESTION
- วันที่ที่ไม่ระบุ ให้ assume เป็นวันถัดไป
- "ลาด่วน" = leave_type: "urgent"
- ตอบกลับเป็นภาษาไทยสุภาพ ใช้ครับ/ค่ะ

Context ปัจจุบัน:
- วันที่วันนี้: {today}  (พ.ศ. format: {today_thai})
- รปภ: {guard_name} (รหัส {employee_code})
- ไซต์ประจำ: {site_name}
- สถานะการเข้ากะวันนี้: {today_checkin_status}
- วันลาคงเหลือ: ป่วย {sick_remaining} วัน, พักร้อน {annual_remaining} วัน, กิจ {personal_remaining} วัน
```

### 20.2 Alert Condition Checker

```
ใช้เมื่อ: Cron job เรียกทุก 15 นาทีช่วงเปลี่ยนกะ

---
System Prompt:
---

คุณเป็นระบบตรวจสอบกำลังพลอัตโนมัติของบริษัท สาครการ์ด
วิเคราะห์สถานการณ์กำลังพลและสร้าง alerts เมื่อพบปัญหา

ตอบเป็น JSON array เท่านั้น ห้ามมี markdown

กฎการสร้าง alert:
1. NO_SHOW (P1): รปภ ไม่เช็คอินเกิน 15 นาทีหลังเริ่มกะ + ไม่มี leave request approved + ไม่ได้แจ้งมาสาย
2. DOUBLE_SHIFT (P1): รปภ มีเช็คอิน 2 records ภายใน 24 ชม. ที่ไม่ใช่กะปกติ
3. SITE_UNDERSTAFFED (P1): ไซต์มี active guards < required headcount
4. LEAVE_NO_REPLACEMENT (P1): Leave approved แต่ replacement_guard_id = null ภายใน 4 ชม.ก่อนเริ่มกะ
5. LATE_SEVERE (P1): มาสายเกิน 30 นาที
6. LATE_MILD (P2): มาสาย 5-30 นาที

สำหรับแต่ละ alert ให้ระบุ:
- ระดับความเร่งด่วน (P1 = ต้องแก้ทันที, P2 = ควรทราบ)
- คำแนะนำการแก้ไขเป็นภาษาไทย
- ใครควรได้รับแจ้ง

[{
  "type": "NO_SHOW" | "DOUBLE_SHIFT" | "SITE_UNDERSTAFFED" | "LEAVE_NO_REPLACEMENT" | "LATE_SEVERE" | "LATE_MILD",
  "severity": "P1" | "P2",
  "guard_id": "uuid or null",
  "site_id": "uuid",
  "message_th": "ข้อความแจ้งเตือนภาษาไทย สั้น ชัด",
  "recommendation": "คำแนะนำ เช่น 'โทรหาสมชาย หรือหาคนแทนจากไซต์ใกล้เคียง'",
  "notify_to": ["admin"] หรือ ["admin", "shift_leader_{site_short_name}"]
}]

ถ้าไม่มี alert → ตอบ []

ข้อมูลปัจจุบัน:
- วันที่/เวลา: {now}
- กะที่กำลังตรวจ: {shift_type} ({shift_start_time})

Shift data (ไซต์ทั้งหมด):
{shift_data_json}

Leave data (วันนี้):
{leave_data_json}

Late notice data (วันนี้):
{late_notice_json}
```

### 20.3 Daily Pattern Detector

```
ใช้เมื่อ: Cron job ทุกวัน 08:00

---
System Prompt:
---

คุณเป็นระบบวิเคราะห์แนวโน้มพฤติกรรม รปภ ของบริษัท สาครการ์ด
ตรวจหา pattern ที่ต้องดำเนินการ จากข้อมูล 30 วันย้อนหลัง

ตอบเป็น JSON array เท่านั้น

กฎ:
1. PATTERN_LATE (P2): มาสาย ≥ 3 ครั้งใน 30 วัน → ควรตักเตือน
2. PATTERN_ABSENT (P1): ขาดงาน ≥ 2 ครั้งใน 30 วัน → ต้องดำเนินการ
3. PATTERN_LATE_DAY (P2): มาสายวันเดียวกันของสัปดาห์ ≥ 2 ครั้ง → pattern เฉพาะวัน
4. IMPROVING (Info): รปภ ที่เคยมี pattern แย่แต่ 14 วันล่าสุดดีขึ้นชัดเจน → ชมเชย
5. DOUBLE_SHIFT_FREQUENT (P1): ควงกะ ≥ 2 ครั้งใน 30 วัน → ไซต์นั้นน่าจะขาดคน

[{
  "type": "PATTERN_LATE" | "PATTERN_ABSENT" | "PATTERN_LATE_DAY" | "IMPROVING" | "DOUBLE_SHIFT_FREQUENT",
  "severity": "P1" | "P2" | "Info",
  "guard_id": "uuid",
  "site_id": "uuid",
  "message_th": "สมชาย มาสาย 4 ครั้งใน 30 วัน (เฉลี่ย 15 นาที) ควรออกใบเตือน",
  "recommendation": "คำแนะนำเป็นภาษาไทย",
  "data_summary": "สาย: 12/4, 15/4, 22/4, 28/4 เฉลี่ย 15 นาที"
}]

ข้อมูล 30 วัน:
{guard_stats_30d_json}
```

### 20.4 Weekly Digest Generator

```
ใช้เมื่อ: Cron job ทุกวันจันทร์ 07:00

---
System Prompt:
---

คุณเป็นผู้สรุปรายงานกำลังพลประจำสัปดาห์ของบริษัท สาครการ์ด
สรุปข้อมูลสัปดาห์ที่ผ่านมาให้กระชับ เข้าใจง่าย พร้อม action items

ตอบเป็น JSON:
{
  "summary_text": "ข้อความสรุปภาษาไทย พร้อม emoji ให้อ่านง่าย ความยาวไม่เกิน 500 ตัวอักษร ใช้ขึ้นบรรทัดใหม่แทนหัวข้อ",
  "highlights": ["จุดเด่น 1", "จุดเด่น 2"],
  "action_items": [
    {"guard_name": "สมชาย", "action": "ออกใบเตือนมาสาย", "priority": "high"},
    {"site_name": "Siam Clothing", "action": "หาคนเพิ่ม 1 ตำแหน่ง", "priority": "critical"}
  ],
  "on_time_rate": 89.2,
  "total_checkins": 280,
  "late_count": 14,
  "absent_count": 3,
  "double_shift_count": 2,
  "leave_count": 5
}

ข้อมูลสัปดาห์ {week_start} ถึง {week_end}:
{weekly_data_json}
```

---

## 21. Cron Job Specifications

### 21.1 No-show Check

```
Path:       /api/cron/no-show-check
Schedule:   ทุก 15 นาที ช่วง 05:00–08:00 และ 17:00–20:00 (ช่วงเปลี่ยนกะ)
            Vercel Cron: "*/15 5-8,17-20 * * *"

Logic:
1. Determine current shift type (day/night) based on current time
2. Query all sites → get required_guards_day/night + shift_start time
3. If current time > shift_start + 15 min:
   a. Query shift_checkins for today + this shift type + this site
   b. Compare with guard_site_assignments (who should be there)
   c. Find guards with no checkin + no approved leave + no late_notice

[Layer 1 — DB pre-filter ก่อนเรียก Claude เสมอ]
4. ถ้า missing guards list ว่างเปล่า (events = 0) → return [] ทันที ไม่เรียก Claude
5. ถ้ามี events → รวบรวม ALL events เป็น batch เดียว

[Layer 2 — 1 Claude call ต่อ cron run เท่านั้น ห้าม loop]
6. Call AI alert checker ด้วย batch data ทั้งหมดใน 1 call:
   - ห้ามวน loop เรียก Claude ทีละ guard หรือทีละ site
   - ส่ง events[] ทั้งหมดพร้อม guard_stats context ใน single request
7. Create alerts + Send LINE notifications

Auth:       Vercel Cron secret header (CRON_SECRET)
```

**ตัวอย่าง implementation ที่ถูกต้อง:**

```typescript
// api/cron/no-show-check/route.ts

export async function GET(req: Request) {
  // verify cron secret
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`)
    return new Response('Unauthorized', { status: 401 })

  // [Layer 1] DB pre-filter — ไม่เรียก Claude ยังไม่ได้
  const missingGuards = await getMissingGuards()  // query DB เท่านั้น
  if (missingGuards.length === 0) {
    return Response.json({ alerts: [], reason: 'no_events' })  // STOP
  }

  // [Layer 2] 1 batch call — ห้าม loop
  const guardStats = await getGuardStats(missingGuards.map(g => g.id))
  const alerts = await checkAlertsWithClaude({    // single call
    events: missingGuards,
    guardStats,
    now: new Date().toISOString()
  })

  await createAlertsAndNotify(alerts)
  return Response.json({ alerts })
}
```

### 21.2 Daily Pattern Detection

```
Path:       /api/cron/daily-pattern
Schedule:   ทุกวัน 08:00
            Vercel Cron: "0 8 * * *"

Logic:
1. Query shift_checkins last 30 days → aggregate per guard
   - late_count, avg_late_minutes, absent_count, double_shift_count
   - late_by_weekday (Mon=3, Tue=1, etc.)
2. Query guards with any concerning stats (late ≥ 3, absent ≥ 2, double ≥ 2)
3. Call AI pattern detector with batch data
4. Create alerts for patterns found
5. Send LINE push to admin (single digest, not per-alert)

Auth:       Vercel Cron secret header
```

### 21.3 Weekly Digest

```
Path:       /api/cron/weekly-digest
Schedule:   ทุกวันจันทร์ 07:00
            Vercel Cron: "0 7 * * 1"

Logic:
1. Query shift_checkins last 7 days → full aggregation
2. Query leave_requests last 7 days
3. Query manpower_alerts last 7 days
4. Call AI weekly digest generator
5. Send LINE Flex Message to admin

Auth:       Vercel Cron secret header
```

### 21.4 Photo Cleanup (Optional)

### 21.5 Cross-check Cron (ใหม่ใน v2.0) — Safety Net

```
Path:       /api/cron/cross-check
Schedule:   ทุกวัน 06:30 และ 18:30 (ก่อนเริ่มกะเช้า/ดึก)
            Vercel Cron: "30 6,18 * * *"

จุดประสงค์:
เปรียบเทียบ LINE messages ทั้งหมดในช่วง 12 ชม.ที่ผ่านมา กับ tickets ในระบบ
จับ edge case ที่หลุดทั้ง Layer 1 และ Layer 2 เช่น รปภ พิมพ์
"วันนี้ไม่สบายครับ" (ไม่มีคำว่าลา) → Layer 1 ไม่จับ → Layer 2 ไม่ถูกเรียก → ไม่มี ticket

Logic:
1. คำนวณช่วงเวลา: ย้อนหลัง 12 ชม.จากตอนนี้

[Layer 1 — filter ข้อมูลก่อนส่ง Claude]
2. Query conversations table เฉพาะ:
   WHERE created_at >= (now - 12h)
   AND (ai_intent = 'IGNORE' OR ai_intent IS NULL OR ai_intent = 'LEAVE_REQUEST')
   SELECT guard_id, guard_name, message_text, ai_intent, created_at
   (ไม่เอา: device_info, processing_ms, raw fields อื่นๆ)
   → เหลือ ~30–50 rows จาก ~195 messages ทั้งหมด (ลด tokens 75%)

3. Query leave_requests ในช่วงเดียวกัน:
   WHERE created_at >= (now - 12h)
   SELECT ticket_number, guard_id, guard_name, leave_type,
          start_date, status, created_at

[Layer 2 — 1 Claude call]
4. ส่งทั้งสองชุดให้ Claude วิเคราะห์:
   - หา messages ที่น่าจะเป็นขอลาแต่ไม่มี ticket
   - หา tickets ที่ pending นานผิดปกติ (> 2 ชม.)
   - สรุปภาพรวมสั้นๆ

5. ส่ง LINE summary ไป admin เสมอ แม้ไม่มี gap:
   "✅ กะเช้า: ครบ (3 tickets ตรง)" หรือ "⚠️ พบ gap 1 รายการ..."

Auth:       Vercel Cron secret header (CRON_SECRET)
```

**System Prompt สำหรับ Cross-check:**

```
คุณเป็นระบบ cross-check กำลังพลของบริษัท สาครการ์ด
เปรียบเทียบ LINE messages กับ leave tickets ในระบบ

ตอบเป็น JSON เท่านั้น:
{
  "gaps": [
    {
      "guard_name": "string",
      "guard_id": "string",
      "message_text": "string",
      "sent_at": "HH:MM",
      "reason": "น่าจะเป็นขอลาแต่ไม่มี ticket เพราะ..."
    }
  ],
  "pending_long": [
    {
      "ticket_number": "string",
      "guard_name": "string",
      "pending_hours": number
    }
  ],
  "summary_th": "ข้อความสรุปภาษาไทย 1–3 บรรทัด",
  "total_tickets": number,
  "total_gaps": number
}

ถ้าไม่มี gap → gaps: [] แต่ยังส่ง summary_th เสมอ
```

**ตัวอย่าง LINE output:**

```
📋 Cross-check กะเช้า 2 เม.ย. 69 (05:00–06:30)

✅ tickets ในระบบ: 3 รายการ (อนุมัติ 1, รอ 2)

⚠️ พบ gap 1 รายการ:
• สมชาย (G-001): "วันนี้ไม่สบายครับ" 05:42
  → ไม่มี leave ticket — แนะนำ: โทรยืนยัน หรือสร้าง ticket ให้

⏳ pending นาน: สมศักดิ์ LV-2569-0038 (รอ 4 ชม.)

[ดู dashboard]
```

Auth:       Vercel Cron secret header (CRON_SECRET)

---

### 21.6 Photo Cleanup
Schedule:   ทุกวัน 02:00
            Vercel Cron: "0 2 * * *"

Logic:
1. Query guard_photos where taken_at < NOW() - 90 days
2. Delete from Supabase Storage
3. Update guard_photos.photo_url = null (keep record, remove file)
   OR delete record entirely

Auth:       Vercel Cron secret header
```

---

## 22. LINE Flex Message Templates

### 22.1 Check-in Notification (ส่งไปกลุ่มลูกค้า)

```json
{
  "type": "flex",
  "altText": "✅ {guard_name} เข้ากะแล้ว",
  "contents": {
    "type": "bubble",
    "size": "kilo",
    "hero": {
      "type": "image",
      "url": "{checkin_photo_url}",
      "size": "full",
      "aspectRatio": "4:3",
      "aspectMode": "cover"
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "text",
          "text": "{status_emoji} {status_text}",
          "weight": "bold",
          "color": "{status_color}"
        },
        {
          "type": "text",
          "text": "👤 {guard_name}{replacement_text}",
          "size": "sm",
          "margin": "md"
        },
        {
          "type": "text",
          "text": "⏰ {time}",
          "size": "sm",
          "color": "#888888"
        },
        {
          "type": "text",
          "text": "📍 {site_name} — กะ{shift_type_th}",
          "size": "sm",
          "color": "#888888"
        }
      ]
    }
  }
}

Variables:
- status_emoji: ✅ (on_time) | ⚠️ (late)
- status_text: "เข้ากะตรงเวลา" | "เข้ากะสาย {late_minutes} นาที"
- status_color: "#1D9E75" (on_time) | "#E24B4A" (late)
- replacement_text: "" | " (แทน {replaced_guard_name})"
- shift_type_th: "เช้า" | "ดึก"
```

### 22.2 Leave Request Notification (ส่งไป Admin)

```json
{
  "type": "flex",
  "altText": "📋 คำขอลาใหม่ #{ticket_number}",
  "contents": {
    "type": "bubble",
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        { "type": "text", "text": "📋 คำขอลาใหม่", "weight": "bold", "size": "lg" },
        { "type": "text", "text": "#{ticket_number}", "size": "sm", "color": "#888888" },
        { "type": "separator", "margin": "md" },
        { "type": "text", "text": "👤 {guard_name} ({employee_code})", "size": "sm", "margin": "md" },
        { "type": "text", "text": "📍 {site_name}", "size": "sm" },
        { "type": "text", "text": "📝 {leave_type_th}", "size": "sm" },
        { "type": "text", "text": "📅 {start_date} - {end_date} ({total_days} วัน)", "size": "sm" },
        { "type": "text", "text": "💬 \"{reason}\"", "size": "sm", "color": "#666666", "wrap": true },
        { "type": "separator", "margin": "md" },
        { "type": "text", "text": "ข้อความต้นฉบับ:", "size": "xs", "color": "#aaaaaa", "margin": "md" },
        { "type": "text", "text": "\"{original_message}\"", "size": "xs", "color": "#aaaaaa", "wrap": true }
      ]
    },
    "footer": {
      "type": "box",
      "layout": "horizontal",
      "contents": [
        {
          "type": "button",
          "action": {
            "type": "postback",
            "label": "อนุมัติ ✅",
            "data": "action=approve_leave&ticket_id={ticket_uuid}"
          },
          "style": "primary",
          "color": "#1D9E75"
        },
        {
          "type": "button",
          "action": {
            "type": "postback",
            "label": "ไม่อนุมัติ ❌",
            "data": "action=reject_leave&ticket_id={ticket_uuid}"
          },
          "style": "secondary"
        }
      ]
    }
  }
}
```

### 22.3 Alert Notification (ส่งไป Admin)

```json
{
  "type": "flex",
  "altText": "🚨 [{severity}] {alert_type_th}",
  "contents": {
    "type": "bubble",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "{severity_bg_color}",
      "contents": [
        { "type": "text", "text": "🚨 {severity} — {alert_type_th}", "color": "#ffffff", "weight": "bold" }
      ]
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        { "type": "text", "text": "{message_th}", "wrap": true },
        { "type": "separator", "margin": "md" },
        { "type": "text", "text": "💡 {recommendation}", "size": "sm", "color": "#666666", "wrap": true, "margin": "md" }
      ]
    },
    "footer": {
      "type": "box",
      "layout": "horizontal",
      "contents": [
        {
          "type": "button",
          "action": {
            "type": "postback",
            "label": "รับทราบ ✅",
            "data": "action=ack_alert&alert_id={alert_uuid}"
          },
          "style": "primary"
        },
        {
          "type": "button",
          "action": {
            "type": "uri",
            "label": "ดูรายละเอียด",
            "uri": "{app_url}/admin/alerts/{alert_uuid}"
          },
          "style": "secondary"
        }
      ]
    }
  }
}

Variables:
- severity_bg_color: "#DC3545" (P1) | "#FFC107" (P2)
- alert_type_th: "ไม่เข้ากะ" | "ควงกะ" | "ไซต์ขาดคน" | "ลาไม่มีคนแทน" | "มาสายมาก" | "pattern มาสายบ่อย"
```

---

## 23. Error Handling & Edge Cases

### 23.1 Check-in Edge Cases

| Scenario | Behavior |
|----------|----------|
| รปภ เลือกชื่อตัวเอง แต่เช็คอินไปแล้ว (กะเดียวกัน วันเดียวกัน ไซต์เดียวกัน) | แสดง: "คุณเช็คอินไปแล้วเวลา {time} ต้องการเช็คอินซ้ำไหม?" → ถ้าใช่ → update record เดิม |
| รปภ เลือกไซต์ที่ไม่อยู่ใน whitelist | ไม่เกิดขึ้น — dropdown แสดงเฉพาะ whitelist sites |
| GPS ไม่ได้ (permission denied / timeout) | ยังเช็คอินได้ → `checkin_lat/lng = null`, `checkin_within_site = null` → flag ใน dashboard |
| กล้องไม่ทำงาน / ไม่ได้ถ่ายรูป | ไม่สามารถ submit ได้ — photo is required |
| Internet ขาดระหว่าง submit | แสดง error → ให้ลองใหม่ → ถ้ายังไม่ได้ → หัวหน้าชุดบันทึก manual |
| Photo upload ล้มเหลว | Retry 2 ครั้ง → ถ้ายังไม่ได้ → แสดง error ให้ลองใหม่ |
| รูปมืด / ไม่ชัด | ระบบไม่ตรวจคุณภาพรูป (Phase 1) → admin ดูแล้ว flag manual |

### 23.2 Leave Request Edge Cases

| Scenario | Behavior |
|----------|----------|
| AI ไม่แน่ใจว่าเป็นขอลา (confidence < 0.7) | ถาม confirm: "คุณต้องการขอลาใช่ไหมครับ? [ใช่ ขอลา] [ไม่ใช่]" |
| รปภ ขอลาวันที่ซ้อนกับ leave request ที่ approved แล้ว | แจ้ง: "คุณมีวันลาอนุมัติแล้ววันที่ {date} — ต้องการขอลาเพิ่มเติมไหม?" |
| รปภ ขอลาแต่วันลาหมด | สร้าง ticket ปกติ แต่ AI reply_message แจ้ง: "⚠️ วันลา{type}คุณหมดแล้ว จะส่งเรื่องให้ผู้จัดการพิจารณาครับ" |
| รปภ ขอลาย้อนหลัง (วันที่ผ่านไปแล้ว) | AI detect → สร้าง ticket พร้อม flag "ลาย้อนหลัง" → admin ตัดสินใจ |
| Claude API ล่ม / timeout | Fallback: reply "ระบบขัดข้อง กรุณาลองใหม่ภายหลัง หรือติดต่อผู้จัดการโดยตรง" → log error |

### 23.3 LINE Webhook Edge Cases

| Scenario | Behavior |
|----------|----------|
| Invalid signature | Return 401 — ไม่ process |
| LINE userId ไม่มีใน line_mappings | Reply: "คุณยังไม่ได้ลงทะเบียน กรุณาติดต่อผู้จัดการ" |
| guard.employment_status !== 'active' | Reply: "บัญชีของคุณไม่ active กรุณาติดต่อผู้จัดการ" |
| ข้อความเป็นรูปภาพ / สติกเกอร์ / อื่นๆ (ไม่ใช่ text) | Ignore (ไม่ตอบ) |
| Rate limit — รปภ ส่งข้อความถี่มาก | Process ปกติ แต่ log warning ถ้า > 10 msg/min จาก user เดียว |

---

## 24. Seed Data for Development

### 24.1 Initial Sites

```json
[
  { "name": "Kibun Thailand", "short_name": "kibun", "required_guards_day": 7, "required_guards_night": 7, "shift_start_day": "07:00", "shift_start_night": "19:00", "photo_routing": { "checkin": { "send_to_client_group": false } } },
  { "name": "Siam Clothing", "short_name": "siam_clothing", "required_guards_day": 3, "required_guards_night": 2, "shift_start_day": "07:00", "shift_start_night": "19:00", "photo_routing": { "checkin": { "send_to_client_group": true, "client_line_group_id": "TO_BE_CONFIGURED" } } },
  { "name": "T.K. Ingot", "short_name": "tk_ingot", "required_guards_day": 2, "required_guards_night": 2 },
  { "name": "Linde Thailand", "short_name": "linde", "required_guards_day": 2, "required_guards_night": 2 },
  { "name": "Dev Test Site", "short_name": "dev_test", "required_guards_day": 1, "required_guards_night": 1 }
]
```

### 24.2 Test Guards (for dev)

```json
[
  { "employee_code": "G-001", "full_name": "ทดสอบ สมชาย", "nickname": "ชาย", "position": "guard", "current_site_id": "kibun" },
  { "employee_code": "G-002", "full_name": "ทดสอบ สมศักดิ์", "nickname": "ศักดิ์", "position": "shift_leader", "current_site_id": "siam_clothing" },
  { "employee_code": "G-003", "full_name": "ทดสอบ สมหญิง", "nickname": "หญิง", "position": "guard", "current_site_id": "tk_ingot" },
  { "employee_code": "G-099", "full_name": "ทดสอบ สำรอง", "nickname": "สำรอง", "position": "patrol", "allow_any_site": true }
]
```

### 24.3 Admin User

```json
{ "email": "suwijak@sakornguard.com", "role": "admin", "name": "Suwijak" }
```

---

## 25. Project Setup Instructions (Windsurf)

### 25.1 Initial Setup

```bash
# 1. Create Next.js project
npx create-next-app@latest sakornguard-manpower --typescript --tailwind --app --src-dir

# 2. Install dependencies
cd sakornguard-manpower
npm install better-auth @line/bot-sdk @line/liff @supabase/supabase-js
npm install @anthropic-ai/sdk
npm install prisma @prisma/client   # OR: drizzle-orm drizzle-kit
npm install zod                     # for input validation
npm install sharp                   # for image compression before upload

# 3. Dev dependencies
npm install -D @types/node

# 4. Setup Prisma (if using Prisma)
npx prisma init
# → Copy schema from Section 8 into prisma/schema.prisma

# 5. Setup environment
cp .env.example .env.local
# → Fill in all values from Section 15
```

### 25.2 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── line/webhook/route.ts
│   │   ├── ai/
│   │   │   ├── classify-intent/route.ts
│   │   │   ├── check-alerts/route.ts
│   │   │   └── weekly-digest/route.ts
│   │   ├── checkin/
│   │   │   ├── route.ts              (POST: submit checkin)
│   │   │   ├── prepare/route.ts      (GET: autocomplete guards)
│   │   │   └── sites/route.ts        (GET: whitelist sites)
│   │   ├── checkout/route.ts
│   │   ├── guards/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       ├── stats/route.ts
│   │   │       ├── photos/route.ts
│   │   │       └── leave-balance/route.ts
│   │   ├── sites/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       └── assignments/route.ts
│   │   ├── leave/
│   │   │   ├── route.ts
│   │   │   └── [id]/review/route.ts
│   │   ├── alerts/
│   │   │   ├── route.ts
│   │   │   └── [id]/acknowledge/route.ts
│   │   ├── line-mapping/
│   │   │   ├── route.ts
│   │   │   ├── pending/route.ts
│   │   │   └── map/route.ts
│   │   ├── secretary/
│   │   │   ├── ping/route.ts
│   │   │   └── snooze/route.ts
│   │   └── cron/
│   │       ├── no-show-check/route.ts
│   │       ├── cross-check/route.ts
│   │       ├── secretary-briefing/route.ts
│   │       ├── daily-pattern/route.ts
│   │       ├── weekly-digest/route.ts
│   │       └── photo-cleanup/route.ts
│   │
│   ├── liff/
│   │   ├── checkin/page.tsx
│   │   ├── checkout/page.tsx
│   │   └── leave/page.tsx
│   │
│   ├── admin/
│   │   ├── layout.tsx              (auth guard + sidebar)
│   │   ├── dashboard/page.tsx
│   │   ├── checkins/page.tsx
│   │   ├── guards/
│   │   │   ├── page.tsx            (list)
│   │   │   ├── new/page.tsx        (create)
│   │   │   └── [id]/page.tsx       (detail + photo timeline)
│   │   ├── sites/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── leave/page.tsx
│   │   ├── alerts/page.tsx
│   │   ├── line-mapping/page.tsx
│   │   └── reports/page.tsx
│   │
│   ├── auth/
│   │   └── login/page.tsx
│   │
│   ├── layout.tsx
│   └── page.tsx                    (redirect to /admin or /liff)
│
├── lib/
│   ├── db.ts                       (Prisma/Drizzle client)
│   ├── auth.ts                     (BetterAuth config)
│   ├── line.ts                     (LINE client + helpers)
│   ├── ai.ts                       (Claude API helpers + routeMessage() Layer 1 + fuzzy match)
│   ├── secretary.ts                (Secretary Agent — collectPendingItems + generateBriefing + pingIfNeeded)
│   ├── compreface.ts               (CompreFace helpers — enrollFace, verifyFace, classifyVerification)
│   ├── storage.ts                  (Supabase Storage helpers)
│   ├── geo.ts                      (haversine distance calc)
│   ├── ticket.ts                   (ticket number generator)
│   └── constants.ts                (leave rules, shift times, keyword lists for routing)
│
├── components/
│   ├── admin/                      (admin dashboard components)
│   ├── liff/                       (LIFF page components)
│   └── ui/                         (shared UI components)
│
└── types/
    └── index.ts                    (TypeScript types matching DB schema)
```

### 25.3 vercel.json (Cron Configuration)

```json
{
  "crons": [
    {
      "path": "/api/cron/no-show-check",
      "schedule": "*/15 5-8,17-20 * * *"
    },
    {
      "path": "/api/cron/secretary-briefing",
      "schedule": "0 7 * * *"
    },
    {
      "path": "/api/cron/cross-check",
      "schedule": "30 6,18 * * *"
    },
    {
      "path": "/api/cron/daily-pattern",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/weekly-digest",
      "schedule": "0 7 * * 1"
    },
    {
      "path": "/api/cron/photo-cleanup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

---

## 26. Security Considerations

| Area | Measure |
|------|---------|
| **LINE Webhook** | Verify X-Line-Signature on every request |
| **Cron endpoints** | Verify `Authorization: Bearer {CRON_SECRET}` header |
| **Admin pages** | BetterAuth session check in layout.tsx middleware |
| **LIFF pages** | No auth required (by design — ใช้ชื่อ+รูปแทน) |
| **API routes** | Admin routes: require auth session; Public routes (/checkin, /checkout): no auth |
| **Photo URLs** | Use signed URLs from Supabase Storage (expire 1 hour) for admin dashboard |
| **Claude API key** | Server-side only — never expose to client |
| **SQL injection** | Use parameterized queries (Prisma/Drizzle handle this) |
| **Image upload** | Validate file type (jpg/png only), max size 5MB, compress before storage |
| **Rate limiting** | LINE webhook: trust LINE's rate limiting; API routes: consider adding if needed later |

---

## 27. Testing Checklist (Dev Verification)

### Phase 1 MVP — Must Pass Before Deploy

> **วิธีอ่าน:** แต่ละ test case ระบุ **input → expected output** และ **condition** ที่ต้องผ่านก่อน deploy

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE A0: LINE IDENTITY + SITE PASSWORD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A0-1. เปิด LIFF ผ่าน browser ธรรมดา (ไม่ใช่ LINE)
      Input : เปิด URL /liff/checkin ใน Chrome โดยตรง
      Expect: liff.getProfile() fail → หน้า error "กรุณาเปิดผ่าน LINE"

A0-2. Path A — LINE verified แล้ว
      Input : LINE userId ที่มีใน line_mappings + is_verified = true
      Expect: GET /api/checkin/identity → status: 'verified'
      Verify: LIFF แสดง dropdown site (whitelist เท่านั้น) — ไม่แสดงฟอร์ม password

A0-3. Path B — LINE ยังไม่ verified
      Input : LINE userId ที่ไม่มีใน DB
      Expect: GET /api/checkin/identity → status: 'unverified'
      Verify: LIFF แสดงฟอร์ม "ใส่รหัสผ่านไซต์" — ไม่แสดง guard dropdown ก่อน

A0-4. Site password ถูกต้อง
      Input : POST /api/checkin/verify-site-password { password: "847293" }
      Expect: return { site_id, site_name, guards[] }
      Verify: guards[] มีเฉพาะ guards ของ site นั้น ไม่มี guard จาก site อื่น

A0-5. Site password ผิด
      Input : password ที่ไม่ตรงกับ site ใดเลย
      Expect: return 401 "รหัสผ่านไม่ถูกต้อง"
      Verify: ไม่บอกว่า site ไหนผิด — ป้องกัน enumeration

A0-6. Rate limit site password
      Input : ใส่ password ผิด 5 ครั้งติดกันจาก IP เดียวกัน
      Expect: ครั้งที่ 6 return 429 "ลองใหม่ใน 1 นาที"

A0-7. Generate site password
      Input : Admin กด [Generate New Password] ใน /admin/sites/[id]
      Expect: POST /api/sites/[id]/generate-password → modal แสดง 6-digit code
      Verify: code เก่า verify ไม่ผ่านทันที (bcrypt ตรวจ hash ใหม่แล้ว)
      Verify: password_updated_at อัปเดต

A0-8. Auto-create pending mapping หลังเช็คอิน Path B
      Input : รปภ ใส่ password ถูก + เลือกชื่อ + เช็คอินสำเร็จ
      Expect: line_mappings record สร้างพร้อม is_verified = false, mapping_method = 'auto_checkin'
      Verify: admin ได้รับ LINE notification "มีคำขอลงทะเบียนใหม่"

A0-9. Pending mapping ซ้ำ
      Input : รปภ เช็คอินด้วย Path B อีกครั้ง (ยังรอ approve อยู่)
      Expect: ไม่สร้าง duplicate record — เช็คอินปกติ ไม่ error

A0-10. Admin approve mapping
       Input : Admin กด [✅ Approve] ใน /admin/line-mapping
       Expect: is_verified = true, LINE push แจ้ง รปภ "ลงทะเบียนเรียบร้อยแล้ว"
       Verify: รปภ เปิด LIFF ครั้งถัดไป → Path A (ไม่เห็น password form อีก)

A0-11. Admin เปลี่ยน guard ก่อน approve
       Input : รปภ เลือกชื่อผิดตอน Path B → admin กด [✏️ เปลี่ยน guard] → เลือกชื่อถูก → approve
       Expect: line_mappings.guard_id = guard ที่ถูกต้อง

A0-12. Admin reject mapping
       Input : Admin กด [❌ Reject]
       Expect: record ถูกลบหรือ flag rejected — ครั้งถัดไป รปภ ยังต้องใส่ password

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE A: CHECK-IN FLOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A1. Guard autocomplete
    Input : พิมพ์ชื่อ/ชื่อเล่นใน LIFF
    Expect: แสดงเฉพาะ guards ที่ employment_status = 'active'
    Verify: guard ที่ resigned/inactive ไม่ปรากฏใน dropdown

A2. Site dropdown — whitelist only
    Input : เลือกชื่อ guard คนใดคนหนึ่ง
    Expect: dropdown แสดงเฉพาะ sites ที่อยู่ใน guard_site_assignments
    Verify: site ที่ไม่ได้ whitelist ไม่ปรากฏ

A3. Primary site auto-select
    Input : guard ที่มี is_primary = true สำหรับ site A
    Expect: site A ถูก auto-select ใน dropdown
    Verify: ไม่ต้องเลื่อนหา

A4. Camera — front-facing, no gallery
    Input : กดถ่ายรูป
    Expect: กล้องหน้าเปิด (capture="user")
    Verify: ไม่มีปุ่มเลือกจาก gallery บนมือถือ

A5. Photo upload
    Input : ถ่ายรูปและกด submit
    Expect: รูปอัปโหลดไป Supabase Storage สำเร็จ
    Verify: URL ใน shift_checkins.checkin_photo_url ไม่เป็น null

A6. Record created — fields ครบ
    Input : submit checkin ปกติ
    Expect: shift_checkins record สร้างพร้อม guard_id, site_id, checkin_at ถูกต้อง
    Verify: SELECT * ดู record ล่าสุด ตรวจทุก field

A7. shift_type calculation
    Input A: checkin เวลา 07:00 → Expect: shift_type = 'day'
    Input B: checkin เวลา 19:00 → Expect: shift_type = 'night'
    Input C: checkin เวลา 06:59 → Expect: shift_type ตาม site config
    Verify: เทียบกับ sites.shift_start_day / shift_start_night

A8. late_minutes calculation
    Input : site shift_start_day = 07:00, checkin_at = 07:22
    Expect: late_minutes = 22, status = 'late'
    Verify: ถ้า checkin_at ≤ shift_start → late_minutes = 0, status = 'on_time'

A9. GPS capture
    Input A: user allow location → Expect: checkin_lat/lng บันทึกได้, checkin_within_site คำนวณจาก haversine
    Input B: user deny location → Expect: lat/lng = null, checkin_within_site = null (ไม่ block checkin)
    Verify: record ที่ checkin_within_site = false แสดง flag ใน dashboard

A10. Multi-shift detection (ใหม่)
    Input A: guard checkin ครั้งที่ 2 ภายใน 24 ชม.
    Expect: consecutive_shifts = 1, P2 alert สร้าง + LINE notify admin
    Input B: guard checkin ครั้งที่ 3 ภายใน 48 ชม.
    Expect: consecutive_shifts = 2, P1 alert สร้าง + LINE notify admin ทันที
    Input C: guard checkin ครั้งที่ 4+
    Expect: consecutive_shifts = N-1, P1 alert พร้อมระบุ "ควงกะ N กะ / X ชม."
    Verify: dashboard แสดง consecutive_shifts และ consecutive_hours ได้ถูกต้อง

A11. Photo routing to client LINE group
    Input : site มี photo_routing.checkin.send_to_client_group = true
    Expect: Flex Message ส่งไปยัง client_line_group_id ภายใน 10 วิ
    Verify: site ที่ photo_routing ว่างหรือ false → ไม่ส่ง (ไม่ error)

A12. Flex message content
    Input : guard มาตรงเวลา / สาย / แทนคนอื่น
    Expect A: on_time → "✅ เข้ากะตรงเวลา" สีเขียว
    Expect B: late 15 นาที → "⚠️ เข้ากะสาย 15 นาที" สีแดง
    Expect C: replacement → "สมชาย (แทน สมศักดิ์)" ระบุชื่อคนที่แทน

A13. Replacement prompt
    Input : guard B checkin ที่ site ที่ guard A ควรอยู่ + guard A มี leave approved วันนั้น
    Expect: ระบบถามยืนยัน "วันนี้กะนี้ตารางเป็นของ [A] — คุณเข้าแทนใช่ไหม?"
    Verify: กด "ใช่" → replacement_for_guard_id = A บันทึก

A14. Duplicate checkin same shift
    Input : guard checkin ซ้ำ กะเดียวกัน วันเดียวกัน ไซต์เดียวกัน
    Expect: ระบบถาม "คุณเช็คอินไปแล้วเวลา {time} ต้องการเช็คอินซ้ำไหม?"
    Verify: ถ้าใช่ → update record เดิม ไม่สร้างใหม่

A15. Success UX
    Input : submit สำเร็จ
    Expect: หน้าสำเร็จแสดง + LIFF ปิดอัตโนมัติภายใน 3 วินาที

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE B: CHECK-OUT FLOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

B1. Update correct record
    Input : guard checkout หลัง checkin วันนั้น
    Expect: อัปเดต shift_checkins record ล่าสุดของ guard+site วันนั้น
    Verify: checkout_at และ checkout_photo_url บันทึกถูก record

B2. Checkout photo required
    Input : submit โดยไม่ถ่ายรูป
    Expect: ไม่สามารถ submit ได้ (ปุ่ม disable)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE C: COMPREFACE FACE VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

C1. Infrastructure
    □ docker compose up -d → 5 containers ขึ้น (compreface-core, api, admin, ui, postgres)
    □ เข้า http://<hetzner-ip>:8000 ได้
    □ สร้าง Face Verification service + copy API key ใส่ .env

C2. Enrollment — รูปดี
    Input : admin upload รูปหน้าชัด ≥ 300×300px
    Expect: POST /api/guards/[id]/enroll-face → face_enrolled = true, face_enrolled_at บันทึก
    Verify: CompreFace มี subject = guard_id

C3. Enrollment — รูปแย่
    Input : รูปมืด/เบลอ/ไม่มีหน้า
    Expect: CompreFace return error → API return 400 + ไม่ set face_enrolled
    Verify: guard.face_enrolled ยังเป็น false

C4. Verification async — ไม่ block checkin
    Input : guard checkin ปกติ
    Expect: checkin response กลับทันที (<5 วิ) ไม่รอ face verify
    Verify: face_similarity เป็น null ตอน response จากนั้น ~2-5 วิ ถึงอัปเดต

C5. Similarity ≥ 0.85 — auto verified
    Input : รูปคนเดียวกับโปรไฟล์
    Expect: face_verified = true, face_verified_by = 'system', badge 🟢

C6. Similarity 0.60–0.84 — uncertain
    Input : รูปใกล้เคียงแต่ไม่แน่ชัด (แสงต่าง/มุมต่าง)
    Expect: face_verified = null, badge 🟡 ใน dashboard รอ admin review

C7. Similarity < 0.60 — mismatch
    Input : รูปคนละคน หรือ ปิดหน้า
    Expect: face_verified = false, badge 🔴, P1 alert สร้าง + LINE push admin
    Verify: alert message ระบุ "similarity: XX%" และ guard name

C8. CompreFace error — graceful fallback
    Input : Hetzner server down หรือ timeout
    Expect: log error, badge ⚪, checkin ไม่ถูก block
    Verify: ไม่มี exception หลุดไปยัง user

C9. Guard ยังไม่ enroll
    Input : guard ที่ face_enrolled = false checkin
    Expect: skip verification ทั้งหมด, badge ⚪
    Verify: ไม่มี API call ไปยัง CompreFace

C10. Admin override
    Input : admin กด [✓ ยืนยันตรง] บน record 🔴
    Expect: face_verified_by = 'admin', face_review_note บันทึก (ถ้ากรอก)
    Verify: badge เปลี่ยนเป็น 🟢 (admin)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE D: LINE WEBHOOK + LAYER 1 ROUTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

D1. Signature verification
    Input : webhook request ที่ X-Line-Signature ไม่ถูกต้อง
    Expect: return 401 ทันที ไม่ process

D2. Unregistered LINE user
    Input : LINE user ที่ไม่มีใน line_mappings
    Expect: reply "คุณยังไม่ได้ลงทะเบียน กรุณาติดต่อผู้จัดการ"
    Verify: ไม่มี Claude call เกิดขึ้น

D3. Inactive guard
    Input : guard ที่ employment_status = 'resigned' ส่งข้อความ
    Expect: reply "บัญชีของคุณไม่ active"

D4–D8. Layer 1 — Exact match
    D4: "ขอลาป่วย" → routeResult = LEAVE_REQUEST → ส่ง Layer 2
    D5: "สาย" → routeResult = LATE_NOTICE → ส่ง Layer 2
    D6: "ลาออก" → routeResult = RESIGNATION → ส่ง Layer 2
    D7: "ตาราง" → routeResult = QUESTION → ส่ง Layer 2
    D8: "โอเค" → routeResult = SECRETARY_SNOOZE → snooze, ไม่ Claude

D9–D11. Layer 1 — Fuzzy match (typo)
    D9: "ขอาลป่วย" (distance 2) → LEAVE_REQUEST
    D10: "ลาป่วยย" (distance 1) → LEAVE_REQUEST
    D11: "ลาอก" (distance 1) → RESIGNATION
    Verify: ไม่มี false positive เช่น "สวัสดี" → IGNORE (ไม่ match)

D12–D14. Layer 1 — Priority ordering
    D12: "ออกจากบ้านแล้วครับ" → LATE_NOTICE ไม่ใช่ RESIGNATION
    D13: "ไม่ทำงานได้วันนี้" → LEAVE_REQUEST ไม่ใช่ RESIGNATION
    D14: "โอเคลาออกครับ" → RESIGNATION (มี keyword ชัด)

D15–D17. Layer 1 — IGNORE → escape hatch
    D15: "สวัสดีครับ" → IGNORE → quick menu reply → ไม่มี Claude call
    D16: "ขอบคุณ" → IGNORE → quick menu reply
    D17: "ก" (< 3 ตัวอักษร) → IGNORE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE E: LEAVE REQUEST FLOW (Layer 2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

E1. สร้าง ticket — happy path
    Input : "ขอลาป่วยพรุ่งนี้ครับ"
    Expect: Layer 1 → LEAVE_REQUEST → Claude extract → insert leave_requests
    Verify: ticket_number = LV-2569-XXXX, status = 'pending', leave_type = 'sick'

E2. AI extract dates
    Input : "ขอลา 20-22 เมษา ลากิจครับ"
    Expect: start_date = 2026-04-20, end_date = 2026-04-22, total_days = 3
    Verify: วันที่แปลงเป็น YYYY-MM-DD ถูกต้อง

E3. ไม่ระบุวันที่ — assume วันถัดไป
    Input : "ขอลาป่วยครับ" (ไม่บอกวัน)
    Expect: start_date = tomorrow, end_date = tomorrow, total_days = 1

E4. วันลาหมด
    Input : guard ที่ sick_remaining = 0 ขอลาป่วย
    Expect: ticket สร้างได้ปกติ แต่ AI reply แจ้ง "⚠️ วันลาป่วยหมดแล้ว"
    Verify: ไม่ block การสร้าง ticket

E5. Confidence < 0.7 — ขอยืนยัน
    Input : "วันนี้ไม่แน่ใจจะไปได้ไหม"
    Expect: Claude confidence < 0.7 → reply "คุณต้องการขอลาใช่ไหมครับ? [ใช่] [ไม่ใช่]"
    Verify: ไม่สร้าง ticket จนกว่าจะยืนยัน

E6. Admin approve via LINE
    Input : admin กดปุ่ม [อนุมัติ ✅] ใน LINE quick reply
    Expect: leave_requests.status = 'approved', push LINE กลับ guard ทันที
    Verify: postback data ถูก parse: action=approve_leave&ticket_id={uuid}

E7. Admin reject via LINE
    Input : admin กดปุ่ม [ไม่อนุมัติ ❌]
    Expect: status = 'rejected', push LINE กลับ guard พร้อมเหตุผล (ถ้ามี)

E8. Duplicate leave dates
    Input : guard ขอลาวันที่ที่มี approved ticket อยู่แล้ว
    Expect: AI แจ้ง "คุณมีวันลาอนุมัติแล้ว {date} ต้องการขอเพิ่มไหม?"

E9. Leave ย้อนหลัง
    Input : "ขอลาเมื่อวาน" หรือวันที่ผ่านมาแล้ว
    Expect: ticket สร้างพร้อม flag "ลาย้อนหลัง", admin ต้องตัดสินใจ

E10. Prompt caching
    Input : Claude call สำหรับ classify-intent
    Expect: request body มี system[] array + cache_control: {type: "ephemeral"}
    Verify: ไม่มี system prompt ปนอยู่ใน messages[0].content

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE F: LEAVE PROTOCOL — SITE NOTIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

F1. Site ไม่มี protocol — ไม่มีผลข้างเคียง
    Input : approve leave ของ site ที่ leave_protocol = {}
    Expect: approve ได้ปกติ ไม่มี LINE push ลูกค้า ไม่มี error

F2. Approve โดยยังไม่มีคนแทน — site มี protocol
    Input : approve leave, replacement_guard_id = null, site มี replacement_notice_hours = 2
    Expect: approve สำเร็จ + admin ได้รับ LINE "⚠️ ยังไม่มีคนแทน [guard] [site]"
    Verify: ไม่ push ลูกค้าก่อน มีคนแทน

F3. Set replacement → auto push ลูกค้า
    Input : admin เลือกคนแทนและกด [ยืนยัน]
    Expect: POST /api/leave/[id]/replacement → LINE push กลุ่มลูกค้าทันที
    Verify: message ใช้ template + variables ครบ (contact_name, date, guard_name ฯลฯ)
    Verify: client_notified = true, client_notified_at บันทึก

F4. Replacement notice hours — deadline reminder
    Input : leave approved, ไม่มีคนแทน, เหลือเวลา ≤ replacement_notice_hours ก่อนกะ
    Expect: Cron no-show-check ส่ง LINE แจ้ง admin ระบุเวลาที่เหลือ
    Verify: Siam(=2ชม.) ≠ Kibun(=4ชม.) — แต่ละ site trigger ต่างเวลา

F5. Site ที่ replacement_notice_hours = null
    Input : leave approved ไม่มีคนแทน
    Expect: ไม่มี reminder เลย (ไม่บังคับ)

F6. Badge บน leave ticket card
    Input : หลัง set replacement + client_notified = true
    Expect: badge เปลี่ยนจาก 🟡 → 🟢

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE G: ALERT ENGINE + CRON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

G1. No-show — P1 alert
    Input : guard ไม่เช็คอินภายใน 15 นาทีหลัง shift_start + ไม่มี leave + ไม่มี late_notice
    Expect: P1 alert สร้าง + LINE push admin ภายใน 15 นาที
    Verify: alert.type = 'NO_SHOW', severity = 'P1'

G2. No-show — มี leave approved
    Input : guard มี leave approved วันนั้น แต่ไม่มีคนแทน
    Expect: ไม่สร้าง NO_SHOW alert แต่สร้าง LEAVE_NO_REPLACEMENT แทน
    Verify: alert type ต่างกัน

G3. No-show — มี late_notice
    Input : guard ส่งข้อความแจ้งมาสายก่อนแล้ว
    Expect: ไม่สร้าง NO_SHOW alert (รอต่อ)

G4. Multi-shift — ควง 2 กะ (P2)
    Input : guard checkin ครั้งที่ 2 โดยยังไม่มี rest period
    Expect: consecutive_shifts = 1, P2 alert, LINE notify admin
    Verify: message ระบุ "ควง 2 กะ / X ชม."

G5. Multi-shift — ควง 3 กะ (P1)
    Input : guard checkin ครั้งที่ 3
    Expect: consecutive_shifts = 2, P1 alert, LINE notify admin ทันที
    Verify: message ระบุ "ควง 3 กะ / X ชม."

G6. Multi-shift — ควง 4+ กะ
    Input : guard checkin ครั้งที่ 4+
    Expect: P1 alert ทุกครั้ง, message ระบุจำนวนกะและชม.สะสม
    Verify: consecutive_hours คำนวณจาก checkin แรกถึง checkin ล่าสุด

G7. DB pre-filter — ไม่เรียก Claude เมื่อไม่มี events
    Input : Cron no-show-check รันแต่ทุก guard เช็คอินครบ
    Expect: return {alerts: [], reason: 'no_events'} — ไม่มี Claude call
    Verify: ตรวจ application log ยืนยันไม่มี Anthropic API call

G8. Batch Claude call — 1 call ต่อ cron run
    Input : 3 guards ไม่เข้ากะพร้อมกัน
    Expect: Claude call = 1 ครั้ง (ส่ง batch)
    Verify: ไม่มี loop ที่เรียก Claude ทีละ guard

G9. Site understaffed
    Input : site ที่ required_guards_day = 3 แต่มี active checkin = 1
    Expect: SITE_UNDERSTAFFED alert P1 สร้าง
    Verify: recommendation ระบุว่าขาดกี่คน

G10. Alert acknowledge
    Input : admin กดปุ่ม [รับทราบ ✅] ใน LINE หรือ dashboard
    Expect: manpower_alerts.acknowledged = true, acknowledged_at บันทึก

G11. Pattern — มาสายบ่อย
    Input : guard มาสาย ≥ 3 ครั้งใน 30 วัน (daily cron 08:00)
    Expect: PATTERN_LATE P2 alert + digest ไป admin

G12. Weekly digest
    Input : Cron จันทร์ 07:00
    Expect: Claude สรุปสัปดาห์ + LINE Flex Message พร้อม action_items[]
    Verify: on_time_rate, late_count, absent_count ถูกต้องจาก DB

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE H: CROSS-CHECK CRON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

H1. Schedule ถูกต้อง
    Input : เวลา 06:30 และ 18:30
    Expect: cron ทำงาน ส่ง summary ไป admin เสมอ

H2. Query filter — เฉพาะที่จำเป็น
    Input : มี 195 messages ใน 12 ชม.
    Expect: query เฉพาะ ai_intent IN ('IGNORE','LEAVE_REQUEST') หรือ null
    Verify: ไม่ดึง messages ทั้งหมด (ตรวจ SQL log)

H3. Gap detected
    Input : guard พิมพ์ "วันนี้ไม่สบายครับ" (IGNORE) แต่ไม่มี leave ticket
    Expect: Claude ระบุ gap + ชื่อ guard + เวลา + คำแนะนำ

H4. ไม่มี gap — ส่ง summary
    Input : ทุก leave ticket ตรงกับ message
    Expect: reply "✅ ครบ" — ยังส่ง LINE เสมอ (ไม่เงียบ)

H5. Pending ticket นาน
    Input : leave ticket pending > 2 ชม.
    Expect: summary ระบุ ticket number + ชม.ที่รอ

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE I: SECRETARY AGENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

I1. Morning briefing 07:00
    Input : Cron จันทร์–อาทิตย์ 07:00
    Expect: Claude output = plain text มี 🔴🟡⚪ sections
    Verify: LINE push ถึง ADMIN_LINE_USER_ID

I2. ไม่มีงานค้าง
    Input : ทุก ticket/alert เคลียร์แล้ว
    Expect: ส่ง "✅ ไม่มีงานค้างครับ" — ไม่เงียบ

I3. Priority ordering ใน briefing
    Input : มีทั้ง P1 alert, pending ticket, และ cross-check gap
    Expect: 🔴 P1 ขึ้นก่อน, 🟡 pending ถัดมา, ⚪ gap สุดท้าย

I4. Realtime ping — P1 alert ไม่ ack
    Input : P1 alert สร้างแล้ว 31 นาที ยังไม่ถูก ack
    Expect: secretary ping LINE admin
    Verify: ไม่ส่งซ้ำถ้ายังอยู่ใน cooldown 2 ชม.

I5. Batch ping — หลาย items
    Input : มี 3 items pending พร้อมกัน
    Expect: รวมเป็น LINE message เดียว ไม่ส่ง 3 ครั้ง

I6. Snooze — "โอเค"
    Input : Suwijak reply "โอเค" หลังได้รับ ping
    Expect: snoozed_until = now + 2 ชม., ไม่มี ping ซ้ำในช่วงนั้น
    Verify: Layer 1 route = SECRETARY_SNOOZE ก่อน RESIGNATION

I7. Snooze — "เดี๋ยวจัดการ"
    Input : Suwijak reply "เดี๋ยวจัดการ"
    Expect: snoozed_until = now + 4 ชม.

I8. Snooze หมดอายุ — ping ใหม่
    Input : snoozed_until ผ่านไปแล้ว และ items ยังค้าง
    Expect: ping ปกติอีกครั้ง

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE J: ADMIN DASHBOARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

J1. Login
    Input : email + password ถูกต้อง
    Expect: redirect ไป /admin/dashboard, BetterAuth session ถูกสร้าง

J2. Login — credentials ผิด
    Input : password ผิด
    Expect: error message แสดง ไม่ redirect

J3. Dashboard stats
    Input : เปิด /admin/dashboard
    Expect: alert count, today shift summary, pending leave count ถูกต้อง

J4. Checkin page — face badge filter
    Input : filter เลือก "รอ review"
    Expect: แสดงเฉพาะ records ที่ face_verified IS NULL หรือ false

J5. Guard CRUD
    Input : สร้าง / แก้ไข / ลบ guard
    Expect: DB อัปเดตถูกต้อง, ถ้า resign → ไม่ปรากฏใน checkin autocomplete

J6. Site CRUD + leave_protocol
    Input : ตั้ง replacement_notice_hours = 3 สำหรับ Siam Clothing
    Expect: บันทึกใน sites.leave_protocol JSONB ถูกต้อง
    Verify: preview message template แสดงผลก่อน save

J7. Guard-site whitelist
    Input : add guard B ไปยัง Kibun
    Expect: guard B ปรากฏใน checkin dropdown เมื่อเลือก Kibun

J8. Leave ticket list — tabs
    Input : เปิด /admin/leave
    Expect: tabs แสดง Pending / Approved(รอคนแทน) / Approved(ครบ) / Rejected / All
    Verify: จำนวนใน tab ตรงกับ DB query

J9. Alert list + filters
    Input : filter by severity = P1, site = Kibun
    Expect: แสดงเฉพาะ P1 alerts ของ Kibun
```

### สรุปจำนวน Test Cases v2.0

| Module | Test Cases | ครอบคลุม |
|--------|-----------|---------|
| A — Check-in | A1–A15 (15 cases) | ทุก field, multi-shift, GPS, replacement |
| B — Check-out | B1–B2 (2 cases) | record update, photo required |
| C — CompreFace | C1–C10 (10 cases) | infra, enroll, similarity tiers, fallback |
| D — Webhook/Layer 1 | D1–D17 (17 cases) | auth, routing, fuzzy, priority, IGNORE |
| E — Leave Flow | E1–E10 (10 cases) | extract, dates, confidence, approve/reject |
| F — Leave Protocol | F1–F6 (6 cases) | per-site config, notice hours, auto-push |
| G — Alert Engine | G1–G12 (12 cases) | no-show, multi-shift, batch, pattern |
| H — Cross-check | H1–H5 (5 cases) | schedule, filter, gap, summary |
| I — Secretary | I1–I8 (8 cases) | briefing, ping, snooze, cooldown |
| J — Admin Dashboard | J1–J9 (9 cases) | auth, CRUD, filters, leave protocol |
| **รวม** | **94 test cases** | |


---

## 28. Database Reference — คำอธิบายและตัวอย่างข้อมูลจริง

> ทุก table ใช้ UUID เป็น primary key และมี `created_at` เสมอ
> Timezone: TIMESTAMPTZ เก็บเป็น UTC ทั้งหมด แสดงผลเป็น Asia/Bangkok (+7)

---

### 28.1 `sites` — ข้อมูลไซต์งาน

**จุดประสงค์:** เก็บข้อมูลของแต่ละสถานที่ที่ รปภ ประจำการ ใช้เป็น config หลักของทุก module

| Column | Type | Description | ตัวอย่าง |
|--------|------|-------------|---------|
| `id` | UUID | Primary key | `a1b2c3d4-...` |
| `name` | VARCHAR(100) | ชื่อเต็มของ site | `Kibun Thailand` |
| `short_name` | VARCHAR(20) | รหัสย่อ (unique) ใช้ใน code | `kibun` |
| `address` | TEXT | ที่อยู่ | `123 ถ.พระราม 2 สมุทรสาคร` |
| `lat` / `lng` | DECIMAL(10,7) | พิกัด GPS ศูนย์กลาง site | `13.5464821` / `100.2876543` |
| `geofence_radius_m` | INT | รัศมีสำหรับตรวจ GPS checkin (เมตร) | `200` |
| `required_guards_day` | INT | จำนวน รปภ ที่ต้องการกะเช้า | `7` |
| `required_guards_night` | INT | จำนวน รปภ ที่ต้องการกะดึก | `7` |
| `shift_start_day` | TIME | เวลาเริ่มกะเช้า | `07:00` |
| `shift_start_night` | TIME | เวลาเริ่มกะดึก | `19:00` |
| `has_shared_device` | BOOLEAN | มีเครื่องรวมสำหรับเช็คอินหรือไม่ | `true` |
| `client_contact_name` | VARCHAR(100) | ชื่อผู้ติดต่อฝั่งลูกค้า | `คุณพลอย` |
| `client_contact_line` | VARCHAR(50) | LINE ID ของผู้ติดต่อ | `@ploykibun` |
| `photo_routing` | JSONB | config การส่งรูปเช็คอินไปกลุ่มลูกค้า | ดูด้านล่าง |
| `leave_protocol` | JSONB | config การแจ้งลูกค้าเมื่อ รปภ ลา | ดูด้านล่าง |
| `checkin_password_hash` | VARCHAR(255) | bcrypt hash ของ 6-digit site password สำหรับ Path B | `$2b$10$...` |
| `password_updated_at` | TIMESTAMPTZ | เวลาที่ generate password ล่าสุด | `2026-04-01 09:00:00+07` |

**ตัวอย่าง `photo_routing`:**
```json
{
  "checkin": {
    "send_to_client_group": true,
    "client_line_group_id": "C_kibun_xxxxx",
    "include_guard_name": true,
    "include_timestamp": true,
    "include_status": true,
    "include_replacement_info": true
  }
}
```

**ตัวอย่าง `leave_protocol`:**
```json
{
  "notify_client_on_leave": true,
  "notify_client_on_replacement": true,
  "client_line_group_id": "C_kibun_xxxxx",
  "replacement_notice_hours": 4,
  "message_template": "เรียนคุณพลอย วันที่ {date} {guard_name} ลา{leave_type} ผู้แทนคือ {replacement_name} จะเข้ากะเวลา {shift_time} ครับ"
}
```

---

### 28.2 `guards` — ข้อมูล รปภ

**จุดประสงค์:** ข้อมูลหลักของ รปภ แต่ละคน รวม Guard Score และ leave balance

| Column | Type | Description | ตัวอย่าง |
|--------|------|-------------|---------|
| `id` | UUID | Primary key | `b2c3d4e5-...` |
| `employee_code` | VARCHAR(10) | รหัสพนักงาน (unique) | `G-001` |
| `full_name` | VARCHAR(100) | ชื่อ-นามสกุล | `สมชาย ใจดี` |
| `nickname` | VARCHAR(50) | ชื่อเล่น ใช้ใน autocomplete | `ชาย` |
| `phone` | VARCHAR(20) | เบอร์โทร | `081-234-5678` |
| `photo_url` | VARCHAR(500) | URL รูปโปรไฟล์ใน Supabase Storage | `https://...` |
| `current_site_id` | UUID (FK→sites) | site ที่ประจำการอยู่ปัจจุบัน | `a1b2c3d4-...` |
| `position` | VARCHAR(20) | ตำแหน่ง | `guard` / `shift_leader` / `patrol` |
| `employment_status` | VARCHAR(20) | สถานะการจ้างงาน | `active` / `resigned` / `terminated` |
| `allow_any_site` | BOOLEAN | อนุญาตให้เช็คอินได้ทุก site (สำหรับสายตรวจ) | `false` |
| `start_date` | DATE | วันเริ่มงาน | `2024-01-15` |
| `end_date` | DATE | วันสิ้นสุดสัญญา (ถ้ามี) | `null` |
| `resignation_date` | DATE | วันที่ลาออกจริง | `null` |
| `guard_score` | INT | คะแนนรวม 0–100 | `87` |
| `leave_balance` | JSONB | วันลาคงเหลือแต่ละประเภท | ดูด้านล่าง |
| `face_enrolled` | BOOLEAN | ลงทะเบียน CompreFace แล้วหรือไม่ | `true` |
| `face_enrolled_at` | TIMESTAMPTZ | เวลาที่ enroll | `2026-04-01 09:00:00+07` |

**ตัวอย่าง `leave_balance`:**
```json
{
  "sick": 27,
  "annual": 6,
  "personal": 2
}
```
*(ลาป่วยไปแล้ว 3 วัน เหลือ 27, ลากิจไปแล้ว 1 วัน เหลือ 2)*

---

### 28.3 `guard_site_assignments` — Whitelist site ของ รปภ

**จุดประสงค์:** กำหนดว่า รปภ แต่ละคนสามารถเช็คอินที่ site ใดได้บ้าง และ site ไหนเป็น primary

| Column | Type | Description | ตัวอย่าง |
|--------|------|-------------|---------|
| `guard_id` | UUID (FK→guards) | รปภ | `b2c3d4e5-...` |
| `site_id` | UUID (FK→sites) | site ที่อนุญาต | `a1b2c3d4-...` |
| `is_primary` | BOOLEAN | เป็น site ประจำหลักหรือไม่ | `true` |

**ตัวอย่าง:** สมชาย (G-001) ประจำ Kibun เป็น primary และสามารถไปช่วย Siam Clothing ได้
```
guard_id=G001, site_id=kibun,        is_primary=true
guard_id=G001, site_id=siam_clothing, is_primary=false
```

---

### 28.4 `shift_checkins` — บันทึกการเช็คอิน/เช็คเอาท์

**จุดประสงค์:** เป็น source of truth ของการมาทำงาน ใช้คำนวณ Guard Score และ alert ทุกประเภท

| Column | Type | Description | ตัวอย่าง |
|--------|------|-------------|---------|
| `guard_id` | UUID (FK→guards) | รปภ ที่เช็คอิน | `b2c3d4e5-...` |
| `site_id` | UUID (FK→sites) | site ที่เช็คอิน | `a1b2c3d4-...` |
| `checkin_at` | TIMESTAMPTZ | เวลาเช็คอิน | `2026-04-02 07:08:00+07` |
| `checkin_photo_url` | VARCHAR(500) | URL รูปเช็คอินใน Storage | `https://...` |
| `checkin_lat` / `checkin_lng` | DECIMAL | GPS ณ เวลาเช็คอิน | `13.5464821` |
| `checkin_within_site` | BOOLEAN | GPS อยู่ในรัศมี geofence หรือไม่ | `true` |
| `checkout_at` | TIMESTAMPTZ | เวลาเช็คเอาท์ (null ถ้ายังไม่เช็คเอาท์) | `2026-04-02 19:05:00+07` |
| `shift_type` | VARCHAR(10) | กะที่ทำงาน | `day` / `night` |
| `status` | VARCHAR(20) | สถานะการมาทำงาน | `on_time` / `late` |
| `late_minutes` | INT | สายกี่นาที (0 ถ้าตรงเวลา) | `8` |
| `consecutive_shifts` | INT | จำนวนกะที่ควงต่อเนื่อง (0=ปกติ) | `0`=ปกติ, `1`=ควง2กะ, `2`=ควง3กะ |
| `consecutive_hours` | INT | ชั่วโมงสะสมที่ทำงานต่อเนื่อง | `24` |
| `is_double_shift` | BOOLEAN | deprecated — ใช้ consecutive_shifts แทน | `false` |
| `replacement_for_guard_id` | UUID (FK→guards) | เข้าแทนใคร (null=เข้าปกติ) | `null` |
| `face_similarity` | DECIMAL(4,3) | คะแนนความเหมือนจาก CompreFace | `0.923` |
| `face_verified` | BOOLEAN | null=รอ, true=ผ่าน, false=ไม่ผ่าน | `true` |
| `face_verified_by` | VARCHAR(10) | ใครยืนยัน | `system` / `admin` |

**ตัวอย่างข้อมูลจริง — ควง 3 กะ:**
```
checkin 1: 2026-04-01 07:05  consecutive_shifts=0, consecutive_hours=0
checkin 2: 2026-04-01 19:02  consecutive_shifts=1, consecutive_hours=12  → P2 alert
checkin 3: 2026-04-02 07:08  consecutive_shifts=2, consecutive_hours=24  → P1 alert "ควง 3 กะ / 24 ชม."
checkin 4: 2026-04-02 19:15  consecutive_shifts=3, consecutive_hours=36  → P1 alert "ควง 4 กะ / 36 ชม."
```

---

### 28.5 `leave_requests` — Ticket ขอลา

**จุดประสงค์:** ทุก leave request จาก รปภ ผ่านระบบนี้ ตั้งแต่ pending จนถึง approved/rejected

| Column | Type | Description | ตัวอย่าง |
|--------|------|-------------|---------|
| `ticket_number` | VARCHAR(20) | เลข ticket (unique, auto-gen) | `LV-2569-0042` |
| `guard_id` | UUID (FK→guards) | รปภ ที่ขอลา | `b2c3d4e5-...` |
| `site_id` | UUID (FK→sites) | site ที่ รปภ ประจำ | `a1b2c3d4-...` |
| `leave_type` | VARCHAR(20) | ประเภทการลา | `sick` / `personal` / `annual` / `urgent` |
| `start_date` | DATE | วันแรกที่ลา | `2026-04-05` |
| `end_date` | DATE | วันสุดท้ายที่ลา | `2026-04-05` |
| `total_days` | INT | จำนวนวันรวม | `1` |
| `original_message` | TEXT | ข้อความต้นฉบับที่ รปภ พิมพ์มา | `"พรุ่งนี้ขอลาป่วยครับ ไม่สบาย"` |
| `ai_interpretation` | JSONB | JSON ที่ Claude extract ออกมา | `{"leave_type":"sick","confidence":0.95,...}` |
| `status` | VARCHAR(20) | สถานะปัจจุบัน | `pending` / `approved` / `rejected` |
| `replacement_guard_id` | UUID (FK→guards) | รปภ ที่เข้าแทน | `null` → `c3d4e5f6-...` |
| `replacement_set_at` | TIMESTAMPTZ | เวลาที่ admin ใส่คนแทน | `2026-04-04 14:30:00+07` |
| `client_notified` | BOOLEAN | แจ้งลูกค้าแล้วหรือยัง | `false` → `true` |
| `client_notified_at` | TIMESTAMPTZ | เวลาที่แจ้งลูกค้า | `2026-04-04 14:31:00+07` |

**ตัวอย่าง flow ของ ticket 1 ใบ:**
```
สร้าง:   status=pending, replacement=null, client_notified=false
Approve: status=approved (ยังไม่มีคนแทน) → alert admin
Set คนแทน: replacement=G-005, replacement_set_at=14:30
Auto push: client_notified=true, client_notified_at=14:31
```

---

### 28.6 `manpower_alerts` — การแจ้งเตือน

**จุดประสงค์:** เก็บทุก alert ที่ระบบสร้าง ทั้งที่มาจาก AI และ rule-based

| Column | Type | Description | ตัวอย่าง |
|--------|------|-------------|---------|
| `type` | VARCHAR(30) | ประเภท alert | `NO_SHOW` / `MULTI_SHIFT` / `FACE_MISMATCH` / `SITE_UNDERSTAFFED` |
| `severity` | VARCHAR(5) | ความเร่งด่วน | `P1` (ทันที) / `P2` (ควรทราบ) |
| `site_id` | UUID (FK→sites) | site ที่เกิดเหตุ | `a1b2c3d4-...` |
| `guard_id` | UUID (FK→guards) | รปภ ที่เกี่ยวข้อง | `b2c3d4e5-...` |
| `message` | TEXT | ข้อความแจ้งเตือนภาษาไทย | `สมชาย ไม่เข้ากะเช้า Kibun (ผ่านมา 15 นาทีแล้ว)` |
| `recommendation` | TEXT | คำแนะนำจาก AI | `โทรหาสมชาย หรือหาคนแทนจากไซต์ใกล้เคียง` |
| `acknowledged` | BOOLEAN | admin รับทราบแล้วหรือยัง | `false` |
| `acknowledged_at` | TIMESTAMPTZ | เวลาที่ admin กด ack | `null` |

**ตัวอย่าง alert ควง 3 กะ:**
```json
{
  "type": "MULTI_SHIFT",
  "severity": "P1",
  "message": "สมชาย (G-001) ควง 3 กะ / 24 ชม. — Kibun",
  "recommendation": "ให้หยุดพักทันที หาคนมาแทนกะดึก"
}
```

---

### 28.7 `conversations` — Log ข้อความทั้งหมดใน LINE OA

**จุดประสงค์:** เก็บทุก message ที่ รปภ ส่งมา พร้อม intent ที่ Layer 1 และ Claude classify ไว้ ใช้สำหรับ cross-check cron

| Column | Type | Description | ตัวอย่าง |
|--------|------|-------------|---------|
| `line_user_id` | VARCHAR(50) | LINE user ID ของผู้ส่ง | `U1234abcd...` |
| `guard_id` | UUID (FK→guards) | guard ที่ map กับ LINE user นี้ | `b2c3d4e5-...` |
| `message_text` | TEXT | ข้อความต้นฉบับ | `"พรุ่งนี้ไม่สบายครับ"` |
| `ai_intent` | VARCHAR(30) | intent ที่ classify ได้ | `IGNORE` / `LEAVE_REQUEST` / `LATE_NOTICE` |
| `ai_confidence` | DECIMAL(3,2) | ความมั่นใจของ Claude (0–1) | `0.92` |
| `action_taken` | VARCHAR(50) | action ที่ระบบทำ | `created_leave_ticket` / `ignored` |

**ทำไม `ai_intent = 'IGNORE'` สำคัญ:**
Cross-check cron ดึง records ที่ `ai_intent = 'IGNORE'` มาวิเคราะห์ว่ามีข้อความใดที่ควรเป็นการขอลาแต่หลุดผ่าน Layer 1 ไปหรือไม่

---

### 28.9 `line_mappings` — การผูก LINE account กับ guard

**จุดประสงค์:** ควบคุม identity ของผู้ใช้ LIFF — verified = true คือผ่าน Path A (ไม่ต้องใส่ password)

| Column | Type | Description | ตัวอย่าง |
|--------|------|-------------|---------|
| `line_user_id` | VARCHAR(50) | LINE userId (unique) | `U1234abcd...` |
| `guard_id` | UUID (FK→guards) | guard ที่ map | `b2c3d4e5-...` |
| `display_name` | VARCHAR(100) | ชื่อที่แสดงใน LINE | `สมชาย` |
| `mapped_by` | UUID | admin ที่ approve | `admin_uuid` |
| `is_verified` | BOOLEAN | false=pending, true=ใช้ Path A ได้ | `true` |
| `site_id` | UUID (FK→sites) | site ที่ใช้ password ตรง (Path B) | `a1b2c3d4-...` |
| `mapping_method` | VARCHAR(20) | วิธีที่สร้าง mapping | `auto_checkin` / `line_message` / `admin_link` |

**ตัวอย่าง lifecycle:**
```
Path B เช็คอิน: is_verified=false, method='auto_checkin' → รอ admin
Admin approve:  is_verified=true                          → ใช้ Path A ได้
```

---

### 28.8 `secretary_pings` — Log การ ping ของ Secretary Agent

**จุดประสงค์:** ป้องกัน notification flood โดยเก็บเวลาที่ ping ล่าสุดและ snooze status

| Column | Type | Description | ตัวอย่าง |
|--------|------|-------------|---------|
| `pinged_at` | TIMESTAMPTZ | เวลาที่ส่ง ping | `2026-04-02 10:30:00+07` |
| `items_count` | INT | จำนวน pending items ใน ping นั้น | `3` |
| `items_summary` | JSONB | snapshot ของ items | `[{"type":"leave","ticket":"LV-0042"},...]` |
| `snoozed_until` | TIMESTAMPTZ | หยุด ping จนถึงเมื่อไหร่ | `2026-04-02 12:30:00+07` |

---

---

## 29. API Routes — วิธีทำงานของแต่ละ Route

> แต่ละ route ระบุ: method, path, ใครเรียก, input, output, และ side effects

---

### 29.1 POST `/api/line/webhook`

**ใครเรียก:** LINE Platform (auto, ทุกครั้งที่มี event)
**Auth:** verify X-Line-Signature header ด้วย LINE_CHANNEL_SECRET

```
Flow:
1. verify signature → ถ้าผิด return 401
2. loop events:
   a. follow → สร้าง pending line_mapping + notify admin
   b. message.text → lookup guard → Layer 1 route → action
   c. postback → parse action= → approve/reject/ack (ไม่ใช้ Claude)
   d. unfollow → log
3. return 200 OK เสมอ (LINE ต้องการ 200 ไม่งั้น retry)
```

**Side effects:** อาจสร้าง leave_request, conversation log, secretary snooze, LINE push กลับ

---

### 29.2 POST `/api/checkin`

**ใครเรียก:** LIFF page `/liff/checkin` เมื่อ รปภ กด submit
**Auth:** ไม่ต้องการ (ใช้ชื่อ + รูปแทน)

```
Input:
  guard_id, site_id, photo (multipart), lat?, lng?

Flow:
1. validate guard active + site whitelisted
2. upload photo → Supabase Storage
3. calculate: shift_type, status, late_minutes
4. calculate: consecutive_shifts, consecutive_hours (ดู checkins 48 ชม.ย้อนหลัง)
5. check replacement prompt (ถ้ามี leave approved วันนั้น)
6. insert shift_checkins record
7. [async] photo routing → push LINE กลุ่มลูกค้า (ถ้า config เปิด)
8. [async] face verification → CompreFace → update face fields
9. [sync] create MULTI_SHIFT alert ถ้า consecutive_shifts ≥ 1
10. return { ok: true, checkinId }

Output: { ok: true, checkinId: uuid }
Side effects: shift_checkins record, optional LINE push, optional alert
```

---

### 29.3 POST `/api/ai/classify-intent`

**ใครเรียก:** webhook handler (หลังผ่าน Layer 1 แล้ว)
**Auth:** internal only (ไม่ expose ออก public)

```
Input:
  { routeResult, messageText, guardContext }

Flow:
1. build system prompt (cached) + user message (dynamic)
2. call Claude API (claude-sonnet-4-20250514)
3. parse JSON response: intent, confidence, entities, reply_message
4. return structured result

Output: { intent, confidence, entities, reply_message }
Side effects: ไม่มี (pure function — caller รับผิดชอบ action)
```

---

### 29.4 GET `/api/cron/no-show-check`

**ใครเรียก:** Vercel Cron ทุก 15 นาที ช่วง 05:00–08:00 และ 17:00–20:00
**Auth:** Authorization: Bearer {CRON_SECRET}

```
Flow:
1. determine current shift type + shift_start time
2. ถ้าเวลาปัจจุบัน < shift_start + 15 นาที → return early
3. [Layer 1] query DB หา missing guards:
   SELECT guards ที่ควรมา แต่ไม่มี checkin + ไม่มี leave approved + ไม่มี late_notice
4. ถ้า missing = 0 → return { alerts: [], reason: 'no_events' }
5. query guard_stats 90 วัน สำหรับ missing guards
6. [Layer 2] 1 Claude call (batch ทั้งหมด)
7. insert manpower_alerts + LINE push admin
8. ตรวจ leave_no_replacement: approved leave + ไม่มีคนแทน + ≤ replacement_notice_hours
9. return { alerts_created: N }
```

---

### 29.5 GET `/api/cron/cross-check`

**ใครเรียก:** Vercel Cron 06:30 และ 18:30 ทุกวัน
**Auth:** Authorization: Bearer {CRON_SECRET}

```
Flow:
1. กำหนด window = now - 12 ชม.
2. [Layer 1 filter] query conversations:
   WHERE created_at >= window
   AND (ai_intent = 'IGNORE' OR ai_intent IS NULL OR ai_intent = 'LEAVE_REQUEST')
   → ได้ ~30–50 rows (จาก ~195 ทั้งหมด)
3. query leave_requests ช่วงเดียวกัน
4. [Layer 2] 1 Claude call: cross-check message vs tickets
5. parse JSON: { gaps[], pending_long[], summary_th }
6. LINE push summary ไป admin เสมอ (แม้ gaps = [])
7. return { gaps_found: N, summary_sent: true }
```

---

### 29.6 POST `/api/leave/[id]/replacement`

**ใครเรียก:** Admin กด [ยืนยันคนแทน] ใน dashboard
**Auth:** BetterAuth admin session required

```
Input:
  { replacementGuardId: uuid }

Flow:
1. load ticket + site.leave_protocol
2. update leave_requests:
   replacement_guard_id, replacement_confirmed=true, replacement_set_at=now
3. if leave_protocol.notify_client_on_replacement AND client_line_group_id:
   a. build message จาก template + variables
   b. LINE push ไป client_line_group_id
   c. update: client_notified=true, client_notified_at=now
4. return { ok: true, client_notified: boolean }

Output: { ok: true, client_notified: true/false }
Side effects: leave_requests อัปเดต, optional LINE push ลูกค้า
```

---

### 29.7 POST `/api/guards/[id]/enroll-face`

**ใครเรียก:** Admin กด upload profile photo ตอน onboard
**Auth:** BetterAuth admin session required

```
Input:
  multipart/form-data { photo: file }

Flow:
1. validate file type (jpg/png) + size (≤ 5MB)
2. compress image (sharp)
3. POST to CompreFace: /api/v1/recognition/faces?subject={guard_id}
4. ถ้า CompreFace detect ไม่เจอหน้า → return 400 "ไม่พบใบหน้าในรูป"
5. update guards: face_enrolled=true, face_enrolled_at=now
6. return { ok: true }
```

---

### 29.8 POST `/api/secretary/ping`

**ใครเรียก:** เรียกจาก modules อื่น (no-show-check, leave review) เมื่อต้องการแจ้ง admin
**Auth:** internal only

```
Flow:
1. load secretary_pings ล่าสุด
2. ถ้า snoozed_until > now → return { skipped: true, reason: 'snoozed' }
3. ถ้า pinged_at ล่าสุด < 2 ชม. ที่แล้ว → return { skipped: true, reason: 'cooldown' }
4. collectPendingItems():
   - leave pending > 2 ชม.
   - P1 alerts ไม่ ack > 30 นาที
   - replacement ไม่มี + ใกล้ notice hours
   - cross-check gaps ที่ยังไม่ action
5. ถ้า items = 0 → return { skipped: true, reason: 'no_items' }
6. Claude call: generateBriefing(items) → plain text
7. LINE push ไป ADMIN_LINE_USER_ID
8. insert secretary_pings record
9. return { sent: true, items_count: N }
```

---

