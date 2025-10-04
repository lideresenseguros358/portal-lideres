import { Tables } from '@/lib/database.types';

export type DownloadSection = Tables<'download_sections'> & {
  files_count?: number;
  has_new_files?: boolean;
  insurer?: {
    id: string;
    name: string;
    logo_url?: string;
  };
};

export type DownloadFile = Tables<'download_files'> & {
  created_by_name?: string;
  show_new_badge?: boolean;
};

export interface SearchDownloadResult {
  id: string;
  name: string;
  file_url: string;
  section_id: string;
  section_name: string;
  scope: string;
  policy_type: string;
  insurer_id?: string;
  insurer_name: string;
  is_new: boolean;
  created_at: string;
}

export interface DownloadsTree {
  generales: Record<string, PolicyTypeData>;
  personas: Record<string, PolicyTypeData>;
}

export interface PolicyTypeData {
  insurers: InsurerWithSections[];
  sections: SectionBasic[];
}

export interface InsurerWithSections {
  id: string;
  name: string;
  sections: SectionBasic[];
}

export interface SectionBasic {
  id: string;
  name: string;
  display_order: number;
}
