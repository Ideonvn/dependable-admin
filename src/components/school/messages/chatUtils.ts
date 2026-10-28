// src/components/school/messages/chatUtils.ts
// Ported from dependable-app utils/chatUtils.ts; keep the two in step.

import {
  ChatClosedReason,
  ChatConversationSummary,
  ChatMessage,
  ChatParticipant,
  PendingChatMessage,
} from '@/types/chat';

export type TickState = 'sending' | 'failed' | 'sent' | 'delivered' | 'seen';

// The six quick reactions offered on long-press (one per person, server-enforced).
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

/**
 * Tick for a message the viewer sent; null for anyone else's.
 *
 * Only participants who were in the chat when the message was sent count
 * (joined_seq < seq). Without that filter, inviting a second parent would turn
 * every earlier message back to "delivered".
 */
export const tickState = (
  message: ChatMessage,
  participants: ChatParticipant[],
  viewerId: string | null | undefined,
): TickState | null => {
  if (!viewerId || message.sender_id !== viewerId) return null;
  const others = participants.filter(
    (p) => p.user_id !== viewerId && p.joined_seq < message.seq,
  );
  if (others.length === 0) return 'sent';
  if (others.every((p) => p.last_read_seq >= message.seq)) return 'seen';
  if (others.every((p) => p.last_delivered_seq >= message.seq)) return 'delivered';
  return 'sent';
};

/** Names of the other participants who have read this message (multi-person chats). */
export const seenBy = (
  message: ChatMessage,
  participants: ChatParticipant[],
  viewerId: string,
): string[] =>
  participants
    .filter(
      (p) =>
        p.user_id !== viewerId &&
        p.joined_seq < message.seq &&
        p.last_read_seq >= message.seq,
    )
    .map((p) => p.display_name);

/**
 * Upsert incoming messages into the thread by id, keeping the higher rev, and
 * return them newest first (the inverted list's order). A changed message (a new
 * reaction) replaces the stored one in place; appending would duplicate it.
 */
export const mergeMessages = (
  existing: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] => {
  const byId = new Map<string, ChatMessage>();
  for (const message of existing) byId.set(message.id, message);
  for (const message of incoming) {
    const current = byId.get(message.id);
    if (!current || message.rev >= current.rev) byId.set(message.id, message);
  }
  return Array.from(byId.values()).sort((a, b) => b.seq - a.seq);
};

/**
 * The sync cursor: the highest rev seen. Not the highest seq: a reaction on an
 * older message raises its rev, and a seq cursor would never ask for it again.
 */
export const maxRev = (messages: ChatMessage[], floor = 0): number =>
  messages.reduce((max, m) => (m.rev > max ? m.rev : max), floor);

export const maxSeq = (messages: ChatMessage[]): number =>
  messages.reduce((max, m) => (m.seq > max ? m.seq : max), 0);

/** Drop pending bubbles the server already has, matched by client_msg_id (never by text). */
export const unconfirmedPending = (
  pending: PendingChatMessage[],
  messages: ChatMessage[],
): PendingChatMessage[] => {
  const stored = new Set(messages.map((m) => m.client_msg_id));
  return pending.filter((p) => !stored.has(p.client_msg_id));
};

/** Reactions grouped for display: [{ emoji, count, mine }], most used first. */
export const groupReactions = (
  message: ChatMessage,
  viewerId: string | null | undefined,
): { emoji: string; count: number; mine: boolean }[] => {
  const groups = new Map<string, { emoji: string; count: number; mine: boolean }>();
  for (const r of message.reactions) {
    const group = groups.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
    group.count += 1;
    if (r.user_id === viewerId) group.mine = true;
    groups.set(r.emoji, group);
  }
  return Array.from(groups.values()).sort((a, b) => b.count - a.count);
};

export const myReaction = (
  message: ChatMessage,
  viewerId: string | null | undefined,
): string | null => message.reactions.find((r) => r.user_id === viewerId)?.emoji ?? null;

export const closedReasonText = (
  reason: ChatClosedReason | null,
  childName: string,
): string => {
  switch (reason) {
    case 'STUDENT_INACTIVE':
      return `${childName} is no longer at the school.`;
    case 'STAFF_INELIGIBLE':
      return `A staff member in this chat no longer works with ${childName}.`;
    default:
      return 'This chat is closed.';
  }
};

export const disclosureText = (schoolName: string): string =>
  `Messages in this chat can be read by ${schoolName} management and Dependable support.`;

/** "Ms Lee and Mr Dube" / "A, B and C". */
export const joinNames = (names: string[]): string => {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

export const roleLabel = (p: ChatParticipant): string =>
  p.side === 'GUARDIAN' ? 'Parent' : p.staff_role === 'ADMIN' ? 'Admin' : 'Teacher';

/** "Maya Carewell" / "Maya Carewell +1". */
const firstPlus = (people: ChatParticipant[]): string =>
  people.length ? `${people[0].display_name}${people.length > 1 ? ` +${people.length - 1}` : ''}` : '';

export interface ChatListHeading {
  title: string;
  subtitle: string;
  avatar: ChatParticipant | null;
  more: number; // others behind the avatar
}

/**
 * A participant sees who they're talking to (the other side), with the child and
 * that person's role underneath. Someone reading as oversight sees both sides.
 */
export const chatListHeading = (chat: ChatConversationSummary, viewerId?: string): ChatListHeading => {
  const about = `About ${chat.student_first_name}`;
  const me = chat.participants.find((p) => p.user_id === viewerId);
  if (me) {
    const others = chat.participants.filter((p) => p.side !== me.side);
    const lead = others[0] ?? null;
    return {
      title: firstPlus(others) || chat.student_first_name,
      subtitle: lead ? `${about} · ${roleLabel(lead)}` : about,
      avatar: lead,
      more: Math.max(others.length - 1, 0),
    };
  }
  const staff = chat.participants.filter((p) => p.side === 'STAFF');
  const guardians = chat.participants.filter((p) => p.side === 'GUARDIAN');
  return {
    title: `${firstPlus(staff)} ↔ ${firstPlus(guardians)}`,
    subtitle: about,
    avatar: staff[0] ?? null,
    more: 0,
  };
};

/** "07:00" today, or "Mon 07:00" when it is not today, in the browser's time zone. */
export const formatQuietUntil = (iso: string, now: Date = new Date()): string => {
  const until = new Date(iso);
  const time = until.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (until.toDateString() === now.toDateString()) return time;
  const day = until.toLocaleDateString(undefined, { weekday: 'short' });
  return `${day} ${time}`;
};

/** Validates a quiet-hours HH:MM string. */
export const isHhMm = (value: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const ERROR_COPY: Record<string, string> = {
  CHAT_CONVERSATION_CLOSED: 'This chat is closed.',
  CHAT_FORBIDDEN: "You don't have access to this chat any more.",
  CHAT_NOT_FOUND: 'This chat could not be found.',
  CHAT_INVALID_RECIPIENTS: "You can't start a chat with the selected people.",
  CHAT_INVALID_REACTION: "That reaction isn't supported.",
  CHAT_CLIENT_MSG_ID_CONFLICT: 'This message could not be sent. Please try again.',
  CHAT_INVALID_SETTINGS: 'Set both a start and an end time, or neither.',
  CHAT_VOICE_TOO_LARGE: 'This voice note is too large to send.',
  CHAT_VOICE_INVALID: "This voice note couldn't be sent.",
  CHAT_NOT_A_VOICE_NOTE: 'This voice note could not be found.',
};

/** Copy for an API error_code; generic for anything unknown. */
export const chatErrorMessage = (code: string | undefined): string =>
  (code && ERROR_COPY[code]) || 'Something went wrong. Please try again.';


/** m:ss, rounded to the nearest second (14 200 ms → "0:14"). */
export const formatVoiceDuration = (ms: number | null | undefined): string => {
  const seconds = Math.max(0, Math.round((ms ?? 0) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** What a list shows for a message: the text, or a label for a voice note. */
export const messagePreviewText = (m: ChatMessage): string =>
  m.kind === 'VOICE' ? `🎤 Voice note (${formatVoiceDuration(m.voice_duration_ms)})` : m.body;

// Notes sent before waveforms existed get even stubs at this height.
const FLAT_LEVEL = 0.25;
const WAVEFORM_MAX = 31;

/** Stored levels (0..31) → `n` bars of 0..1 for drawing (app: utils/voiceWaveform.ts barsFor). */
export const barsFor = (stored: number[] | null | undefined, n: number): number[] => {
  if (!stored || stored.length === 0) return new Array(n).fill(FLAT_LEVEL);
  return Array.from({ length: n }, (_, i) => {
    const pos = (i * stored.length) / n;
    return stored[Math.min(stored.length - 1, Math.floor(pos))] / WAVEFORM_MAX;
  });
};

// Day separators (WhatsApp style). By the device's local calendar day.
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Local calendar day, e.g. "2026-10-28": what a separator groups by. */
export const dayKey = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** "Today", "Yesterday", the weekday within the last week, else "15 October 2026". */
export const dayLabel = (iso: string, now: Date = new Date()): string => {
  const d = new Date(iso);
  // Rounded: a day across a daylight-saving change is 23 or 25 hours.
  const days = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / 86_400_000);
  if (days <= 0) return 'Today'; // a clock slightly ahead of ours is still today
  if (days === 1) return 'Yesterday';
  if (days < 7) return WEEKDAYS[d.getDay()];
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/**
 * Whether a message opens its day, i.e. gets a separator above it. `older` is
 * the message just before it in time; without one, only when there is no older
 * history left to load (or the separator would sit mid-day until it loads).
 */
export const startsDay = (current: string, older: string | undefined, noOlderHistory: boolean): boolean =>
  older === undefined ? noOlderHistory : dayKey(older) !== dayKey(current);
