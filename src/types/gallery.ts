// src/types/gallery.ts

export type GalleryScope = 'SCHOOL' | 'CLASSROOM' | 'STUDENT';

export interface GalleryPhoto {
  id: string;
  thumbnail_url: string; // presigned, 512px longest edge, always JPEG
  url: string; // presigned, full-size original
  filename: string;
  content_type: string;
  width: number; // ORIGINAL dimensions, not the thumbnail's
  height: number;
  caption: string | null;
  position: number;
  created_at: string; // ISO
}

export interface GalleryAlbumSummary {
  id: string;
  school_id: string;
  title: string;
  description: string | null;
  scope: GalleryScope;
  classroom_id: string | null;
  classroom_name: string | null;
  student_id: string | null;
  student_name: string | null;
  cover_photo_id: string | null; // for the mobile thumbnail cache — unused here
  cover_thumbnail_url: string | null; // null when the album has no photos
  photo_count: number;
  allow_download: boolean;
  is_draft: boolean; // there is no status enum — this is it
  created_by: string | null;
  created_at: string; // ISO
  published_at: string | null; // ISO, stamped by publish
}

export interface GalleryAlbumDetail extends GalleryAlbumSummary {
  photos: GalleryPhoto[];
  photo_page: number;
  photo_total: number;
  photo_next_page: number | null;
}

export interface PaginatedAlbumsResponse {
  data: GalleryAlbumSummary[];
  page: number;
  total: number;
  next_page: number | null;
}

// The create and update payloads are identical, so they share one type.
export interface AlbumPayload {
  title: string; // min length 1
  description: string | null;
  scope: GalleryScope;
  classroom_id: string | null;
  student_id: string | null;
  // Required, never optional. PUT is a full replace and the API defaults this
  // to true when it is omitted, so an optional field here would mean a title
  // edit silently re-enabled downloads on an album where the school had turned
  // them off. This client always states its intent.
  allow_download: boolean;
}

// Server-enforced limits, mirrored client-side so the common rejections never
// cost a round trip. The server stays authoritative — see the error handling in
// UploadDropzone.
export const MAX_PHOTOS_PER_ALBUM = 200;
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
export const ACCEPTED_PHOTO_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];
