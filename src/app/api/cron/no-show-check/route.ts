// GET: Check for no-show guards (every 15 min during shift change)
// Vercel Cron: */15 5-8,17-20 * * *

export async function GET(request: Request) {
  // Verify cron secret
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // TODO: Implement no-show check
  return Response.json({ alerts: [] });
}
