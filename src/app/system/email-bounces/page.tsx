import { auth } from '@/lib/auth';
import EmailBouncesClient from '@/components/system/EmailBouncesClient';

export default async function EmailBouncesPage() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  return <EmailBouncesClient />;
}
