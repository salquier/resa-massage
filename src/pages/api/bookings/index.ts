import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { Slot } from '../../../lib/db/schema';
import { verifyTurnstileToken } from '../../../lib/turnstile';
import { claimSlotTransactional } from '../../../lib/db/slots';
import { createBooking, checkActiveBooking } from '../../../lib/db/bookings';
import { getSmsConfig } from '../../../lib/db/sms-config';
import { createSmsJob } from '../../../lib/db/sms-jobs';
import { currentLocalDate, currentLocalHHMM, parisTimeToUTC } from '../../../lib/time';

export const POST: APIRoute = async ({ request }) => {

  let body: {
    practitionerId: string;
    slotId: string;
    name: string;
    phone: string;
    turnstileToken: string;
    honeypot: string;
  };

  try {
    body = await request.json() as typeof body;
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Honeypot: silent discard if filled (bot)
  if (body.honeypot) {
    return new Response(
      JSON.stringify({ data: { bookingId: 'fake', token: 'fake' } }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Turnstile verification
  const turnstileOk = await verifyTurnstileToken(body.turnstileToken, env.TURNSTILE_SECRET_KEY);
  if (!turnstileOk) {
    return new Response(
      JSON.stringify({ error: { code: 'TURNSTILE_FAILED', message: 'Bot prevention check failed' } }),
      { status: 422, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const today = currentLocalDate();
  const currentHHMM = currentLocalHHMM();

  try {
    // Input validation
    if (!body.name?.trim() || !body.phone?.trim() || !body.practitionerId?.trim() || !body.slotId?.trim()) {
      return new Response(
        JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Champs requis manquants' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Reject past slots
    const slotCheck = await env.DB.prepare('SELECT day_date, start_time FROM slots WHERE id = ?')
      .bind(body.slotId).first<{ day_date: string; start_time: string }>();
    if (!slotCheck) {
      return new Response(
        JSON.stringify({ error: { code: 'SLOT_NOT_FOUND', message: 'Créneau introuvable' } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (slotCheck.day_date < today || (slotCheck.day_date === today && slotCheck.start_time < currentHHMM)) {
      return new Response(
        JSON.stringify({ error: { code: 'SLOT_PAST', message: 'Ce créneau est déjà passé' } }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Duplicate booking check (FR3)
    const hasExisting = await checkActiveBooking(env.DB, body.phone, today);
    if (hasExisting) {
      return new Response(
        JSON.stringify({ error: { code: 'BOOKING_EXISTS', message: 'Vous avez déjà une réservation aujourd\'hui' } }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const bookingId = crypto.randomUUID();
    const bookingToken = crypto.randomUUID();

    // Claim slot atomically (NFR14)
    const claimResult = await claimSlotTransactional(env.DB, body.slotId, bookingId);
    if (claimResult === 'slot_taken') {
      return new Response(
        JSON.stringify({ error: { code: 'SLOT_TAKEN', message: 'Ce créneau vient d\'être pris' } }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create booking row
    await createBooking(env.DB, {
      id: bookingId,
      token: bookingToken,
      participantName: body.name,
      phone: body.phone,
      practitionerId: body.practitionerId,
      slotId: body.slotId,
    });

    // Fetch slot for reminder scheduled_at
    const slot = await env.DB.prepare('SELECT * FROM slots WHERE id = ?')
      .bind(body.slotId).first<Slot>();

    // Create SMS jobs if flags enabled
    const smsConfig = await getSmsConfig(env.DB);
    const now = new Date().toISOString();

    if (smsConfig.confirmation_enabled) {
      await createSmsJob(env.DB, { bookingId, type: 'confirmation', scheduledAt: now });
    }

    if (smsConfig.reminder_enabled && slot) {
      const slotUtc = parisTimeToUTC(slot.day_date, slot.start_time);
      const reminderScheduledAt = new Date(slotUtc.getTime() - 5 * 60 * 1000).toISOString();
      await createSmsJob(env.DB, { bookingId, type: 'reminder', scheduledAt: reminderScheduledAt });
    }

    return new Response(
      JSON.stringify({ data: { bookingId, token: bookingToken } }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
