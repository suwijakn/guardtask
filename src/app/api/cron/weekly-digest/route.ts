// GET: Weekly digest (every Monday 07:00)
// Vercel Cron: 0 7 * * 1

export async function GET(request: Request) {
  // Verify cron secret
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // TODO: Implement weekly digest
  return Response.json({ digest: '' });
}
