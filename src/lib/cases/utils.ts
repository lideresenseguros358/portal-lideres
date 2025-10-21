// Utility functions for cases module

/**
 * Generates a simple hash from string (for content_hash)
 */
export function generateContentHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Validates file type for uploads
 */
export function validateFileType(mimeType: string): boolean {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ];

  return allowedTypes.includes(mimeType);
}

/**
 * Validates file size (max 10MB)
 */
export function validateFileSize(sizeBytes: number): boolean {
  const maxSize = 10 * 1024 * 1024; // 10MB
  return sizeBytes <= maxSize;
}

/**
 * Formats file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Gets file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length > 1) {
    const ext = parts[parts.length - 1];
    return ext ? ext.toLowerCase() : '';
  }
  return '';
}

/**
 * Gets icon for file type
 */
export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('word')) return '📝';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
  if (mimeType.startsWith('text/')) return '📃';
  return '📎';
}

/**
 * Sanitizes filename
 */
export function sanitizeFilename(filename: string): string {
  // Remove special characters except dots, dashes, underscores
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Generates storage path for case file
 */
export function generateCaseFilePath(
  caseId: string,
  filename: string,
  isVerified: boolean
): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  const sanitizedFilename = sanitizeFilename(filename);
  
  if (isVerified) {
    return `pendientes/${year}/${month}/${caseId}/${sanitizedFilename}`;
  } else {
    return `pendientes/_unverified/${year}/${month}/${caseId}/${sanitizedFilename}`;
  }
}

/**
 * Extracts year and month from date string
 */
export function extractDateParts(date: string | Date): { year: string; month: string } {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return {
    year: dateObj.getFullYear().toString(),
    month: String(dateObj.getMonth() + 1).padStart(2, '0'),
  };
}

/**
 * Formats date for display (Spanish)
 */
export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleDateString('es-PA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Formats datetime for display (Spanish)
 */
export function formatDateTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleString('es-PA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Gets relative time string (e.g., "hace 2 horas")
 */
export function getRelativeTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Hace un momento';
  if (diffMin < 60) return `Hace ${diffMin} ${diffMin === 1 ? 'minuto' : 'minutos'}`;
  if (diffHour < 24) return `Hace ${diffHour} ${diffHour === 1 ? 'hora' : 'horas'}`;
  if (diffDay < 30) return `Hace ${diffDay} ${diffDay === 1 ? 'día' : 'días'}`;
  
  return formatDate(dateObj);
}

/**
 * Truncates text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Generates case number for current year
 */
export function generateCaseNumber(lastNumber: number): string {
  const year = new Date().getFullYear();
  const nextNumber = lastNumber + 1;
  return `CASE-${year}-${String(nextNumber).padStart(4, '0')}`;
}

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Creates initials from name (for avatars)
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(p => p.length > 0);
  if (parts.length === 0) return '?';
  const first = parts[0];
  if (!first) return '?';
  if (parts.length === 1) return first.charAt(0).toUpperCase();
  const last = parts[parts.length - 1];
  if (!last) return first.charAt(0).toUpperCase();
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

/**
 * Gets color for user avatar based on name hash
 */
export function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-indigo-500',
    'bg-purple-500',
    'bg-pink-500',
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const color = colors[Math.abs(hash) % colors.length];
  return color || 'bg-blue-500';
}
