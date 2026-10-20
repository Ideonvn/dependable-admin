// src/components/school/messages/ChatAvatar.tsx
'use client';

import { useEffect, useState } from 'react';
import { tokenService } from '@/lib/tokenService';
import { getInitials } from '@/lib/initials';
import { ChatParticipant } from '@/types/chat';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * A participant's photo through the chat-scoped route (guardians and staff have
 * no shared membership route), else their initials; "+N" for others behind them.
 */
export default function ChatAvatar({
  schoolId,
  conversationId,
  participant,
  more = 0,
}: {
  schoolId: string;
  conversationId: string;
  participant: ChatParticipant | null;
  more?: number;
}) {
  const filename = participant?.image_filename ?? null;
  const userId = participant?.user_id;
  const src =
    filename && userId
      ? `${API_URL}/schools/${schoolId}/chats/${conversationId}/participants/${userId}/image/${filename}`
      : null;
  // Keyed by src so a row reused for another person never shows the previous photo.
  const [loaded, setLoaded] = useState<{ src: string; url: string } | null>(null);
  const url = src && loaded?.src === src ? loaded.url : null;

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    (async () => {
      try {
        // Read only, like the other profile images: see realtime.ts getToken.
        const token = tokenService.getAccessToken();
        if (!token) return;
        // Not fetchImageCached: its Cache Storage outlives sign-out, and these are
        // parents' photos, so on a shared office PC they'd stay on disk.
        const response = await fetch(src, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) return;
        const url = URL.createObjectURL(await response.blob());
        if (cancelled) {
          // Unmounted or src changed while loading: nothing will show it.
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setLoaded({ src, url });
      } catch {
        // initials stay
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  return (
    <div className="relative w-10 h-10 flex-shrink-0">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={participant?.display_name ?? ''} className="w-10 h-10 rounded-full object-cover" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-[#1A1A6D] dark:bg-[#20B2AA] flex items-center justify-center">
          <span className="text-sm font-semibold text-white select-none">
            {participant ? getInitials(participant.display_name) : '?'}
          </span>
        </div>
      )}
      {more > 0 && (
        <span
          className="absolute -right-1 -bottom-1 min-w-[20px] h-5 px-1 rounded-full bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-[#121212]"
          aria-label={`and ${more} more`}
        >
          +{more}
        </span>
      )}
    </div>
  );
}
