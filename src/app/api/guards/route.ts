// GET/POST: List + create guards

export async function GET() {
  // TODO: Implement guard list
  return Response.json({ guards: [] });
}

export async function POST(request: Request) {
  // TODO: Implement guard creation
  return Response.json({ ok: true });
}
