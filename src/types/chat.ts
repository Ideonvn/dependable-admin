// src/types/chat.ts
// Mirrors dependable-api app/school/chat/schemas.py (snake_case, as sent).

export type ChatSide = 'GUARDIAN' | 'STAFF';
export type ChatStaffRole = 'TEACHER' | 'ADMIN';
export type ChatClosedReason = 'STUDENT_INACTIVE' | 'STAFF_INELIGIBLE';

export interface ChatParticipant {
  user_id: string;
  display_name: string;
  side: ChatSide;
  staff_role: ChatStaffRole | null;
  joined_seq: number;
  last_delivered_seq: number;
  last_read_seq: number;
  image_filename: string | null;
}

export interface ChatReaction {
  user_id: string;
  emoji: string;
}

export interface ChatMessage {
  id: string;
  seq: number;
  rev: number;
  sender_id: string | null;
  sender_display_name: string;
  client_msg_id: string;
  kind: 'TEXT';
  body: string;
  created_at: string;
  reactions: ChatReaction[];
}

export interface ChatConversationSummary {
  id: string;
  student_id: string;
  student_first_name: string;
  participants: ChatParticipant[];
  last_message: ChatMessage | null;
  last_message_at: string | null;
  unread_count: number;
  closed_at: string | null;
  closed_reason: ChatClosedReason | null;
}

export interface ChatConversationDetail extends ChatConversationSummary {
  school_name: string;
  last_seq: number;
  staff_quiet_until: string | null;
  can_post: boolean;
  can_invite: boolean;
  invitable_guardians: { user_id: string; display_name: string }[];
  viewer_is_participant: boolean;
}

export interface PaginatedConversations {
  data: ChatConversationSummary[];
  page: number;
  total: number;
  next_page: number | null;
}

export interface ChatRecipients {
  staff: { user_id: string; display_name: string; role: ChatStaffRole }[];
  guardians: { user_id: string; display_name: string; primary: boolean }[];
}

export interface ChatSettings {
  quiet_start: string | null; // "HH:MM", school local time
  quiet_end: string | null;
  quiet_weekends: boolean;
}

// A message sent from here that the server has not confirmed yet.
export interface PendingChatMessage {
  client_msg_id: string;
  body: string;
  created_at: string;
  failed: boolean;
}
