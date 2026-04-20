"use client";

import { useState, useRef, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { Settings, LogOut } from 'lucide-react';
import { tokenService } from '../lib/tokenService';
import { setGoogleIdToken } from '../lib/api';
import { userSetupService } from '../lib/userSetupService';
import UserProfileImage from './UserProfileImage';

export default function SettingsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const setupData = userSetupService.getSetupData();
  const displayName = userSetupService.getFullName() ?? setupData?.email ?? '';
  const displayEmail = setupData?.email ?? '';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSignOut = async () => {
    try {
      await signOut({ redirect: false });
    } finally {
      tokenService.clearTokenData();
      userSetupService.clearSetupData();
      setGoogleIdToken(null);
      window.location.href = '/';
    }
  };

  const initial = displayName?.[0]?.toUpperCase() || 'U';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        {setupData?.image_filename ? (
          <UserProfileImage
            imageFilename={setupData.image_filename}
            alt={displayName}
            className="w-8 h-8 rounded-full object-cover"
            fallbackClassName="w-8 h-8 rounded-full bg-gradient-to-br from-[#1A1A6D] to-[#87CEFA] dark:from-[#20B2AA] dark:to-[#4682B4] flex items-center justify-center text-white font-medium"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1A1A6D] to-[#87CEFA] dark:from-[#20B2AA] dark:to-[#4682B4] flex items-center justify-center text-white font-medium text-sm">
            {initial}
          </div>
        )}
        <div className="hidden sm:block text-left">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{displayName}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{displayEmail}</p>
        </div>
        <Settings className="w-4 h-4 text-gray-500 dark:text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#0F1115] rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 py-2 z-50">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{displayName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{displayEmail}</p>
          </div>

          {/* Sign Out */}
          <div className="border-t border-gray-200 dark:border-gray-800 pt-2">
            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-3"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
