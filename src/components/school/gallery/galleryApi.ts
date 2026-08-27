// src/components/school/gallery/galleryApi.ts

import apiClient from '@/lib/api';
import {
  AlbumPayload,
  GalleryAlbumDetail,
  GalleryAlbumSummary,
  GalleryPhoto,
  PaginatedAlbumsResponse,
} from '@/types/gallery';

const base = (schoolId: string) => `/schools/${schoolId}/galleries`;

// Some browsers hand us an empty File.type for HEIC/HEIF (and occasionally for
// files dragged out of odd sources). An empty content type is rejected
// server-side with a misleading message, so fall back to the extension.
const EXTENSION_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

export function resolveUploadType(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TYPES[extension] ?? '';
}

export async function fetchAlbums(
  schoolId: string,
  page = 1,
): Promise<PaginatedAlbumsResponse> {
  const response = await apiClient.get<PaginatedAlbumsResponse>(base(schoolId), {
    params: { page },
  });
  return response.data;
}

export async function createAlbum(
  schoolId: string,
  payload: AlbumPayload,
): Promise<GalleryAlbumSummary> {
  const response = await apiClient.post<GalleryAlbumSummary>(base(schoolId), payload);
  return response.data;
}

export async function fetchAlbum(
  schoolId: string,
  albumId: string,
  photoPage = 1,
): Promise<GalleryAlbumDetail> {
  const response = await apiClient.get<GalleryAlbumDetail>(
    `${base(schoolId)}/${albumId}`,
    { params: { photo_page: photoPage } },
  );
  return response.data;
}

export async function updateAlbum(
  schoolId: string,
  albumId: string,
  payload: AlbumPayload,
): Promise<GalleryAlbumSummary> {
  const response = await apiClient.put<GalleryAlbumSummary>(
    `${base(schoolId)}/${albumId}`,
    payload,
  );
  return response.data;
}

export async function deleteAlbum(schoolId: string, albumId: string): Promise<void> {
  await apiClient.delete(`${base(schoolId)}/${albumId}`);
}

// Terminal: there is no unpublish endpoint. Guard this behind a confirmation.
export async function publishAlbum(
  schoolId: string,
  albumId: string,
): Promise<GalleryAlbumSummary> {
  const response = await apiClient.post<GalleryAlbumSummary>(
    `${base(schoolId)}/${albumId}/publish`,
  );
  return response.data;
}

export async function uploadPhoto(
  schoolId: string,
  albumId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<GalleryPhoto> {
  const contentType = resolveUploadType(file);
  // Re-wrap only when the browser gave us nothing useful, so the multipart part
  // carries a content type the API accepts.
  const upload =
    contentType && contentType !== file.type
      ? new File([file], file.name, { type: contentType })
      : file;

  const formData = new FormData();
  formData.append('file', upload, upload.name);

  const response = await apiClient.post<GalleryPhoto>(
    `${base(schoolId)}/${albumId}/photos`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (!onProgress) return;
        const total = event.total ?? 0;
        onProgress(total > 0 ? Math.round((event.loaded / total) * 100) : 0);
      },
    },
  );
  return response.data;
}

// The API rejects anything that is not the album's live photo set, once each —
// always send the complete permutation, never a delta.
export async function reorderPhotos(
  schoolId: string,
  albumId: string,
  photoIds: string[],
): Promise<void> {
  await apiClient.put(`${base(schoolId)}/${albumId}/photos/order`, {
    photo_ids: photoIds,
  });
}

export async function updatePhotoCaption(
  schoolId: string,
  albumId: string,
  photoId: string,
  caption: string | null,
): Promise<GalleryPhoto> {
  const response = await apiClient.patch<GalleryPhoto>(
    `${base(schoolId)}/${albumId}/photos/${photoId}`,
    { caption },
  );
  return response.data;
}

export async function deletePhoto(
  schoolId: string,
  albumId: string,
  photoId: string,
): Promise<void> {
  await apiClient.delete(`${base(schoolId)}/${albumId}/photos/${photoId}`);
}
