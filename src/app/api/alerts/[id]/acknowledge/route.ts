// POST: Mark acknowledged

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // TODO: Implement alert acknowledge
  return Response.json({ ok: true });
}
