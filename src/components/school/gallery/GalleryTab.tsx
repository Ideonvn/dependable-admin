// src/components/school/gallery/GalleryTab.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Images, Plus, RefreshCw } from 'lucide-react';
import { GalleryAlbumSummary, GalleryScope } from '@/types/gallery';
import { schoolsApi, Classroom, Student } from '@/lib/schools';
import { fetchAlbums } from './galleryApi';
import AlbumFormModal from './AlbumFormModal';
import AlbumDetailModal from './AlbumDetailModal';

interface GalleryTabProps {
  schoolId: string;
  schoolName: string;
}

type StatusFilter = 'all' | 'draft' | 'published';
type ScopeFilter = 'ALL' | GalleryScope;

function scopeBadgeStyle(scope: GalleryScope): { bg: string; text: string } {
  switch (scope) {
    case 'SCHOOL':
      return { bg: 'bg-[#1A1A6D] dark:bg-[#20B2AA]', text: 'text-white' };
    case 'CLASSROOM':
      return {
        bg: 'bg-blue-100 dark:bg-blue-900/40',
        text: 'text-blue-800 dark:text-blue-200',
      };
    case 'STUDENT':
      return {
        bg: 'bg-emerald-100 dark:bg-emerald-900/40',
        text: 'text-emerald-800 dark:text-emerald-200',
      };
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'published', label: 'Published' },
];

const SCOPE_FILTERS: { value: ScopeFilter; label: string }[] = [
  { value: 'ALL', label: 'All audiences' },
  { value: 'SCHOOL', label: 'School' },
  { value: 'CLASSROOM', label: 'Classroom' },
  { value: 'STUDENT', label: 'Student' },
];

export default function GalleryTab({ schoolId, schoolName }: GalleryTabProps) {
  const [albums, setAlbums] = useState<GalleryAlbumSummary[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('ALL');

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [detailAlbumId, setDetailAlbumId] = useState<string | null>(null);

  // A single silent reload when a presigned cover URL has expired.
  const coverRetriedRef = useRef(false);

  const loadAlbums = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAlbums(schoolId, 1);
      setAlbums(response.data);
      setNextPage(response.next_page);
      coverRetriedRef.current = false;
    } catch {
      setError('Failed to load albums');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    loadAlbums();
  }, [loadAlbums]);

  useEffect(() => {
    schoolsApi.getClassrooms(schoolId).then(setClassrooms).catch(console.error);
    schoolsApi.getStudents(schoolId).then(setStudents).catch(console.error);
  }, [schoolId]);

  async function loadMore() {
    if (nextPage === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await fetchAlbums(schoolId, nextPage);
      setAlbums((prev) => [...prev, ...response.data]);
      setNextPage(response.next_page);
    } catch {
      setError('Failed to load more albums');
    } finally {
      setLoadingMore(false);
    }
  }

  function handleCoverError() {
    if (coverRetriedRef.current) return;
    coverRetriedRef.current = true;
    loadAlbums();
  }

  function handleAlbumCreated(album: GalleryAlbumSummary) {
    // Land straight in the workbench, ready to add photos.
    setShowForm(false);
    setDetailAlbumId(album.id);
  }

  function handleDetailClosed() {
    setDetailAlbumId(null);
    // Covers, photo counts and draft state all change inside the detail modal.
    loadAlbums();
  }

  // Filters hide rows; they never re-sort. The API order is newest published
  // first, then drafts by creation, and that order is meaningful.
  const visibleAlbums = albums.filter((album) => {
    if (statusFilter === 'draft' && !album.is_draft) return false;
    if (statusFilter === 'published' && album.is_draft) return false;
    if (scopeFilter !== 'ALL' && album.scope !== scopeFilter) return false;
    return true;
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Gallery</h2>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A1A6D] dark:bg-[#20B2AA] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Album
        </button>
      </div>

      {!loading && !error && albums.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap mb-6">
          <div className="flex items-center gap-1">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === filter.value
                    ? 'bg-[#1A1A6D] dark:bg-[#20B2AA] text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <select
            value={scopeFilter}
            onChange={(event) => setScopeFilter(event.target.value as ScopeFilter)}
            className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          >
            {SCOPE_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-800 dark:text-red-300 flex-1">{error}</span>
          <button
            onClick={loadAlbums}
            className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {!loading && !error && albums.length === 0 && (
        <div className="text-center py-20">
          <Images className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No albums yet. Create the first one.
          </p>
        </div>
      )}

      {!loading && !error && albums.length > 0 && visibleAlbums.length === 0 && (
        <div className="text-center py-20">
          <Images className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No albums match these filters.
          </p>
        </div>
      )}

      {!loading && !error && visibleAlbums.length > 0 && (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {visibleAlbums.map((album) => {
            const badge = scopeBadgeStyle(album.scope);
            const scopeTarget =
              album.scope === 'CLASSROOM'
                ? album.classroom_name
                : album.scope === 'STUDENT'
                  ? album.student_name
                  : null;

            return (
              <button
                key={album.id}
                onClick={() => setDetailAlbumId(album.id)}
                className={`text-left rounded-lg overflow-hidden border transition-colors hover:border-[#1A1A6D] dark:hover:border-[#20B2AA] ${
                  album.is_draft
                    ? 'border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40'
                    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121212]'
                }`}
              >
                <div className="relative aspect-[4/3] bg-gray-100 dark:bg-gray-800">
                  {album.cover_thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={album.cover_thumbnail_url}
                      alt=""
                      onError={handleCoverError}
                      className={`w-full h-full object-cover ${album.is_draft ? 'opacity-75' : ''}`}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Images className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                    </div>
                  )}
                  {album.is_draft && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/70 dark:text-amber-200">
                      Draft
                    </span>
                  )}
                  {!album.allow_download && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                      Downloads off
                    </span>
                  )}
                </div>

                <div className="p-3">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.bg} ${badge.text}`}
                    >
                      {album.scope}
                    </span>
                    {scopeTarget && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {scopeTarget}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {album.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {album.photo_count} {album.photo_count === 1 ? 'photo' : 'photos'} ·{' '}
                    {formatDate(album.published_at ?? album.created_at)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!loading && !error && nextPage !== null && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Loading…
              </>
            ) : (
              'Load more albums'
            )}
          </button>
        </div>
      )}

      {showForm && (
        <AlbumFormModal
          mode="create"
          schoolId={schoolId}
          classrooms={classrooms}
          students={students}
          onSuccess={handleAlbumCreated}
          onClose={() => setShowForm(false)}
        />
      )}

      {detailAlbumId && (
        <AlbumDetailModal
          schoolId={schoolId}
          schoolName={schoolName}
          albumId={detailAlbumId}
          classrooms={classrooms}
          students={students}
          onClose={handleDetailClosed}
        />
      )}
    </div>
  );
}
