// GET: Attendance stats 90 days

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // TODO: Implement guard stats
  return Response.json({ stats: {} });
}
