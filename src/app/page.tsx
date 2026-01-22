import { auth } from '@/lib/auth';
import DashboardClient from '@/components/DashboardClient';

export default async function Home() {
  const session = await auth();
  
  if (!session?.user) {
    return null; // Middleware will redirect to sign in
  }

  return <DashboardClient />;
}
