import { Tables } from '@/lib/database.types';

export type GuideSection = Tables<'guide_sections'> & {
  files_count?: number;
  has_new_files?: boolean;
};

export type GuideFile = Tables<'guide_files'> & {
  created_by_name?: string;
  show_new_badge?: boolean;
  section_name?: string;
};

export interface UploadGuideFileParams {
  section_id: string;
  name: string;
  file: File;
  mark_as_new?: boolean;
  duplicate_in?: string[];
  link_changes?: boolean;
}

export interface SearchGuideResult {
  id: string;
  name: string;
  file_url: string;
  section_id: string;
  section_name: string;
  is_new: boolean;
  created_at: string;
}
