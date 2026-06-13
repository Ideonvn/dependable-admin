import { auth } from '@/lib/auth';
import LogConfigClient from '@/components/system/LogConfigClient';

export default async function LogConfigPage() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  return <LogConfigClient />;
}
