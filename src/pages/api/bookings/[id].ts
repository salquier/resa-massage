import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getBookingWithDetails, deleteBookingStmt } from '../../../lib/db/bookings';
import { releaseSlotStmt } from '../../../lib/db/slots';
import { cancelJobsForBooking } from '../../../lib/db/sms-jobs';

function extractToken(request: Request): string | null {
  const header = request.headers.get('Authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

export const GET: APIRoute = async ({ params, request }) => {
  const token = extractToken(request);
  if (!token) {
    return new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Authorization header required' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const details = await getBookingWithDetails(env.DB, params.id!);
    if (!details) {
      return new Response(
        JSON.stringify({ error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (details.token !== token) {
      return new Response(
        JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Access denied' } }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({
        data: {
          id: details.id,
          practitionerName: details.practitioner_name,
          specialty: details.specialty,
          slotDate: details.slot_date,
          slotStartTime: details.slot_start_time,
          slotEndTime: details.slot_end_time,
        },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
  const token = extractToken(request);
  if (!token) {
    return new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Authorization header required' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const db = env.DB;
    const details = await getBookingWithDetails(db, params.id!);
    if (!details) {
      return new Response(
        JSON.stringify({ error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (details.token !== token) {
      return new Response(
        JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Access denied' } }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Atomic: cancel SMS jobs + free slot + delete booking
    await db.batch([
      cancelJobsForBooking(db, params.id!),
      releaseSlotStmt(db, details.slot_id),
      deleteBookingStmt(db, params.id!),
    ]);

    return new Response(
      JSON.stringify({ data: { deleted: true } }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
