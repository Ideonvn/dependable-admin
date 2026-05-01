// src/types/notices.ts

export type NoticeScope = 'SCHOOL' | 'CLASSROOM' | 'STUDENT';

export interface NoticeAttachment {
  s3_key: string;
  name: string;
  content_type: string;
  url: string; // presigned S3 URL — present on read, never sent in payloads
}

export interface Notice {
  id: string;
  school_id: string;
  title: string;
  content: string; // Markdown
  scope: NoticeScope;
  classroom_id: string | null;
  student_id: string | null;
  attachments: NoticeAttachment[];
  created_by: string | null;
  created_at: string; // ISO
  published_at: string | null;
  ack_state: null; // always null for admin — ignored
}

export interface AttachmentPayload {
  s3_key: string;
  name: string;
  content_type: string;
  // url is intentionally excluded — backend does not accept it
}

export interface NoticePayload {
  title: string;
  content: string;
  scope: NoticeScope;
  classroom_id: string | null;
  student_id: string | null;
  attachments: AttachmentPayload[];
}

export interface PaginatedNoticesResponse {
  data: Notice[];
  page: number;
  total: number;
  next_page: number | null;
}

export interface UploadedAttachment {
  s3_key: string;
  name: string;
  content_type: string;
}

export interface AcknowledgementEntry {
  user_id: string;
  name: string;
  state: 'seen' | 'acknowledged';
  timestamp: string;
}

export interface AcknowledgementSummary {
  total_recipients: number;
  acknowledged_count: number;
  entries: AcknowledgementEntry[];
}
