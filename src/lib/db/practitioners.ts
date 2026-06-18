import type { Practitioner } from './schema';

export interface PractitionerWithCount {
  id: string;
  name: string;
  specialty: string;
  availableSlotCount: number;
  fullyBooked: boolean;
}

export async function listPractitionersWithCounts(
  db: D1Database,
  date: string,
  bookingsOpen: boolean,
  currentHHMM: string,
): Promise<PractitionerWithCount[]> {
  const practitioners = await db.prepare(
    'SELECT * FROM practitioners ORDER BY created_at ASC'
  ).all<Practitioner>();

  const results = await Promise.all(practitioners.results.map(async (p) => {
    // Total slots for today (any status) — used to detect "no slots configured"
    const totalRow = await db.prepare(
      'SELECT COUNT(*) as count FROM slots WHERE practitioner_id = ? AND day_date = ?'
    ).bind(p.id, date).first<{ count: number }>();
    const totalSlots = totalRow?.count ?? 0;

    // No slots at all → don't show the practitioner
    if (totalSlots === 0) return null;

    if (!bookingsOpen) {
      return { id: p.id, name: p.name, specialty: p.specialty, availableSlotCount: 0, fullyBooked: false };
    }

    // Future unbooked slots (local time comparison)
    const row = await db.prepare(
      'SELECT COUNT(*) as count FROM slots WHERE practitioner_id = ? AND day_date = ? AND booking_id IS NULL AND start_time > ?'
    ).bind(p.id, date, currentHHMM).first<{ count: number }>();
    const availableSlotCount = row?.count ?? 0;

    return { id: p.id, name: p.name, specialty: p.specialty, availableSlotCount, fullyBooked: availableSlotCount === 0 };
  }));

  return results.filter((r): r is PractitionerWithCount => r !== null);
}

export function generateToken(): string {
  return crypto.randomUUID();
}

export async function listPractitioners(db: D1Database): Promise<Practitioner[]> {
  const result = await db.prepare(
    'SELECT * FROM practitioners ORDER BY created_at ASC'
  ).all<Practitioner>();
  return result.results;
}

export async function createPractitioner(
  db: D1Database,
  data: { name: string; specialty: string; slot_duration_minutes: number }
): Promise<Practitioner> {
  const id = crypto.randomUUID();
  const token = generateToken();
  const created_at = new Date().toISOString();
  await db.prepare(
    'INSERT INTO practitioners (id, name, specialty, slot_duration_minutes, token, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, data.name, data.specialty, data.slot_duration_minutes, token, created_at).run();
  return { id, name: data.name, specialty: data.specialty, slot_duration_minutes: data.slot_duration_minutes, token, created_at };
}

export async function updatePractitioner(
  db: D1Database,
  id: string,
  data: { name?: string; specialty?: string; slot_duration_minutes?: number }
): Promise<Practitioner | null> {
  const existing = await db.prepare(
    'SELECT * FROM practitioners WHERE id = ?'
  ).bind(id).first<Practitioner>();
  if (!existing) return null;
  const name = data.name ?? existing.name;
  const specialty = data.specialty ?? existing.specialty;
  const slot_duration_minutes = data.slot_duration_minutes ?? existing.slot_duration_minutes;
  await db.prepare(
    'UPDATE practitioners SET name = ?, specialty = ?, slot_duration_minutes = ? WHERE id = ?'
  ).bind(name, specialty, slot_duration_minutes, id).run();
  return { ...existing, name, specialty, slot_duration_minutes };
}

export async function deletePractitioner(
  db: D1Database,
  id: string
): Promise<'ok' | 'has_bookings' | 'not_found'> {
  const existing = await db.prepare(
    'SELECT id FROM practitioners WHERE id = ?'
  ).bind(id).first();
  if (!existing) return 'not_found';

  const booked = await db.prepare(
    'SELECT COUNT(*) as count FROM slots WHERE practitioner_id = ? AND booking_id IS NOT NULL'
  ).bind(id).first<{ count: number }>();
  if (booked && booked.count > 0) return 'has_bookings';

  await db.batch([
    db.prepare('DELETE FROM slots WHERE practitioner_id = ? AND booking_id IS NULL').bind(id),
    db.prepare('DELETE FROM availability_windows WHERE practitioner_id = ?').bind(id),
    db.prepare('DELETE FROM practitioners WHERE id = ?').bind(id),
  ]);
  return 'ok';
}
