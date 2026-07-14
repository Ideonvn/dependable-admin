'use client';

import { useEffect, useState } from 'react';
import { tokenService } from '@/lib/tokenService';
import { fetchImageCached } from '@/lib/imageCache';
import { getInitials } from '@/lib/initials';

interface StudentProfileImageProps {
  schoolId: string;
  studentId: string;
  imageFilename: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}

export default function StudentProfileImage({
  schoolId,
  studentId,
  imageFilename,
  alt,
  className = '',
  fallbackClassName = '',
}: StudentProfileImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!imageFilename || !schoolId || !studentId) {
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
          `${apiUrl}/schools/${schoolId}/students/${studentId}/profile/image/${imageFilename}`,
          tokenData.access_token
        );
        setImageUrl(url);
      } catch (err) {
        console.error('Error fetching student profile image:', err);
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
  }, [schoolId, studentId, imageFilename]);

  if (isLoading) {
    return (
      <div className={fallbackClassName}>
        <div className="animate-pulse bg-gray-300 dark:bg-gray-700 w-full h-full rounded-full" />
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className={fallbackClassName}>
        <span className="text-sm font-semibold text-white select-none">{getInitials(alt)}</span>
      </div>
    );
  }

  return <img src={imageUrl} alt={alt} className={className} />;
}
