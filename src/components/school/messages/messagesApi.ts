// src/components/school/messages/messagesApi.ts
// Spec: dependable-api docs/superpowers/specs/2026-10-16-chat-design.md

import apiClient from '@/lib/api';
import {
  ChatConversationDetail,
  ChatMessage,
  ChatRecipients,
  ChatSettings,
  PaginatedConversations,
} from '@/types/chat';

const base = (schoolId: string) => `/schools/${schoolId}/chats`;

export type ChatListOptions = { state?: 'open' | 'closed'; page?: number };

/** The caller's own chats. Listing marks them delivered. */
export async function fetchChats(schoolId: string, options: ChatListOptions = {}): Promise<PaginatedConversations> {
  const response = await apiClient.get<PaginatedConversations>(base(schoolId), {
    params: { state: options.state, page: options.page ?? 1 },
  });
  return response.data;
}

/** Every chat at the school (school admins and platform admins); read-only unless a participant. */
export async function fetchChatOversight(
  schoolId: string,
  options: ChatListOptions = {},
): Promise<PaginatedConversations> {
  const response = await apiClient.get<PaginatedConversations>(`${base(schoolId)}/oversight`, {
    params: { state: options.state, page: options.page ?? 1 },
  });
  return response.data;
}

export async function fetchChatUnreadCount(schoolId: string): Promise<number> {
  const response = await apiClient.get<{ count: number }>(`${base(schoolId)}/unread-count`);
  return response.data.count;
}

export async function fetchChatRecipients(schoolId: string, studentId: string): Promise<ChatRecipients> {
  const response = await apiClient.get<ChatRecipients>(`${base(schoolId)}/recipients`, {
    params: { student_id: studentId },
  });
  return response.data;
}

/** 201 when new; 200 when an open chat with the same child and people already existed. */
export async function startChat(
  schoolId: string,
  studentId: string,
  guardianUserIds: string[],
): Promise<ChatConversationDetail> {
  const response = await apiClient.post<ChatConversationDetail>(base(schoolId), {
    student_id: studentId,
    guardian_user_ids: guardianUserIds,
  });
  return response.data;
}

export async function fetchChat(schoolId: string, conversationId: string): Promise<ChatConversationDetail> {
  const response = await apiClient.get<ChatConversationDetail>(`${base(schoolId)}/${conversationId}`);
  return response.data;
}

/** History, newest first. */
export async function fetchChatHistory(
  schoolId: string,
  conversationId: string,
  beforeSeq?: number,
  limit = 50,
): Promise<ChatMessage[]> {
  const response = await apiClient.get<ChatMessage[]>(`${base(schoolId)}/${conversationId}/messages`, {
    params: { before_seq: beforeSeq, limit },
  });
  return response.data;
}

/** New and changed messages with rev > afterRev, ascending rev, at most 200 per call. */
export async function fetchChatChanges(
  schoolId: string,
  conversationId: string,
  afterRev: number,
): Promise<ChatMessage[]> {
  const response = await apiClient.get<ChatMessage[]>(`${base(schoolId)}/${conversationId}/messages`, {
    params: { after_rev: afterRev },
  });
  return response.data;
}

export async function sendChatMessage(
  schoolId: string,
  conversationId: string,
  clientMsgId: string,
  body: string,
): Promise<ChatMessage> {
  const response = await apiClient.post<ChatMessage>(`${base(schoolId)}/${conversationId}/messages`, {
    client_msg_id: clientMsgId,
    body,
  });
  return response.data;
}

export async function markChatRead(schoolId: string, conversationId: string, seq: number): Promise<void> {
  await apiClient.post(`${base(schoolId)}/${conversationId}/read`, { seq });
}

export async function setChatReaction(
  schoolId: string,
  conversationId: string,
  messageId: string,
  emoji: string,
): Promise<ChatMessage> {
  const response = await apiClient.put<ChatMessage>(
    `${base(schoolId)}/${conversationId}/messages/${messageId}/reaction`,
    { emoji },
  );
  return response.data;
}

export async function clearChatReaction(
  schoolId: string,
  conversationId: string,
  messageId: string,
): Promise<ChatMessage> {
  const response = await apiClient.delete<ChatMessage>(
    `${base(schoolId)}/${conversationId}/messages/${messageId}/reaction`,
  );
  return response.data;
}

export async function inviteToChat(
  schoolId: string,
  conversationId: string,
  userId: string,
): Promise<ChatConversationDetail> {
  const response = await apiClient.post<ChatConversationDetail>(
    `${base(schoolId)}/${conversationId}/participants`,
    { user_id: userId },
  );
  return response.data;
}

export async function fetchChatSettings(schoolId: string): Promise<ChatSettings> {
  const response = await apiClient.get<ChatSettings>(`/schools/${schoolId}/chat-settings`);
  return response.data;
}

export async function updateChatSettings(schoolId: string, settings: ChatSettings): Promise<ChatSettings> {
  const response = await apiClient.put<ChatSettings>(`/schools/${schoolId}/chat-settings`, settings);
  return response.data;
}

/** The API's error_code, if any. */
export function errorCode(error: unknown): string | undefined {
  const e = error as { response?: { data?: { error?: { error_code?: string } } } };
  return e?.response?.data?.error?.error_code;
}
