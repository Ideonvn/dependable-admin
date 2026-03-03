import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { isSuperAdminEmail } from '@/lib/permissions';
import SystemUsersClient from '@/components/system/SystemUsersClient';

export default async function SystemUsersPage() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  if (!isSuperAdminEmail(session.user.email)) {
    redirect('/');
  }

  return <SystemUsersClient />;
}
