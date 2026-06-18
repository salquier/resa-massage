import type { APIRoute } from 'astro';

export const POST: APIRoute = async () => {
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/admin/login',
      'Set-Cookie': 'admin_session=; HttpOnly; SameSite=Strict; Max-Age=0; Path=/',
    },
  });
};
