'use client';

import { LogOut } from 'lucide-react';

interface UserMenuProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export default function UserMenu({ user }: UserMenuProps) {
  const handleSignOut = async () => {
    // Use form submission to trigger server action
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/api/auth/signout';
    document.body.appendChild(form);
    form.submit();
  };

  return (
    <div className="flex items-center gap-3">
      {user.image && (
        <img 
          src={user.image} 
          alt={user.name || 'User'} 
          className="w-10 h-10 rounded-full border-2 border-gray-200"
        />
      )}
      <div className="hidden sm:block text-right">
        <p className="text-sm font-medium text-gray-900">{user.name}</p>
        <p className="text-xs text-gray-500">{user.email}</p>
      </div>
      <button
        onClick={handleSignOut}
        className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200"
        title="Sign out"
      >
        <LogOut className="w-5 h-5" />
        <span className="hidden sm:inline">Sign Out</span>
      </button>
    </div>
  );
}
