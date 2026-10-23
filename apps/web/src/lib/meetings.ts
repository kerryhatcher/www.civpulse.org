export interface MeetingRecord {
  status: 'ok' | 'missing' | 'private';
  event?: {
    id: string;
    title: string;
    meeting_notes: string | null;
    meeting_transcript: string | null;
  };
  attendance?: {
    person_id: string;
    full_name: string;
    slug: string;
    status: 'present' | 'absent' | 'excused';
    note: string | null;
  }[];
  votes?: {
    id: string;
    subject: string;
    description: string | null;
    outcome: string | null;
    choices: { person_id: string; full_name: string; choice: string }[];
  }[];
  attachments?: {
    id: string;
    file_name: string;
    storage_path: string;
    mime_type: string;
    size_bytes: number;
  }[];
}

export const MEETING_BUCKET = 'meeting-attachments';

export const MEETING_FILE_TYPES: Record<string, string> = {
  pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
};
