import { GoogleDriveFile, GoogleDriveFolder } from '../types';

const API_BASE_URL = 'https://www.googleapis.com/drive/v3';

export class GoogleDriveService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async makeRequest(url: string, options: RequestInit = {}) {
    console.log('Making Google Drive API request:', url);
    console.log('Access token length:', this.accessToken?.length || 0);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    console.log('API Response status:', response.status);
    console.log('API Response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Drive API error response:', errorText);
      throw new Error(`Google Drive API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('API Response data:', data);
    return data;
  }

  async listFolders(): Promise<GoogleDriveFolder[]> {
    const query = "mimeType='application/vnd.google-apps.folder' and trashed=false";
    const url = `${API_BASE_URL}/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime)`;
    
    const response = await this.makeRequest(url);
    return response.files || [];
  }

  async listFiles(folderId: string): Promise<GoogleDriveFile[]> {
    // Exclude folders and Google Workspace formats (Docs/Sheets/Slides) that can't be read as text
    const query = `'${folderId}' in parents and trashed=false and mimeType != 'application/vnd.google-apps.folder' and mimeType != 'application/vnd.google-apps.spreadsheet' and mimeType != 'application/vnd.google-apps.presentation' and mimeType != 'application/vnd.google-apps.form'`;
    const url = `${API_BASE_URL}/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,modifiedTime,webViewLink,webContentLink)`;
    
    const response = await this.makeRequest(url);
    return response.files || [];
  }

  async downloadFile(fileId: string, mimeType: string): Promise<string> {
    if (mimeType === 'application/pdf') {
      // For native PDFs (uploaded files), use alt=media to download directly
      // The export endpoint is only for converting Google Docs to PDF
      const url = `${API_BASE_URL}/files/${fileId}?alt=media`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        // If alt=media fails, the file might be a Google Doc — try export instead
        if (response.status === 403 || response.status === 404) {
          console.log('Direct download failed, trying export endpoint...');
          const exportUrl = `${API_BASE_URL}/files/${fileId}/export?mimeType=application/pdf`;
          const exportResponse = await fetch(exportUrl, {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
            },
          });

          if (!exportResponse.ok) {
            throw new Error(`Failed to download/export PDF: ${exportResponse.statusText}`);
          }

          const arrayBuffer = await exportResponse.arrayBuffer();
          return this.arrayBufferToBase64(arrayBuffer);
        }
        throw new Error(`Failed to download PDF: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return this.arrayBufferToBase64(arrayBuffer);
    } else if (mimeType === 'application/vnd.google-apps.document') {
      // Export Google Docs as plain text
      const exportUrl = `${API_BASE_URL}/files/${fileId}/export?mimeType=text/plain`;
      const response = await fetch(exportUrl, {
        headers: { 'Authorization': `Bearer ${this.accessToken}` },
      });
      if (!response.ok) throw new Error(`Failed to export Google Doc: ${response.statusText}`);
      return await response.text();
    } else {
      // For ALL other file types: text/*, application/octet-stream, application/json, etc.
      // Covers .py, .md, .txt, .gitignore, requirements.txt, config.py, setup.py, .json, .yaml, etc.
      const url = `${API_BASE_URL}/files/${fileId}?alt=media`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      return await response.text();
    }
  }

  /**
   * Convert ArrayBuffer to base64 safely (handles large files by chunking)
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    // Process in chunks to avoid "Maximum call stack size exceeded" with large PDFs
    const chunkSize = 8192;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  async getFileMetadata(fileId: string): Promise<GoogleDriveFile> {
    const url = `${API_BASE_URL}/files/${fileId}?fields=id,name,mimeType,size,modifiedTime,webViewLink,webContentLink`;
    return this.makeRequest(url);
  }
}