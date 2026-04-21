import SystemUserDetail from '@/components/system/SystemUserDetail';

interface PageProps {
  params: Promise<{ personId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { personId } = await params;
  return <SystemUserDetail personId={personId} />;
}
