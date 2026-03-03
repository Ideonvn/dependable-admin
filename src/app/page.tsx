import { auth } from '@/lib/auth';
import DashboardClient from '@/components/DashboardClient';
import { isSuperAdminEmail } from '@/lib/permissions';

export default async function Home() {
  const session = await auth();
  
  if (!session?.user) {
    return null; // Middleware will redirect to sign in
  }

  const isSuperAdmin = isSuperAdminEmail(session.user?.email);

  return <DashboardClient isSuperAdmin={isSuperAdmin} />;
}
