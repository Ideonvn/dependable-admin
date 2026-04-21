import ProfileClient from '@/components/ProfileClient';

export default function ProfilePage() {
  return (
    <div className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 dark:bg-[#0F1115]">
      <div className="max-w-xl mx-auto">
        <ProfileClient />
      </div>
    </div>
  );
}
