import React, { useEffect } from 'react';
import { useDrive } from '../contexts/DriveContext';
import { Folder, FolderOpen, FileText, Loader2, AlertCircle } from 'lucide-react';

const Sidebar: React.FC = () => {
  const { 
    folders, 
    selectedFolder, 
    files, 
    loading, 
    error, 
    listFolders, 
    selectFolder, 
    listFiles 
  } = useDrive();

  useEffect(() => {
    listFolders();
  }, []);

  const handleFolderClick = (folder: any) => {
    selectFolder(folder);
    listFiles(folder.id);
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/pdf') {
      return <FileText className="w-4 h-4 text-red-500" />;
    }
    if (mimeType.startsWith('text/')) {
      return <FileText className="w-4 h-4 text-blue-500" />;
    }
    return <FileText className="w-4 h-4 text-gray-500" />;
  };

  return (
    <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-colors duration-200">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <Folder className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
          Google Drive
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
            <span className="ml-2 text-gray-600 dark:text-gray-400">Loading folders...</span>
          </div>
        )}
        
        {error && (
          <div className="flex items-center p-4 text-red-600">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        
        {!loading && !error && (
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Folders</h3>
            <div className="space-y-1">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => handleFolderClick(folder)}
                  className={`w-full flex items-center p-2 text-left rounded-lg transition-colors ${
                    selectedFolder?.id === folder.id
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {selectedFolder?.id === folder.id ? (
                    <FolderOpen className="w-4 h-4 mr-2" />
                  ) : (
                    <Folder className="w-4 h-4 mr-2" />
                  )}
                  <span className="text-sm truncate">{folder.name}</span>
                </button>
              ))}
            </div>
            
            {selectedFolder && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Files in {selectedFolder.name}
                </h3>
                <div className="space-y-1">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      {getFileIcon(file.mimeType)}
                      <span className="ml-2 text-sm truncate">{file.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
