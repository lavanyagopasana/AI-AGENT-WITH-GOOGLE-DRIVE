import React, { createContext, useContext, useState, ReactNode } from 'react';
import { DriveContextType, GoogleDriveFolder, GoogleDriveFile } from '../types';
import { GoogleDriveService } from '../services/googleDriveService';
import { useAuth } from './AuthContext';
import { SupabaseService } from '../services/supabaseService';
import { EmbeddingService } from '../services/embeddingService';
import { PDFParser } from '../utils/pdfParser';

const DriveContext = createContext<DriveContextType | undefined>(undefined);

export const useDrive = () => {
  const context = useContext(DriveContext);
  if (context === undefined) {
    throw new Error('useDrive must be used within a DriveProvider');
  }
  return context;
};

interface DriveProviderProps {
  children: ReactNode;
}

export const DriveProvider: React.FC<DriveProviderProps> = ({ children }) => {
  const [folders, setFolders] = useState<GoogleDriveFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<GoogleDriveFolder | null>(null);
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { accessToken } = useAuth();

  const listFolders = async () => {
    if (!accessToken) {
      setError('Please sign in with Google first');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Use real Google Drive API
      const driveService = new GoogleDriveService(accessToken);
      const folderList = await driveService.listFolders();
      setFolders(folderList);
    } catch (err) {
      setError('Failed to load folders');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectFolder = async (folder: GoogleDriveFolder) => {
    setSelectedFolder(folder);
    setFiles([]);
    
    // Automatically process documents when folder is selected
    await processFolderDocuments(folder);
  };

  const listFiles = async (folderId: string) => {
    if (!accessToken) {
      setError('Please sign in with Google first');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Use real Google Drive API
      const driveService = new GoogleDriveService(accessToken);
      const fileList = await driveService.listFiles(folderId);
      setFiles(fileList);
    } catch (err) {
      setError('Failed to load files');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async (fileId: string, mimeType: string): Promise<string> => {
    if (!accessToken) {
      throw new Error('Please sign in with Google first');
    }

    try {
      const driveService = new GoogleDriveService(accessToken);
      return await driveService.downloadFile(fileId, mimeType);
    } catch (err) {
      setError('Failed to download file');
      console.error(err);
      throw err;
    }
  };

  const processFolderDocuments = async (folder: GoogleDriveFolder) => {
    if (!accessToken) return;

    try {
      const driveService = new GoogleDriveService(accessToken);
      const supabaseService = new SupabaseService();
      const embeddingService = new EmbeddingService();

      // Get files in the folder
      const files = await driveService.listFiles(folder.id);
      console.log(`Found ${files.length} supported files in folder "${folder.name}"`);
      
      // Process each file
      for (const file of files) {
        if (file.mimeType === 'application/pdf' || file.mimeType.startsWith('text/')) {
          try {
            // Skip files that are already indexed (deduplication)
            const alreadyIndexed = await supabaseService.chunkExists(file.id);
            if (alreadyIndexed) {
              console.log(`Skipping "${file.name}" — already indexed`);
              continue;
            }

            console.log(`Processing "${file.name}" (${file.mimeType})...`);

            // Download file content
            const content = await driveService.downloadFile(file.id, file.mimeType);
            
            // Parse content
            let textContent = content;
            if (file.mimeType === 'application/pdf') {
              textContent = await PDFParser.parsePDF(content);
            }

            if (!textContent || textContent.trim().length === 0) {
              console.warn(`No text content extracted from "${file.name}", skipping.`);
              continue;
            }
            
            // Chunk the text
            const chunks = embeddingService.chunkText(textContent);
            console.log(`Created ${chunks.length} chunks from "${file.name}"`);
            
            // Generate embeddings and store
            for (let i = 0; i < chunks.length; i++) {
              const chunk = chunks[i];
              try {
                const embedding = await embeddingService.generateEmbedding(chunk);
                await supabaseService.storeDocumentChunk({
                  content: chunk,
                  file_id: file.id,
                  file_name: file.name,
                  folder_id: folder.id,
                  embedding
                });
                console.log(`Stored chunk ${i + 1}/${chunks.length} for "${file.name}"`);
              } catch (chunkError) {
                console.error(`Error processing chunk ${i + 1} of "${file.name}":`, chunkError);
                // Continue with other chunks
              }
            }
          } catch (error) {
            console.error(`Error processing file ${file.name}:`, error);
          }
        }
      }
      console.log(`Finished processing folder "${folder.name}"`);
    } catch (error) {
      console.error('Error processing folder documents:', error);
    }
  };

  const value: DriveContextType = {
    folders,
    selectedFolder,
    files,
    loading,
    error,
    listFolders,
    selectFolder,
    listFiles,
    downloadFile,
  };

  return <DriveContext.Provider value={value}>{children}</DriveContext.Provider>;
};
