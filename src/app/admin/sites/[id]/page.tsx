// Admin Site Detail Page

export default function SiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // TODO: Fetch site data
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">รายละเอียดไซต์</h1>
      <p>TODO: Implement site config + leave_protocol settings</p>
    </div>
  );
}
