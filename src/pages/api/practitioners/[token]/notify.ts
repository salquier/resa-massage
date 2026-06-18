import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { Slot } from '../../../../lib/db/schema';
import { requirePractitionerToken } from '../../../../lib/practitioner-auth';
import { getSmsConfig } from '../../../../lib/db/sms-config';
import { createSmsJob } from '../../../../lib/db/sms-jobs';
import { currentLocalDate, currentLocalHHMM } from '../../../../lib/time';

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export const POST: APIRoute = async ({ params }) => {
  const token = params.token!;

  const practitionerOrError = await requirePractitionerToken(token, env);
  if (practitionerOrError instanceof Response) return practitionerOrError;
  const practitioner = practitionerOrError;

  const now = new Date();
  const today = currentLocalDate();
  const currentHHMM = currentLocalHHMM();

  const slot = await env.DB.prepare(
    'SELECT * FROM slots WHERE practitioner_id = ? AND day_date = ? AND booking_id IS NOT NULL AND start_time >= ? ORDER BY start_time ASC LIMIT 1'
  ).bind(practitioner.id, today, currentHHMM).first<Slot>();

  if (!slot) {
    return new Response(
      JSON.stringify({ error: { code: 'NOTIFY_TOO_EARLY', message: 'Aucun créneau réservé à venir aujourd\'hui' } }),
      { status: 422, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const diff = toMinutes(slot.start_time) - toMinutes(currentHHMM);
  if (diff > 5) {
    return new Response(
      JSON.stringify({ error: { code: 'NOTIFY_TOO_EARLY', message: 'Le prochain créneau commence dans plus de 5 minutes' } }),
      { status: 422, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const smsConfig = await getSmsConfig(env.DB);
  if (!smsConfig.practitioner_trigger_enabled) {
    return new Response(
      JSON.stringify({ error: { code: 'NOTIFY_TOO_EARLY', message: 'Les notifications SMS sont désactivées' } }),
      { status: 422, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const job = await createSmsJob(env.DB, {
      bookingId: slot.booking_id!,
      type: 'practitioner_trigger',
      scheduledAt: now.toISOString(),
    });
    return new Response(
      JSON.stringify({ data: { jobId: job.id } }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
