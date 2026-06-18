import type { APIRoute } from 'astro';
import { env as _env } from 'cloudflare:workers';
import { confirmJob, deletePhoneIfLastJob } from '../../../../../lib/db/sms-jobs';

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

export const POST: APIRoute = async ({ request, params }) => {
  const authError = requireAndroidAuth(request, env.ANDROID_API_SECRET);
  if (authError) return authError;

  const jobId = params.id!;

  try {
    // Test jobs (from sms_test_queue) have ids prefixed with "test_"
    if (jobId.startsWith('test_')) {
      await env.DB.prepare(
        "UPDATE sms_test_queue SET status = 'sent' WHERE id = ? AND status = 'pending'"
      ).bind(jobId).run();
      return new Response(
        JSON.stringify({ data: { ok: true } }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    const job = await env.DB.prepare(
      'SELECT id, booking_id, status FROM sms_jobs WHERE id = ?'
    ).bind(jobId).first<{ id: string; booking_id: string; status: string }>();

    if (!job) {
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Job not found' } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (job.status === 'sent') {
      return new Response(
        JSON.stringify({ data: { ok: true } }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    await confirmJob(env.DB, job.id);
    await deletePhoneIfLastJob(env.DB, job.booking_id);

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
