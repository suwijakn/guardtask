// Claude API helpers + routeMessage() Layer 1 + fuzzy match

// Layer 1 routing keywords
const LEAVE_KEYWORDS = ['ลา', 'หยุด', 'ไม่มา', 'ไม่สบาย', 'ขอลา'];
const LATE_KEYWORDS = ['สาย', 'ไปไม่ทัน', 'รถติด'];
const RESIGN_KEYWORDS = ['ลาออก', 'ออกจากงาน', 'ไม่ทำแล้ว'];
const QUESTION_KEYWORDS = ['กะ', 'ตาราง', 'เหลือกี่วัน'];
const SNOOZE_KEYWORDS = ['โอเค', 'เดี๋ยวจัดการ'];

export function routeMessage(text: string): string {
  const normalized = text.toLowerCase().trim();
  
  if (normalized.length < 3) return 'IGNORE';
  
  // Check each category
  if (LEAVE_KEYWORDS.some(k => normalized.includes(k))) return 'LEAVE_REQUEST';
  if (LATE_KEYWORDS.some(k => normalized.includes(k))) return 'LATE_NOTICE';
  if (RESIGN_KEYWORDS.some(k => normalized.includes(k))) return 'RESIGNATION';
  if (QUESTION_KEYWORDS.some(k => normalized.includes(k))) return 'QUESTION';
  if (SNOOZE_KEYWORDS.some(k => normalized.includes(k))) return 'SECRETARY_SNOOZE';
  
  return 'IGNORE';
}

// TODO: Implement Claude API helpers
