// GET: Photo history

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // TODO: Implement guard photos
  return Response.json({ photos: [] });
}
