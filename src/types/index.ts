export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
  webViewLink?: string;
  webContentLink?: string;
}

export interface GoogleDriveFolder {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

export interface DocumentChunk {
  id: string;
  content: string;
  file_id: string;
  file_name: string;
  folder_id: string;
  embedding?: number[];
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: DocumentChunk[];
  errorDetail?: string;
}

export interface AuthContextType {
  isAuthenticated: boolean;
  user: any | null;
  accessToken: string | null;
  login: () => void;
  logout: () => void;
}

export interface DriveContextType {
  folders: GoogleDriveFolder[];
  selectedFolder: GoogleDriveFolder | null;
  files: GoogleDriveFile[];
  loading: boolean;
  error: string | null;
  listFolders: () => Promise<void>;
  selectFolder: (folder: GoogleDriveFolder) => void;
  listFiles: (folderId: string) => Promise<void>;
  downloadFile: (fileId: string, mimeType: string) => Promise<string>;
}
