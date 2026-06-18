import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requirePractitionerToken } from '../../../../lib/practitioner-auth';
import { getScheduleWithBookings } from '../../../../lib/db/slots';
import { currentLocalDate, currentLocalHHMM } from '../../../../lib/time';

export const GET: APIRoute = async ({ params }) => {
  const practitionerOrError = await requirePractitionerToken(params.token!, env);
  if (practitionerOrError instanceof Response) return practitionerOrError;

  try {
    const today = currentLocalDate();
    const hhmm = currentLocalHHMM();

    const slots = await getScheduleWithBookings(env.DB, practitionerOrError.id, today);
    const remainingCount = slots.filter(s => s.is_booked && s.start_time >= hhmm).length;

    return new Response(
      JSON.stringify({ data: { slots, remainingCount, date: today, currentHHMM: hhmm } }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
