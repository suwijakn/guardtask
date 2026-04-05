// GET: Leave balance

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // TODO: Implement leave balance
  return Response.json({ balance: { sick: 30, annual: 6, personal: 3 } });
}
