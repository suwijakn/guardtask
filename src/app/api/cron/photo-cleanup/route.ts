// GET: Photo cleanup (every day 02:00)
// Vercel Cron: 0 2 * * *

export async function GET(request: Request) {
  // Verify cron secret
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // TODO: Implement photo cleanup
  return Response.json({ deleted: 0 });
}
