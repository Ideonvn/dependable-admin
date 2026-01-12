import { auth } from '@/lib/auth';
import UserMenu from '@/components/UserMenu';
import DashboardClient from '@/components/DashboardClient';

export default async function Home() {
  const session = await auth();
  
  if (!session?.user) {
    return null; // Middleware will redirect to sign in
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dependable Admin</h1>
              <p className="text-gray-600 mt-1">Manage CSV imports and invitations</p>
            </div>
            <UserMenu user={session.user} />
          </div>
        </div>
      </header>

      <DashboardClient />
    </div>
  );
}
