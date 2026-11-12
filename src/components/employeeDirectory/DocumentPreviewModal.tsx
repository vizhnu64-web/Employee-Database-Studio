import React, { useEffect, useState } from 'react';
import { X, Download, ExternalLink, FileText, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { EmployeeDocument } from '../../types/employeeDirectory';
import { useTheme } from '../../context/ThemeContext';

interface DocumentPreviewModalProps {
  document: EmployeeDocument;
  onClose: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({ document, onClose }) => {
  const { isDark } = useTheme();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        if (document.fileDataBase64) {
          // Parse base64 into Blob
          const base64Data = document.fileDataBase64.includes(';base64,')
            ? document.fileDataBase64.split(';base64,')[1]
            : document.fileDataBase64;
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: document.mimeType || 'application/octet-stream' });
          createdUrl = URL.createObjectURL(blob);
          if (active) setBlobUrl(createdUrl);
        } else if (document.id || document.storagePath) {
          // Fetch short-lived signed URL or direct download stream from backend
          const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
          const previewEndpoint = document.id ? `/api/documents/preview/${document.id}` : null;
          
          let signedUrl: string | null = null;
          if (previewEndpoint) {
            const res = await fetch(previewEndpoint, {
              headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
              const data = await res.json();
              if (data.signedUrl) {
                signedUrl = data.signedUrl;
              }
            }
          }

          if (!signedUrl && document.storagePath) {
            const res = await fetch(`/api/storage/signed-url?bucket=employee-documents&path=${encodeURIComponent(document.storagePath)}`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
              const data = await res.json();
              if (data.signedUrl) {
                signedUrl = data.signedUrl;
              }
            }
          }

          if (signedUrl && active) {
            setBlobUrl(signedUrl);
          } else if (document.id) {
            // Fallback direct backend stream
            if (active) setBlobUrl(`/api/documents/download/${document.id}`);
          } else {
            if (active) setError('Document preview link could not be generated.');
          }
        } else {
          if (active) setError('Document file data is not available for preview.');
        }
      } catch (err: any) {
        if (active) setError(err.message || 'Error generating document preview.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [document]);

  const handleDownload = () => {
    if (blobUrl) {
      const a = window.document.createElement('a');
      a.href = blobUrl;
      a.download = document.originalFilename || 'document';
      a.target = '_blank';
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
    } else if (document.id) {
      window.open(`/api/documents/download/${document.id}`, '_blank');
    }
  };

  const isPdf = document.mimeType === 'application/pdf' || document.originalFilename.toLowerCase().endsWith('.pdf');
  const isImage = document.mimeType.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(document.originalFilename);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className={`w-full max-w-4xl h-[85vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-colors ${
          isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
        }`}
      >
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-[#222222] bg-[#141416]' : 'border-[#E4E4E7] bg-[#FAFAFC]'}`}>
          <div className="flex items-center space-x-3 truncate">
            {isPdf ? (
              <FileText className="w-5 h-5 text-[#CB1417] shrink-0" />
            ) : isImage ? (
              <ImageIcon className="w-5 h-5 text-blue-500 shrink-0" />
            ) : (
              <FileText className="w-5 h-5 text-amber-500 shrink-0" />
            )}
            <div className="truncate">
              <h3 className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-black'}`}>
                {document.title}
              </h3>
              <p className={`text-[11px] truncate ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
                {document.originalFilename} • {(document.fileSizeBytes / 1024).toFixed(1)} KB • {document.category}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownload}
              className={`p-2 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer ${
                isDark ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#27272A]' : 'bg-[#F4F4F6] hover:bg-[#E4E4E7] text-black border-[#E4E4E7]'
              }`}
              title="Download Document"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition cursor-pointer ${
                isDark ? 'hover:bg-[#222226] text-[#A1A1AA]' : 'hover:bg-[#E4E4E7] text-[#71717A]'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 bg-black/40 overflow-auto flex items-center justify-center p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center space-y-2 text-xs text-zinc-400">
              <div className="w-6 h-6 border-2 border-[#CB1417] border-t-transparent rounded-full animate-spin" />
              <span>Loading document preview...</span>
            </div>
          ) : error ? (
            <div className={`p-6 rounded-xl border max-w-md text-center space-y-3 ${isDark ? 'bg-[#18181B] border-[#2A2A2E] text-white' : 'bg-white border-zinc-200 text-black'}`}>
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="text-xs font-medium">{error}</p>
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-[#CB1417] text-white rounded-lg text-xs font-bold hover:bg-[#ED1F24] transition cursor-pointer"
              >
                Download / Open File Directly
              </button>
            </div>
          ) : blobUrl && isPdf ? (
            <iframe
              src={blobUrl}
              title={document.title}
              className="w-full h-full rounded-lg border border-zinc-700 bg-white"
            />
          ) : blobUrl && isImage ? (
            <div className="max-w-full max-h-full flex items-center justify-center">
              <img
                src={blobUrl}
                alt={document.title}
                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-lg border border-zinc-700"
              />
            </div>
          ) : (
            <div className={`p-8 rounded-xl border max-w-md text-center space-y-4 ${isDark ? 'bg-[#141416] border-[#222226] text-white' : 'bg-white border-zinc-200 text-black'}`}>
              <FileText className="w-12 h-12 text-[#CB1417] mx-auto opacity-80" />
              <div>
                <h4 className="text-sm font-bold">{document.title}</h4>
                <p className="text-xs opacity-70 mt-1">
                  Office documents (.docx, .xlsx, .doc) can be downloaded or opened with the system viewer.
                </p>
              </div>
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-[#CB1417] text-white rounded-lg text-xs font-bold hover:bg-[#ED1F24] transition cursor-pointer flex items-center space-x-2 mx-auto"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open in Default Windows App</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
