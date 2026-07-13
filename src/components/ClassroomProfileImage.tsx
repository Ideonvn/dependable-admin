'use client';

import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { tokenService } from '@/lib/tokenService';
import { fetchImageCached } from '@/lib/imageCache';

interface ClassroomProfileImageProps {
  schoolId: string;
  classroomId: string;
  imageFilename: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}

export default function ClassroomProfileImage({
  schoolId,
  classroomId,
  imageFilename,
  alt,
  className = '',
  fallbackClassName = '',
}: ClassroomProfileImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!imageFilename || !schoolId || !classroomId) {
      setIsLoading(false);
      return;
    }

    const fetchImage = async () => {
      try {
        setIsLoading(true);
        setError(false);

        const tokenData = tokenService.getTokenData();
        if (!tokenData?.access_token) {
          throw new Error('No access token available');
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const url = await fetchImageCached(
          `${apiUrl}/schools/${schoolId}/classrooms/${classroomId}/profile/image/${imageFilename}`,
          tokenData.access_token
        );
        setImageUrl(url);
      } catch (err) {
        console.error('Error fetching classroom profile image:', err);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchImage();

    // Cleanup function to revoke object URL
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [schoolId, classroomId, imageFilename]);

  if (isLoading) {
    return (
      <div className={fallbackClassName}>
        <div className="animate-pulse bg-gray-300 dark:bg-gray-700 w-full h-full rounded-lg" />
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className={fallbackClassName}>
        <BookOpen className="w-6 h-6 text-gray-400 dark:text-gray-600" />
      </div>
    );
  }

  return <img src={imageUrl} alt={alt} className={className} />;
}
