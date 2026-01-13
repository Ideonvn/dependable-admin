import { auth } from '@/lib/auth';
import SettingsMenu from '@/components/SettingsMenu';
import DashboardClient from '@/components/DashboardClient';

export default async function Home() {
  const session = await auth();
  
  if (!session?.user) {
    return null; // Middleware will redirect to sign in
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0F1115]">
      <header className="bg-white dark:bg-[#121212] border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dependable Admin</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Manage CSV imports and invitations</p>
            </div>
            <SettingsMenu user={session.user} />
          </div>
        </div>
      </header>

      <DashboardClient />
    </div>
  );
}
