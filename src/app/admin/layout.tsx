import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import Link from 'next/link';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/auth/login');
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900">SakornGuard</h2>
          <p className="text-sm text-gray-500">Admin Panel</p>
        </div>
        <nav className="px-3 space-y-1">
          <Link
            href="/admin/dashboard"
            className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            📊 Dashboard
          </Link>
          <Link
            href="/admin/checkins"
            className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            ✅ Check-ins
          </Link>
          <Link
            href="/admin/guards"
            className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            👤 Guards
          </Link>
          <Link
            href="/admin/sites"
            className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            📍 Sites
          </Link>
          <Link
            href="/admin/leave"
            className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            📝 Leave Requests
          </Link>
          <Link
            href="/admin/alerts"
            className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            🚨 Alerts
          </Link>
          <Link
            href="/admin/line-mapping"
            className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            💬 LINE Mapping
          </Link>
          <Link
            href="/admin/reports"
            className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            📈 Reports
          </Link>
        </nav>
        <div className="absolute bottom-0 w-64 p-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <p className="font-medium text-gray-900">{session.user.email}</p>
            </div>
            <form action="/api/auth/sign-out" method="POST">
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ออก
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
