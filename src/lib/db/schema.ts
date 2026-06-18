export interface Practitioner {
  id: string;
  name: string;
  specialty: string;
  slot_duration_minutes: number;
  token: string;
  created_at: string; // ISO 8601
}

export interface AvailabilityWindow {
  id: string;
  practitioner_id: string;
  day_date: string;   // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
}

export interface Slot {
  id: string;
  practitioner_id: string;
  day_date: string;   // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
  booking_id: string | null; // null = available
}

export interface Booking {
  id: string;
  token: string;
  participant_name: string;
  phone: string | null; // null after RGPD deletion
  practitioner_id: string;
  slot_id: string;
  created_at: string; // ISO 8601
}

export interface SmsJob {
  id: string;
  booking_id: string;
  type: 'confirmation' | 'reminder' | 'practitioner_trigger';
  status: 'pending' | 'sent' | 'cancelled';
  scheduled_at: string; // ISO 8601
  created_at: string;   // ISO 8601
}

export interface SmsConfig {
  id: 1; // always 1 — single-row config table
  confirmation_enabled: number;          // 0 | 1
  reminder_enabled: number;             // 0 | 1
  practitioner_trigger_enabled: number; // 0 | 1
}
