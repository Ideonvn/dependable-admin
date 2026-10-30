import { ArrowLeft } from 'lucide-react';
import YearTransitionBoard from '@/components/school/YearTransitionBoard';

interface PageProps {
  params: Promise<{ id: string; yearId: string }>;
  searchParams: Promise<{ created?: string | string[] }>;
}

export default async function Page({ params, searchParams }: PageProps) {
  const { id, yearId } = await params;
  const { created } = await searchParams;
  return (
    <div className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 dark:bg-[#0F1115]">
      <div className="mb-4">
        {/* Plain <a>, not <Link>: the school page reads its tab from the hash during first render */}
        <a
          href={`/schools/${id}#schoolYears`}
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to school years
        </a>
      </div>
      <div className="bg-white dark:bg-[#121212] rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm p-4 md:p-6">
        <YearTransitionBoard schoolId={id} yearId={yearId} justCreated={created === '1'} />
      </div>
    </div>
  );
}
