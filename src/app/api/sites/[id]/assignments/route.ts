// GET/POST: Manage guard whitelist

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // TODO: Implement site assignments list
  return Response.json({ assignments: [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // TODO: Implement site assignment creation
  return Response.json({ ok: true });
}
