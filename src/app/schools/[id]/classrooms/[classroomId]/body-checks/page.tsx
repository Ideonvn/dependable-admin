import { ArrowLeft } from 'lucide-react';
import ClassroomBodyChecks from '@/components/school/ClassroomBodyChecks';

interface PageProps {
  params: Promise<{ id: string; classroomId: string }>;
  searchParams: Promise<{ date?: string | string[] }>;
}

export default async function Page({ params, searchParams }: PageProps) {
  const { id, classroomId } = await params;
  const { date } = await searchParams;
  // A malformed ?date= falls back to today rather than surfacing as a failed request
  const initialDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  return (
    <div className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 dark:bg-[#0F1115]">
      <div className="mb-4">
        {/* Plain <a>, not <Link>: the school page reads its tab from the hash during first render, and a
            client-side navigation only updates the URL after that render, so a <Link> would land on Details */}
        <a
          href={`/schools/${id}#classrooms`}
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to classrooms
        </a>
      </div>
      <div className="bg-white dark:bg-[#121212] rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm p-4 md:p-6">
        <ClassroomBodyChecks schoolId={id} classroomId={classroomId} initialDate={initialDate} />
      </div>
    </div>
  );
}
