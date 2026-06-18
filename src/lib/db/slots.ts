import type { Practitioner, Slot } from './schema';

export interface ScheduleSlot {
  id: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
  participant_name: string | null;
}

export async function getScheduleWithBookings(
  db: D1Database,
  practitionerId: string,
  date: string
): Promise<ScheduleSlot[]> {
  const result = await db.prepare(`
    SELECT s.id, s.start_time, s.end_time,
           CASE WHEN s.booking_id IS NOT NULL THEN 1 ELSE 0 END as is_booked,
           b.participant_name
    FROM slots s
    LEFT JOIN bookings b ON s.booking_id = b.id
    WHERE s.practitioner_id = ? AND s.day_date = ?
    ORDER BY s.start_time ASC
  `).bind(practitionerId, date).all<{ id: string; start_time: string; end_time: string; is_booked: number; participant_name: string | null }>();
  return result.results.map(r => ({
    id: r.id,
    start_time: r.start_time,
    end_time: r.end_time,
    is_booked: r.is_booked === 1,
    participant_name: r.participant_name ?? null,
  }));
}

export interface PractitionerSchedule {
  practitionerId: string;
  practitionerName: string;
  specialty: string;
  fullyBooked: boolean;
  slots: ScheduleSlot[];
}

export async function getAllSchedules(db: D1Database, date: string): Promise<PractitionerSchedule[]> {
  const practitioners = await db.prepare(
    'SELECT * FROM practitioners ORDER BY name ASC'
  ).all<Practitioner>();

  return Promise.all(practitioners.results.map(async (p) => {
    const slots = await getScheduleWithBookings(db, p.id, date);
    const fullyBooked = slots.length > 0 && slots.every(s => s.is_booked);
    return {
      practitionerId: p.id,
      practitionerName: p.name,
      specialty: p.specialty,
      fullyBooked,
      slots,
    };
  }));
}

export interface SlotInsert {
  id: string;
  practitioner_id: string;
  day_date: string;
  start_time: string;
  end_time: string;
}

export async function getAvailableSlotsForDay(
  db: D1Database,
  practitionerId: string,
  date: string
): Promise<Slot[]> {
  const result = await db.prepare(
    'SELECT * FROM slots WHERE practitioner_id = ? AND day_date = ? AND booking_id IS NULL AND start_time >= ? ORDER BY start_time ASC'
  ).bind(practitionerId, date, '08:00').all<Slot>();
  return result.results;
}

export async function getBookedSlotsForDay(
  db: D1Database,
  practitionerId: string,
  date: string
): Promise<Slot[]> {
  const result = await db.prepare(
    'SELECT * FROM slots WHERE practitioner_id = ? AND day_date = ? AND booking_id IS NOT NULL ORDER BY start_time ASC'
  ).bind(practitionerId, date).all<Slot>();
  return result.results;
}

export function deleteUnbookedSlotsStmt(
  db: D1Database,
  practitionerId: string,
  date: string
): D1PreparedStatement {
  return db.prepare(
    'DELETE FROM slots WHERE practitioner_id = ? AND day_date = ? AND booking_id IS NULL'
  ).bind(practitionerId, date);
}

export function insertSlotStmt(db: D1Database, slot: SlotInsert): D1PreparedStatement {
  return db.prepare(
    'INSERT INTO slots (id, practitioner_id, day_date, start_time, end_time, booking_id) VALUES (?, ?, ?, ?, ?, NULL)'
  ).bind(slot.id, slot.practitioner_id, slot.day_date, slot.start_time, slot.end_time);
}

export async function claimSlotTransactional(
  db: D1Database,
  slotId: string,
  bookingId: string
): Promise<'ok' | 'slot_taken'> {
  const result = await db.batch([
    db.prepare(
      'UPDATE slots SET booking_id = ? WHERE id = ? AND booking_id IS NULL'
    ).bind(bookingId, slotId),
  ]);
  return result[0].meta.changes > 0 ? 'ok' : 'slot_taken';
}

export async function releaseSlot(db: D1Database, slotId: string): Promise<void> {
  await db.prepare('UPDATE slots SET booking_id = NULL WHERE id = ?').bind(slotId).run();
}

export function releaseSlotStmt(db: D1Database, slotId: string): D1PreparedStatement {
  return db.prepare('UPDATE slots SET booking_id = NULL WHERE id = ?').bind(slotId);
}

export async function getPractitionerDaySchedule(
  db: D1Database,
  practitionerId: string,
  date: string
): Promise<Slot[]> {
  const result = await db.prepare(
    'SELECT * FROM slots WHERE practitioner_id = ? AND day_date = ? ORDER BY start_time ASC'
  ).bind(practitionerId, date).all<Slot>();
  return result.results;
}
