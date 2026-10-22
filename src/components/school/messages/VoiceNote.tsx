'use client';

// Plays a chat voice note, styled like the app's bubble: play/pause, loudness
// bars that fill as it plays with a dot riding the position, click or drag to
// seek, time, and a speed pill while playing. The portal plays, never records.
// The audio URL is short-lived, so it is fetched on the first play.
import { PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Mic, Pause, Play } from 'lucide-react';
import { fetchChatVoiceUrl } from './messagesApi';
import { barsFor, formatVoiceDuration } from './chatUtils';

const BARS = 40;
const SPEEDS = [1, 1.5, 2] as const;
// Refetch a little before the signed URL lapses.
const URL_MARGIN_MS = 60_000;

export default function VoiceNote({
  schoolId,
  conversationId,
  messageId,
  durationMs,
  waveform,
  mine,
}: {
  schoolId: string;
  conversationId: string;
  messageId: string;
  durationMs: number | null | undefined;
  waveform?: number[] | null;
  mine: boolean;
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const loadedUntil = useRef(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0); // seconds
  const [duration, setDuration] = useState((durationMs ?? 0) / 1000);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [drag, setDrag] = useState<number | null>(null);
  const levels = useMemo(() => barsFor(waveform, BARS), [waveform]);

  // The element's time is continuous; read it every frame while playing.
  useEffect(() => {
    if (!playing) return;
    let id = requestAnimationFrame(function loop() {
      if (audio.current) setPosition(audio.current.currentTime);
      id = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(id);
  }, [playing]);

  useEffect(() => () => audio.current?.pause(), []);

  const ensureLoaded = async (): Promise<HTMLAudioElement | null> => {
    if (audio.current && loadedUntil.current > Date.now()) return audio.current;
    setLoading(true);
    setFailed(false);
    try {
      const { url, expires_in } = await fetchChatVoiceUrl(schoolId, conversationId, messageId);
      const el = audio.current ?? new Audio();
      if (!audio.current) {
        el.preload = 'auto';
        el.onplay = () => {
          // One note at a time, as in the app.
          window.dispatchEvent(new CustomEvent('chat-voice-play', { detail: messageId }));
          setPlaying(true);
        };
        el.onpause = () => setPlaying(false);
        el.onended = () => {
          setPlaying(false);
          el.currentTime = 0;
          setPosition(0);
        };
        el.onloadedmetadata = () => {
          if (Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration);
        };
        el.onerror = () => {
          loadedUntil.current = 0;
          setPlaying(false);
          setFailed(true);
        };
        audio.current = el;
      }
      el.src = url;
      loadedUntil.current = Date.now() + expires_in * 1000 - URL_MARGIN_MS;
      return el;
    } catch {
      setFailed(true);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const other = (e: Event) => {
      if ((e as CustomEvent).detail !== messageId) audio.current?.pause();
    };
    window.addEventListener('chat-voice-play', other);
    return () => window.removeEventListener('chat-voice-play', other);
  }, [messageId]);

  const play = async (from?: number) => {
    const el = await ensureLoaded();
    if (!el) return;
    if (from !== undefined) el.currentTime = from;
    el.playbackRate = speed;
    await el.play().catch(() => setFailed(true));
  };

  const toggle = () => (playing ? audio.current?.pause() : play());

  const fractionAt = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    return box.width > 0 ? Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)) : 0;
  };
  const seek = (fraction: number) => {
    const to = fraction * duration;
    setPosition(to);
    if (audio.current && loadedUntil.current > Date.now()) audio.current.currentTime = to;
    else play(to); // seeking before the first play starts from there
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audio.current) audio.current.playbackRate = next;
  };

  const progress = drag ?? (duration > 0 ? Math.min(1, position / duration) : 0);
  const started = playing || position > 0;
  const fg = mine ? 'bg-white' : 'bg-[#1A1A6D] dark:bg-[#20B2AA]';
  const rest = mine ? 'bg-white/45' : 'bg-gray-300 dark:bg-gray-600';
  const sub = mine ? 'text-white/80' : 'text-gray-500 dark:text-gray-400';

  return (
    <div className="flex items-center gap-2 w-72 max-w-full py-0.5">
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className="shrink-0 h-8 w-8 flex items-center justify-center"
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : playing ? (
          <Pause className="h-6 w-6 fill-current" />
        ) : (
          <Play className="h-6 w-6 fill-current" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div
          className="relative h-7 flex items-center justify-between gap-[2px] cursor-pointer touch-none select-none"
          role="slider"
          aria-label="Voice note position"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          tabIndex={0}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDrag(fractionAt(e));
          }}
          onPointerMove={(e) => drag !== null && setDrag(fractionAt(e))}
          onPointerUp={(e) => {
            const f = fractionAt(e);
            setDrag(null);
            seek(f);
          }}
          onPointerCancel={() => setDrag(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') seek(Math.min(1, progress + 0.05));
            if (e.key === 'ArrowLeft') seek(Math.max(0, progress - 0.05));
          }}
        >
          {levels.map((level, i) => (
            <span
              key={i}
              className={`w-[3px] rounded-full ${(i + 0.5) / levels.length <= progress ? fg : rest}`}
              style={{ height: `${Math.max(3, level * 28)}px` }}
            />
          ))}
          <span
            className={`absolute top-1/2 h-2.5 w-2.5 -mt-[5px] -ml-[5px] rounded-full pointer-events-none ${fg}`}
            style={{ left: `${progress * 100}%` }}
          />
        </div>
        <div className={`text-[11px] tabular-nums mt-0.5 ${sub}`}>
          {failed ? "Couldn't play. Try again." : formatVoiceDuration((started ? position : duration) * 1000)}
        </div>
      </div>
      {started ? (
        <button
          type="button"
          onClick={cycleSpeed}
          className={`shrink-0 h-6 w-10 rounded-full text-xs font-bold ${mine ? 'bg-white/25' : 'bg-gray-200 dark:bg-gray-700'}`}
          aria-label={`Playback speed ${speed}x`}
        >
          {speed}×
        </button>
      ) : (
        <Mic className={`shrink-0 h-4 w-4 ${sub}`} aria-hidden />
      )}
    </div>
  );
}
