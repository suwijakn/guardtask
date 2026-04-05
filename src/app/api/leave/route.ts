// GET/POST: List + create leave requests

export async function GET() {
  // TODO: Implement leave list
  return Response.json({ leaves: [] });
}

export async function POST(request: Request) {
  // TODO: Implement leave creation
  return Response.json({ ok: true });
}
