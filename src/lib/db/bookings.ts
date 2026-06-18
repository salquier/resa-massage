import type { Booking } from './schema';

export interface BookingDetails {
  id: string;
  token: string;
  slot_id: string;
  practitioner_name: string;
  specialty: string;
  slot_date: string;       // YYYY-MM-DD
  slot_start_time: string; // HH:MM
  slot_end_time: string;   // HH:MM
}

export async function getBookingWithDetails(db: D1Database, bookingId: string): Promise<BookingDetails | null> {
  return db.prepare(`
    SELECT b.id, b.token, b.slot_id,
           p.name as practitioner_name, p.specialty,
           s.day_date as slot_date, s.start_time as slot_start_time, s.end_time as slot_end_time
    FROM bookings b
    JOIN practitioners p ON b.practitioner_id = p.id
    JOIN slots s ON b.slot_id = s.id
    WHERE b.id = ?
  `).bind(bookingId).first<BookingDetails>();
}

export async function createBooking(
  db: D1Database,
  data: { id: string; token: string; participantName: string; phone: string; practitionerId: string; slotId: string }
): Promise<Booking> {
  const created_at = new Date().toISOString();
  await db.prepare(
    'INSERT INTO bookings (id, token, participant_name, phone, practitioner_id, slot_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(data.id, data.token, data.participantName, data.phone, data.practitionerId, data.slotId, created_at).run();
  return {
    id: data.id,
    token: data.token,
    participant_name: data.participantName,
    phone: data.phone,
    practitioner_id: data.practitionerId,
    slot_id: data.slotId,
    created_at,
  };
}

export async function checkActiveBooking(db: D1Database, phone: string, date: string): Promise<boolean> {
  const row = await db.prepare(
    'SELECT b.id FROM bookings b JOIN slots s ON b.slot_id = s.id WHERE b.phone = ? AND s.day_date = ?'
  ).bind(phone, date).first();
  return row !== null;
}

export async function getBookingByToken(db: D1Database, token: string): Promise<Booking | null> {
  return db.prepare('SELECT * FROM bookings WHERE token = ?').bind(token).first<Booking>();
}

export function deleteBookingStmt(db: D1Database, id: string): D1PreparedStatement {
  return db.prepare('DELETE FROM bookings WHERE id = ?').bind(id);
}
