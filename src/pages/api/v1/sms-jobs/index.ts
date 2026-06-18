import type { APIRoute } from 'astro';
import { env as _env } from 'cloudflare:workers';
import { getPendingJobs, type PendingJobWithContext } from '../../../../lib/db/sms-jobs';

// @cloudflare/workers-types/2023-07-01 types the cloudflare:workers env as Cloudflare.Env
// which doesn't merge with the project's global Env interface — cast once here.
const env = _env as unknown as Env;

function requireAndroidAuth(request: Request, secret: string): Response | null {
  const auth = request.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ') || auth.slice(7) !== secret) {
    return new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing Bearer token' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return null;
}

function composeMessage(job: PendingJobWithContext, appUrl: string): string {
  switch (job.type) {
    case 'confirmation':
      return `Bonjour ${job.participant_name}, votre rendez-vous avec ${job.practitioner_name} est confirmé à ${job.slot_start_time}. Voir votre réservation : ${appUrl}/booking/${job.booking_token}`;
    case 'reminder':
      return `Rappel : votre rendez-vous avec ${job.practitioner_name} commence dans 5 minutes (${job.slot_start_time}).`;
    case 'practitioner_trigger':
      return `${job.practitioner_name} est prêt·e à vous recevoir. Présentez-vous maintenant !`;
  }
}

export const GET: APIRoute = async ({ request }) => {
  const authError = requireAndroidAuth(request, env.ANDROID_API_SECRET);
  if (authError) return authError;

  try {
    const [jobs, testJobs] = await Promise.all([
      getPendingJobs(env.DB),
      env.DB.prepare(
        "SELECT id, phone, created_at FROM sms_test_queue WHERE status = 'pending' ORDER BY created_at ASC"
      ).all<{ id: string; phone: string; created_at: string }>(),
    ]);

    const data = [
      ...jobs
        .filter(j => j.phone !== null)
        .map(j => ({
          id: j.id,
          type: j.type,
          phone: j.phone!,
          message: composeMessage(j, env.APP_URL),
          scheduledAt: j.scheduled_at,
        })),
      ...testJobs.results.map(t => ({
        id: t.id,
        type: 'test',
        phone: t.phone,
        message: 'Test SMS depuis l\'administration — le relais fonctionne correctement.',
        scheduledAt: t.created_at,
      })),
    ];

    return new Response(
      JSON.stringify({ data }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
