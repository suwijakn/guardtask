// Admin Layout - Auth guard + sidebar

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-gray-100 p-4">
        <h2 className="font-bold mb-4">SakornGuard Admin</h2>
        <nav>
          {/* TODO: Add navigation */}
        </nav>
      </aside>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
