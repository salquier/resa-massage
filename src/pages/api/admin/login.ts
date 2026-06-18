import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { signCookie, verifyPassword } from '../../../lib/admin-auth';
import { verifyTurnstileToken } from '../../../lib/turnstile';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { password, turnstileToken } = await request.json() as { password: string; turnstileToken?: string };

    if (env.TURNSTILE_SECRET_KEY && turnstileToken !== undefined) {
      const ok = await verifyTurnstileToken(turnstileToken, env.TURNSTILE_SECRET_KEY);
      if (!ok) {
        return new Response(
          JSON.stringify({ error: { code: 'TURNSTILE_FAILED', message: 'Vérification anti-bot échouée' } }),
          { status: 422, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!password || !(await verifyPassword(password, env.ADMIN_PASSWORD_HASH))) {
      return new Response(
        JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Invalid password' } }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const sessionId = crypto.randomUUID();
    const signed = await signCookie(sessionId, env.ADMIN_SESSION_SECRET);
    return new Response(
      JSON.stringify({ data: { ok: true } }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `admin_session=${signed}; HttpOnly; Secure; SameSite=Strict; Max-Age=28800; Path=/`,
        },
      }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
