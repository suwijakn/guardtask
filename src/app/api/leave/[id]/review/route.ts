// POST: Approve/reject leave

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // TODO: Implement leave review
  return Response.json({ ok: true });
}
