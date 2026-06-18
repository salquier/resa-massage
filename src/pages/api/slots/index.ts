import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getAvailableSlotsForDay } from '../../../lib/db/slots';
import { currentLocalDate, currentLocalHHMM } from '../../../lib/time';

export const GET: APIRoute = async ({ url }) => {
  const practitionerId = url.searchParams.get('practitionerId');
  if (!practitionerId) {
    return new Response(
      JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'practitionerId required' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  try {
    const today = currentLocalDate();
    const hhmm = currentLocalHHMM();
    const slots = await getAvailableSlotsForDay(env.DB, practitionerId, today);
    const future = slots.filter(s => s.start_time > hhmm);
    return new Response(
      JSON.stringify({ data: future.map(s => ({ id: s.id, start_time: s.start_time, end_time: s.end_time })) }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
