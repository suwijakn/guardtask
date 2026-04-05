// GET/POST: List + create sites

export async function GET() {
  // TODO: Implement site list
  return Response.json({ sites: [] });
}

export async function POST(request: Request) {
  // TODO: Implement site creation
  return Response.json({ ok: true });
}
