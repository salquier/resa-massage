import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdmin } from '../../../../../lib/admin-auth';
import { generateSlots } from '../../../../../lib/slot-generator';
import {
  getWindowsForDay,
  deleteWindowsForDayStmt,
  insertWindowStmt,
} from '../../../../../lib/db/availability-windows';
import {
  getBookedSlotsForDay,
  deleteUnbookedSlotsStmt,
  insertSlotStmt,
} from '../../../../../lib/db/slots';
import type { Practitioner } from '../../../../../lib/db/schema';

function slotFitsInWindows(
  slotStart: string,
  slotEnd: string,
  windows: { start_time: string; end_time: string }[]
): boolean {
  return windows.some(w => w.start_time <= slotStart && slotEnd <= w.end_time);
}

export const GET: APIRoute = async ({ request, params }) => {
  const authError = await requireAdmin(request, env);
  if (authError) return authError;

  const url = new URL(request.url);
  const date = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const db = env.DB;
  const practitionerId = params.id!;

  try {
    const [windows, slots] = await Promise.all([
      getWindowsForDay(db, practitionerId, date),
      db.prepare('SELECT * FROM slots WHERE practitioner_id = ? AND day_date = ? ORDER BY start_time ASC')
        .bind(practitionerId, date).all(),
    ]);
    return new Response(
      JSON.stringify({ data: { windows: windows, slots: slots.results } }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const PUT: APIRoute = async ({ request, params }) => {
  const authError = await requireAdmin(request, env);
  if (authError) return authError;

  try {
    const { date, windows } = await request.json() as {
      date: string;
      windows: { start_time: string; end_time: string }[];
    };

    const db = env.DB;
    const practitionerId = params.id!;

    const practitioner = await db.prepare(
      'SELECT * FROM practitioners WHERE id = ?'
    ).bind(practitionerId).first<Practitioner>();

    if (!practitioner) {
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Practitioner not found' } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check booked slot conflicts
    const bookedSlots = await getBookedSlotsForDay(db, practitionerId, date);
    const hasConflict = bookedSlots.some(
      s => !slotFitsInWindows(s.start_time, s.end_time, windows)
    );
    if (hasConflict) {
      return new Response(
        JSON.stringify({ error: { code: 'SLOTS_CONFLICT', message: 'Booked slots fall outside the new availability windows' } }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate new slots (pure function)
    const windowsForGenerator = windows.map((w, i) => ({
      id: `tmp-${i}`,
      practitioner_id: practitionerId,
      day_date: date,
      start_time: w.start_time,
      end_time: w.end_time,
    }));
    const generatedSlots = generateSlots(
      windowsForGenerator,
      practitioner.slot_duration_minutes,
      date
    );

    // Build batch statements
    const windowStmts = windows.map(w =>
      insertWindowStmt(db, {
        id: crypto.randomUUID(),
        practitioner_id: practitionerId,
        day_date: date,
        start_time: w.start_time,
        end_time: w.end_time,
      })
    );
    const slotStmts = generatedSlots.map(s =>
      insertSlotStmt(db, {
        id: crypto.randomUUID(),
        practitioner_id: practitionerId,
        day_date: date,
        start_time: s.startTime,
        end_time: s.endTime,
      })
    );

    // Atomic: delete old unbooked slots + delete old windows + insert new windows + insert new slots
    await db.batch([
      deleteUnbookedSlotsStmt(db, practitionerId, date),
      deleteWindowsForDayStmt(db, practitionerId, date),
      ...windowStmts,
      ...slotStmts,
    ]);

    return new Response(
      JSON.stringify({ data: { slots: generatedSlots, count: generatedSlots.length } }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
