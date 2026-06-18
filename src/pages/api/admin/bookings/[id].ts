import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdmin } from '../../../../lib/admin-auth';
import { cancelJobsForBooking } from '../../../../lib/db/sms-jobs';
import { releaseSlotStmt } from '../../../../lib/db/slots';
import { deleteBookingStmt } from '../../../../lib/db/bookings';

function reminderScheduledAt(dayDate: string, startTime: string): string {
  const [h, m] = startTime.split(':').map(Number);
  const total = h * 60 + m - 5;
  const rh = Math.max(0, Math.floor(total / 60));
  const rm = Math.max(0, total % 60);
  return `${dayDate}T${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}:00.000Z`;
}

export const PATCH: APIRoute = async ({ request, params }) => {
  const authError = await requireAdmin(request, env);
  if (authError) return authError;

  const bookingId = params.id!;

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Phone correction branch
    if ('phone' in body) {
      const phone = String(body.phone ?? '').trim();
      if (!phone) {
        return new Response(
          JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'phone is required' } }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const result = await env.DB.prepare(
        'UPDATE bookings SET phone = ? WHERE id = ?'
      ).bind(phone, bookingId).run();
      if (result.meta.changes === 0) {
        return new Response(
          JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Booking not found' } }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ data: { ok: true } }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Move branch
    if ('slotId' in body) {
      const newSlotId = String(body.slotId ?? '').trim();
      if (!newSlotId) {
        return new Response(
          JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'slotId is required' } }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Get current booking
      const booking = await env.DB.prepare(
        'SELECT id, slot_id FROM bookings WHERE id = ?'
      ).bind(bookingId).first<{ id: string; slot_id: string }>();
      if (!booking) {
        return new Response(
          JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Booking not found' } }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Check new slot is available
      const newSlot = await env.DB.prepare(
        'SELECT id, practitioner_id, day_date, start_time, booking_id FROM slots WHERE id = ?'
      ).bind(newSlotId).first<{ id: string; practitioner_id: string; day_date: string; start_time: string; booking_id: string | null }>();
      if (!newSlot) {
        return new Response(
          JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Slot not found' } }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (newSlot.booking_id !== null) {
        return new Response(
          JSON.stringify({ error: { code: 'SLOT_TAKEN', message: 'This slot is no longer available' } }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const newPractitionerId = body.practitionerId ? String(body.practitionerId) : newSlot.practitioner_id;
      const newScheduledAt = reminderScheduledAt(newSlot.day_date, newSlot.start_time);

      await env.DB.batch([
        env.DB.prepare('UPDATE slots SET booking_id = NULL WHERE id = ?').bind(booking.slot_id),
        env.DB.prepare('UPDATE slots SET booking_id = ? WHERE id = ?').bind(bookingId, newSlotId),
        env.DB.prepare('UPDATE bookings SET slot_id = ?, practitioner_id = ? WHERE id = ?').bind(newSlotId, newPractitionerId, bookingId),
        env.DB.prepare(
          "UPDATE sms_jobs SET scheduled_at = ? WHERE booking_id = ? AND type = 'reminder' AND status = 'pending'"
        ).bind(newScheduledAt, bookingId),
      ]);

      return new Response(
        JSON.stringify({ data: { ok: true } }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Provide phone or slotId' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: APIRoute = async ({ request, params }) => {
  const authError = await requireAdmin(request, env);
  if (authError) return authError;

  const bookingId = params.id!;

  try {
    const booking = await env.DB.prepare(
      'SELECT id, slot_id FROM bookings WHERE id = ?'
    ).bind(bookingId).first<{ id: string; slot_id: string }>();
    if (!booking) {
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Booking not found' } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await env.DB.batch([
      cancelJobsForBooking(env.DB, bookingId),
      releaseSlotStmt(env.DB, booking.slot_id),
      deleteBookingStmt(env.DB, bookingId),
    ]);

    return new Response(
      JSON.stringify({ data: { ok: true } }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
