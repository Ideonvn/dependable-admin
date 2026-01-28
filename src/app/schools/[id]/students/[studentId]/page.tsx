import StudentManage from '@/components/school/StudentManage';

interface PageProps {
  params: Promise<{ id: string; studentId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id, studentId } = await params;
  return (
    <div className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 dark:bg-[#0F1115]">
      <div className="bg-white dark:bg-[#121212] rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm p-4 md:p-6">
        <StudentManage schoolId={id} studentId={studentId} />
      </div>
    </div>
  );
}
