import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { listPractitionersWithCounts } from '../../../lib/db/practitioners';
import { currentLocalDate, currentLocalHHMM } from '../../../lib/time';

export const GET: APIRoute = async () => {
  const today = currentLocalDate();
  const hhmm = currentLocalHHMM();
  const bookingsOpen = hhmm >= '08:00';

  try {
    const practitioners = await listPractitionersWithCounts(
      env.DB, today, bookingsOpen, hhmm
    );
    return new Response(
      JSON.stringify({ data: practitioners, meta: { bookingsOpen, date: today } }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
