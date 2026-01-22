'use client';

import { User } from 'next-auth';
import SettingsMenu from '@/components/SettingsMenu';
import { Building2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface AppHeaderProps {
  user: User;
}

export default function AppHeader({ user }: AppHeaderProps) {
  const pathname = usePathname();
  
  // Don't show header on auth pages
  if (pathname?.startsWith('/auth')) {
    return null;
  }

  return (
    <header className="bg-white dark:bg-[#121212] border-b border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Building2 className="w-8 h-8 text-[#1A1A6D] dark:text-[#20B2AA]" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dependable Admin</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Manage schools and student data</p>
            </div>
          </Link>
          <SettingsMenu user={user} />
        </div>
      </div>
    </header>
  );
}
