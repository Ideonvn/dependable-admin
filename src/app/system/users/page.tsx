import { auth } from '@/lib/auth';
import SystemUsersClient from '@/components/system/SystemUsersClient';

export default async function SystemUsersPage() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  return <SystemUsersClient />;
}
