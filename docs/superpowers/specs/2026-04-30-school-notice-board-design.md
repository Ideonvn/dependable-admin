# School Notice Board — Design Spec

**Date:** 2026-04-30  
**Branch:** school-calendar  
**Status:** Approved

---

## Overview

A Notice Board tab on the school detail page, providing a formal announcement channel for schools. Notices support a three-state parent acknowledgement system (unread → seen → acknowledged). Admins and teachers can create, edit, and delete notices; they can also inspect who has and hasn't acknowledged each notice.

This feature is an admin-portal-only view. All logged-in portal users have full access — no school-level role enforcement is applied in the frontend (role restrictions exist on the parent-facing side only).

---

## Decisions

| Question | Decision |
|---|---|
| Role enforcement | None — all admin portal users have full access |
| Pagination | Load all at once (no pagination UI) — matches existing tab pattern |
| Detail/edit UX | Modal — mirrors `EventFormModal` |
| Markdown rendering | `react-markdown` (new dependency) |
| Architecture | Mirror Calendar tab structure exactly |

---

## File Structure

```
src/
  types/
    notices.ts                         — TypeScript types for notices and acknowledgements
  components/school/notices/
    noticesApi.ts                      — All API calls
    NoticesTab.tsx                     — List view, page-level state, opens modals
    NoticeFormModal.tsx                — Create / edit form
    NoticeDetailModal.tsx              — Read-only detail + acknowledgement panel
  app/schools/[id]/
    page.tsx                           — Add 'notices' tab (Bell icon, between Calendar and Billing)
```

---

## Types (`src/types/notices.ts`)

```ts
export interface NoticeAttachment {
  s3_key: string;   // present on both read and write
  name: string;
  content_type: string;
  url: string;      // presigned S3 URL — read only, never sent in payloads
}

export interface Notice {
  id: string;
  school_id: string;
  title: string;
  content: string; // Markdown
  scope: 'SCHOOL' | 'CLASSROOM' | 'STUDENT';
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
}

export interface NoticePayload {
  title: string;
  content: string;
  scope: 'SCHOOL' | 'CLASSROOM' | 'STUDENT';
  classroom_id: string | null;
  student_id: string | null;
  attachments: AttachmentPayload[]; // url field is excluded — never sent to backend
}

export interface AcknowledgementSummary {
  total_recipients: number;
  acknowledged_count: number;
  entries: {
    user_id: string;
    name: string;
    state: 'seen' | 'acknowledged';
    timestamp: string;
  }[];
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
```

---

## Data Layer (`noticesApi.ts`)

All functions use `apiClient` from `@/lib/api`. Base path: `/schools/:schoolId/notices`.

| Function | Method | Endpoint | Notes |
|---|---|---|---|
| `fetchNotices(schoolId)` | GET | `/notices?page=1` | Returns `Notice[]` from `data` field |
| `fetchNotice(schoolId, noticeId)` | GET | `/notices/:noticeId` | Returns `Notice` |
| `createNotice(schoolId, payload)` | POST | `/notices` | Returns `Notice` |
| `updateNotice(schoolId, noticeId, payload)` | PUT | `/notices/:noticeId` | Returns `Notice` |
| `deleteNotice(schoolId, noticeId)` | DELETE | `/notices/:noticeId` | Returns `void` |
| `fetchAcknowledgements(schoolId, noticeId)` | GET | `/notices/:noticeId/acknowledgements` | Returns `AcknowledgementSummary` |
| `uploadAttachment(schoolId, file)` | POST | `/notices/attachments/upload` | `multipart/form-data`, field `file`; returns `UploadedAttachment` |

---

## Tab Integration (`page.tsx`)

- Add `'notices'` to the `TabType` union.
- Add `{ id: 'notices', label: 'Notices', icon: Bell }` to the `tabs` array, positioned between Calendar and Billing.
- Add `'notices'` to the hash guard in `getInitialTab`.
- Render `<NoticesTab schoolId={school.id} />` in the tab content section.

---

## Notice List (`NoticesTab.tsx`)

**State:** `notices: Notice[]`, `loading: boolean`, `error: string | null`, `showForm: boolean`, `formMode: 'create' | 'edit'`, `editingNotice: Notice | null`, `selectedNotice: Notice | null`

**Data fetch:** `useEffect` on mount; `loadNotices()` also called as the `onSuccess` callback after any mutation.

**Layout:**
- Header: "Notices" heading + "New Notice" button (navy/teal, `Plus` icon)
- Loading: centered spinner (identical to Calendar tab)
- Error: inline red alert with message + Retry button
- Empty: `Bell` icon, "No notices yet. Create the first one."
- List: one row per notice showing:
  - Scope badge (coloured pill — see badge colours below)
  - Title
  - Created date (formatted `DD MMM YYYY`)
  - Ack counter placeholder — displayed as "— acknowledged" until the detail modal is opened (the list response does not include ack counts; counts are lazy-loaded per notice in the detail modal)

**Interactions:**
- Row click → open `NoticeDetailModal` with that notice
- "New Notice" → open `NoticeFormModal` in create mode

**Scope badge colours:**
| Scope | Light mode | Dark mode |
|---|---|---|
| SCHOOL | `#1A1A6D` (navy) | `#20B2AA` (teal) |
| CLASSROOM | `rgba(135,206,250,1)` (light blue) | `rgba(70,130,180,1)` (steel blue) |
| STUDENT | `#10B981` (emerald) | `#4CAF50` (green) |

---

## Create / Edit Form (`NoticeFormModal.tsx`)

Mirrors `EventFormModal.tsx` structure: fixed overlay, coloured top bar (scope colour), header with title + close button, inline error alert, form body, footer actions.

**Form fields:**
| Field | Type | Required | Notes |
|---|---|---|---|
| Title | text input | Yes | |
| Content | textarea | Yes | Plain Markdown; no toolbar |
| Scope | select | Yes | SCHOOL / CLASSROOM / STUDENT |
| Classroom | select | Conditional | Shown when scope = CLASSROOM; fetched from `schoolsApi.getClassrooms` |
| Student | select | Conditional | Shown when scope = STUDENT; fetched from `schoolsApi.getStudents` |
| Attachments | file input (multiple) | No | See attachment flow below |

**Attachment flow:**
1. User selects files via `<input type="file" multiple>`.
2. Each file is immediately uploaded via `uploadAttachment()`.
3. While uploading: show filename + spinner.
4. On success: show filename + remove button; store `{ s3_key, name, content_type }`.
5. On failure: show filename + error message + retry option.
6. The `attachments` array in the payload contains only successfully uploaded files.
7. On edit: pre-populate with existing attachments from the notice. The GET response now includes `s3_key` on each attachment alongside `url`. Existing attachments the user has not removed are sent in the PUT payload as `{ s3_key, name, content_type }` — the `url` field is omitted (backend does not accept it). Only files explicitly removed by the user are excluded.

**Validation:**
- Title required
- Content required
- Classroom required when scope = CLASSROOM
- Student required when scope = STUDENT

**Footer:**
- Edit mode: Delete button (red, left side) — calls `deleteNotice` directly (no recurring prompt needed); Save Changes button (right)
- Create mode: Cancel + "Create Notice" buttons

**Coloured top bar:** tied to selected scope, same colour mapping as scope badges.

---

## Detail View (`NoticeDetailModal.tsx`)

**Props:** `notice: Notice`, `schoolId: string`, `classrooms: Classroom[]`, `students: Student[]`, `onEdit: () => void`, `onClose: () => void`

**Layout:**
- Header: scope badge + title, Edit button (`Pencil` icon), close button (`X`)
- Meta row: created date; scope target name (resolved from `classrooms`/`students` props using `classroom_id`/`student_id`)
- Content: `<ReactMarkdown>` in a styled prose container (reasonable defaults: headings, bold, italic, lists)
- Attachments section (only if `attachments.length > 0`):
  - Images (`content_type` starts with `image/`): inline `<img>` thumbnail (max height 120px), click opens URL in new tab
  - Other files: `<a href={url} target="_blank">` with file icon + name
- Acknowledgements panel (collapsible, collapsed by default):
  - Toggle button: "Acknowledgements ▸" / "Acknowledgements ▾"
  - On expand: call `fetchAcknowledgements`; show spinner while loading
  - Loaded: "X / Y acknowledged" summary + percentage progress bar + table (Name | State badge | Timestamp)
  - State badges: `seen` → amber pill; `acknowledged` → green pill
  - Error: inline red message + Retry button

**Ack panel state:** `ackOpen: boolean`, `ackData: AcknowledgementSummary | null`, `ackLoading: boolean`, `ackError: string | null`. Fetched once per modal open (not re-fetched on toggle collapse).

---

## New Dependency

- `react-markdown` — for rendering notice content in the detail modal.
- No other new dependencies.

---

## Out of Scope

- Push notifications
- Draft / scheduling (all notices publish immediately)
- Notice expiry / archiving
- Rich text WYSIWYG editor
- Ack counts shown in the list (lazy-loaded in detail only)
