// src/components/school/notices/noticesApi.ts

import apiClient from '@/lib/api';
import {
  Notice,
  NoticePayload,
  PaginatedNoticesResponse,
  AcknowledgementSummary,
  UploadedAttachment,
} from '@/types/notices';

const base = (schoolId: string) => `/schools/${schoolId}/notices`;

export async function fetchNotices(schoolId: string): Promise<Notice[]> {
  const response = await apiClient.get<PaginatedNoticesResponse>(base(schoolId), {
    params: { page: 1 },
  });
  return response.data.data;
}

export async function fetchNotice(schoolId: string, noticeId: string): Promise<Notice> {
  const response = await apiClient.get<Notice>(`${base(schoolId)}/${noticeId}`);
  return response.data;
}

export async function createNotice(schoolId: string, payload: NoticePayload): Promise<Notice> {
  const response = await apiClient.post<Notice>(base(schoolId), payload);
  return response.data;
}

export async function updateNotice(
  schoolId: string,
  noticeId: string,
  payload: NoticePayload,
): Promise<Notice> {
  const response = await apiClient.put<Notice>(`${base(schoolId)}/${noticeId}`, payload);
  return response.data;
}

export async function deleteNotice(schoolId: string, noticeId: string): Promise<void> {
  await apiClient.delete(`${base(schoolId)}/${noticeId}`);
}

export async function fetchAcknowledgements(
  schoolId: string,
  noticeId: string,
): Promise<AcknowledgementSummary> {
  const response = await apiClient.get<AcknowledgementSummary>(
    `${base(schoolId)}/${noticeId}/acknowledgements`,
  );
  return response.data;
}

export async function uploadAttachment(
  schoolId: string,
  file: File,
): Promise<UploadedAttachment> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post<UploadedAttachment>(
    `${base(schoolId)}/attachments/upload`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return response.data;
}
