import type { SmsJob } from './schema';

export interface PendingJobWithContext {
  id: string;
  booking_id: string;
  type: 'confirmation' | 'reminder' | 'practitioner_trigger';
  scheduled_at: string;
  phone: string | null;
  participant_name: string;
  practitioner_name: string;
  slot_start_time: string;
  booking_token: string;
}

export async function createSmsJob(
  db: D1Database,
  data: { bookingId: string; type: 'confirmation' | 'reminder' | 'practitioner_trigger'; scheduledAt: string }
): Promise<SmsJob> {
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  await db.prepare(
    'INSERT INTO sms_jobs (id, booking_id, type, status, scheduled_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, data.bookingId, data.type, 'pending', data.scheduledAt, created_at).run();
  return { id, booking_id: data.bookingId, type: data.type, status: 'pending', scheduled_at: data.scheduledAt, created_at };
}

export async function getPendingJobs(db: D1Database): Promise<PendingJobWithContext[]> {
  const result = await db.prepare(`
    SELECT sj.id, sj.booking_id, sj.type, sj.scheduled_at,
           b.phone, b.participant_name, b.token as booking_token,
           p.name as practitioner_name,
           s.start_time as slot_start_time
    FROM sms_jobs sj
    JOIN bookings b ON sj.booking_id = b.id
    JOIN slots s ON b.slot_id = s.id
    JOIN practitioners p ON b.practitioner_id = p.id
    WHERE sj.status = 'pending'
    ORDER BY sj.scheduled_at ASC
  `).all<PendingJobWithContext>();
  return result.results;
}

export async function confirmJob(db: D1Database, jobId: string): Promise<void> {
  await db.prepare(
    "UPDATE sms_jobs SET status = 'sent' WHERE id = ?"
  ).bind(jobId).run();
}

export function cancelJobsForBooking(db: D1Database, bookingId: string): D1PreparedStatement {
  return db.prepare(
    "UPDATE sms_jobs SET status = 'cancelled' WHERE booking_id = ? AND status = 'pending'"
  ).bind(bookingId);
}

export async function deletePhoneIfLastJob(db: D1Database, bookingId: string): Promise<void> {
  const pending = await db.prepare(
    "SELECT COUNT(*) as count FROM sms_jobs WHERE booking_id = ? AND status = 'pending'"
  ).bind(bookingId).first<{ count: number }>();
  if ((pending?.count ?? 1) === 0) {
    await db.prepare('UPDATE bookings SET phone = NULL WHERE id = ?').bind(bookingId).run();
  }
}
