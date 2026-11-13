import React, { useState } from 'react';
import {
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Eye,
  Download,
  Trash2,
  RefreshCw,
  Plus,
  ShieldCheck,
  Calendar,
  FileCheck2,
  ExternalLink
} from 'lucide-react';
import {
  DirectoryEmployee,
  EmployeeDocument,
  DocumentCategory,
  VerificationStatus
} from '../../types/employeeDirectory';
import {
  calculateOnboardingChecklist,
  validateUploadedFile,
  ALLOWED_EXTENSIONS
} from '../../utils/employeeDb';
import { useTheme } from '../../context/ThemeContext';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { apiClient } from '../../utils/apiClient';

interface EmployeeDocumentsSectionProps {
  employee: DirectoryEmployee;
  documents: EmployeeDocument[];
  onSaveDocument: (doc: EmployeeDocument) => Promise<void>;
  onDeleteDocument: (docId: string) => Promise<void>;
}

const CATEGORIES: DocumentCategory[] = [
  'Identity Proof',
  'Address Proof',
  'Educational Certificate',
  'Employment Record',
  'Bank Document',
  'Statutory / Tax',
  'Other HR Record'
];

const DOCUMENT_TYPES = [
  'Aadhaar',
  'PAN',
  'Passport',
  'Resume',
  'Educational Certificate',
  'Experience Letter',
  'Offer Letter',
  'Appointment Letter',
  'Relieving Letter',
  'Salary Proof',
  'Bank Proof',
  'Other'
];

export const EmployeeDocumentsSection: React.FC<EmployeeDocumentsSectionProps> = ({
  employee,
  documents,
  onSaveDocument,
  onDeleteDocument
}) => {
  const { isDark } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [previewDoc, setPreviewDoc] = useState<EmployeeDocument | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<EmployeeDocument | null>(null);

  // Upload Form State
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<DocumentCategory>('Identity Proof');
  const [formIssueDate, setFormIssueDate] = useState('');
  const [formExpiryDate, setFormExpiryDate] = useState('');
  const [formVerificationStatus, setFormVerificationStatus] = useState<VerificationStatus>('Pending');
  const [formNotes, setFormNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const empDocs = documents.filter(d => d.employeeId === employee.employeeId);
  const checklist = calculateOnboardingChecklist(empDocs);

  const filteredDocs = empDocs.filter(d => {
    if (selectedCategory === 'All') return true;
    return d.category === selectedCategory;
  });

  const handleOpenUpload = (category?: DocumentCategory) => {
    setEditingDoc(null);
    setFormTitle('');
    setFormCategory(category || 'Identity Proof');
    setFormIssueDate('');
    setFormExpiryDate('');
    setFormVerificationStatus('Pending');
    setFormNotes('');
    setSelectedFile(null);
    setUploadError(null);
    setShowUploadModal(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateUploadedFile(file.name, file.size, file.type);
    if (!validation.valid) {
      setUploadError(validation.error || 'Invalid file.');
      setSelectedFile(null);
      return;
    }

    setUploadError(null);
    setSelectedFile(file);
    if (!formTitle) {
      // Auto-populate title from filename without extension
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setFormTitle(cleanName);
    }
  };

  const handleSubmitDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc && empDocs.length >= 20) {
      setUploadError('Maximum limit of 20 documents per employee has been reached.');
      return;
    }

    if (!formTitle.trim()) {
      setUploadError('Document title is required.');
      return;
    }

    if (!editingDoc && !selectedFile) {
      setUploadError('Please select a file to upload.');
      return;
    }

    setIsSubmitting(true);
    setUploadError(null);

    try {
      const docId = editingDoc ? editingDoc.id : `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      let fileDataBase64: string | undefined = editingDoc?.fileDataBase64;
      let storagePath: string | undefined = editingDoc?.storagePath;
      let originalFilename = editingDoc ? editingDoc.originalFilename : selectedFile!.name;
      let fileSizeBytes = editingDoc ? editingDoc.fileSizeBytes : selectedFile!.size;
      let mimeType = editingDoc ? editingDoc.mimeType : selectedFile!.type || 'application/octet-stream';
      let storedFilename = editingDoc ? editingDoc.storedFilename : `doc_${employee.employeeId}_${docId}`;

      if (selectedFile) {
        originalFilename = selectedFile.name;
        fileSizeBytes = selectedFile.size;
        mimeType = selectedFile.type || 'application/octet-stream';

        // Direct upload to Supabase Storage via backend API
        try {
          const token = apiClient.getToken();
          const formData = new FormData();
          formData.append('file', selectedFile);
          formData.append('employeeId', employee.employeeId);
          formData.append('category', formCategory);
          formData.append('title', formTitle.trim());

          const res = await fetch('/api/documents/upload', {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData
          });

          if (res.ok) {
            const data = await res.json();
            if (data.success && data.document) {
              storagePath = data.document.storagePath;
            }
          }
        } catch (uploadErr) {
          console.warn('[Storage] Backend upload attempt fell back to local cache:', uploadErr);
        }

        const arrayBuffer = await selectedFile.arrayBuffer();

        // Convert to Base64 for local offline resilient database storage and fast preview
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        fileDataBase64 = `data:${mimeType};base64,${btoa(binary)}`;
      }

      const newDoc: EmployeeDocument = {
        id: docId,
        employeeId: employee.employeeId,
        title: formTitle.trim(),
        category: formCategory,
        originalFilename,
        storedFilename,
        mimeType,
        fileSizeBytes,
        uploadDate: editingDoc ? editingDoc.uploadDate : new Date().toISOString(),
        issueDate: formIssueDate || undefined,
        expiryDate: formExpiryDate || undefined,
        verificationStatus: formVerificationStatus,
        verificationNotes: formNotes.trim() || undefined,
        verifiedBy: formVerificationStatus === 'Verified' ? 'HR Administrator' : undefined,
        verifiedAt: formVerificationStatus === 'Verified' ? new Date().toISOString() : undefined,
        lastModified: new Date().toISOString(),
        fileDataBase64,
        storagePath
      };

      await onSaveDocument(newDoc);
      setShowUploadModal(false);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to save document.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickStatusChange = async (doc: EmployeeDocument, status: VerificationStatus) => {
    const updated: EmployeeDocument = {
      ...doc,
      verificationStatus: status,
      verifiedBy: status === 'Verified' ? 'HR Administrator' : undefined,
      verifiedAt: status === 'Verified' ? new Date().toISOString() : undefined,
      lastModified: new Date().toISOString()
    };
    await onSaveDocument(updated);
  };

  const handleDelete = async (doc: EmployeeDocument) => {
    if (confirm(`Are you sure you want to delete "${doc.title}"? This cannot be undone.`)) {
      try {
        const token = apiClient.getToken();
        await fetch(`/api/documents/${doc.id}`, {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
      } catch (err) {
        console.warn('Backend document delete error:', err);
      }
      await onDeleteDocument(doc.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Onboarding Document Checklist Card */}
      <div
        className={`p-5 rounded-xl border space-y-3 transition ${
          isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <FileCheck2 className="w-4 h-4 text-[#CB1417]" />
            <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-black'}`}>
              HR Onboarding Document Checklist
            </h4>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              checklist.isComplete
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
            }`}>
              {checklist.totalCompleted} / {checklist.totalRequired} Mandatory Verified
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${checklist.isComplete ? 'bg-emerald-500' : 'bg-[#CB1417]'}`}
            style={{ width: `${(checklist.totalCompleted / checklist.totalRequired) * 100}%` }}
          />
        </div>

        {/* Checklist badges */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-[11px]">
          {[
            { label: 'Identity Proof', ok: checklist.hasIdentityProof, cat: 'Identity Proof' as DocumentCategory },
            { label: 'Address Proof', ok: checklist.hasAddressProof, cat: 'Address Proof' as DocumentCategory },
            { label: 'PAN Card', ok: checklist.hasPanProof, cat: 'Statutory / Tax' as DocumentCategory },
            { label: 'Bank Account Proof', ok: checklist.hasBankProof, cat: 'Bank Document' as DocumentCategory },
            { label: 'Education Degree', ok: checklist.hasEducationProof, cat: 'Educational Certificate' as DocumentCategory }
          ].map(item => (
            <div
              key={item.label}
              className={`p-2 rounded-lg border flex items-center justify-between transition ${
                item.ok
                  ? isDark ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-white border-zinc-200 text-zinc-600'
              }`}
            >
              <div className="flex items-center space-x-1.5 truncate">
                {item.ok ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                )}
                <span className="truncate font-medium">{item.label}</span>
              </div>
              {!item.ok && (
                <button
                  type="button"
                  onClick={() => handleOpenUpload(item.cat)}
                  className="text-[10px] text-[#CB1417] hover:underline font-bold ml-1 shrink-0"
                >
                  Upload
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Document Controls: Category Filter + Upload Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
              selectedCategory === 'All'
                ? 'bg-[#CB1417] text-white font-bold'
                : isDark ? 'bg-[#18181B] text-[#D4D4D8] hover:bg-[#27272A]' : 'bg-[#F4F4F6] text-[#27272A] hover:bg-[#E4E4E7]'
            }`}
          >
            All Files ({empDocs.length})
          </button>
          {CATEGORIES.map(cat => {
            const count = empDocs.filter(d => d.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-[#CB1417] text-white font-bold'
                    : isDark ? 'bg-[#18181B] text-[#D4D4D8] hover:bg-[#27272A]' : 'bg-[#F4F4F6] text-[#27272A] hover:bg-[#E4E4E7]'
                }`}
              >
                {cat} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>

        <div className="flex items-center space-x-3 ml-auto">
          <span className="text-[11px] font-medium text-zinc-500">
            {empDocs.length} of 20 documents uploaded
          </span>
          <button
            onClick={() => handleOpenUpload()}
            disabled={empDocs.length >= 20}
            className="flex items-center space-x-2 px-3.5 py-1.5 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-bold shadow-md shadow-[#CB1417]/25 transition cursor-pointer shrink-0 disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* Documents Table / List */}
      {filteredDocs.length === 0 ? (
        <div className={`p-8 rounded-xl border text-center space-y-3 ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
          <FileText className="w-10 h-10 text-zinc-400 mx-auto opacity-60" />
          <p className={`text-xs ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
            No documents found for this category. Click &quot;Upload Document&quot; to securely add employee files.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className={`border-b ${isDark ? 'bg-[#141416] text-[#A1A1AA] border-[#222226]' : 'bg-[#F4F4F6] text-[#71717A] border-[#E4E4E7]'}`}>
              <tr>
                <th className="p-3 font-semibold">Document Title</th>
                <th className="p-3 font-semibold">Category</th>
                <th className="p-3 font-semibold">Original File</th>
                <th className="p-3 font-semibold">Size</th>
                <th className="p-3 font-semibold">Verification Status</th>
                <th className="p-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-[#222226]' : 'divide-[#E4E4E7]'}`}>
              {filteredDocs.map(doc => {
                const isPdf = doc.mimeType === 'application/pdf' || doc.originalFilename.toLowerCase().endsWith('.pdf');
                return (
                  <tr key={doc.id} className={isDark ? 'hover:bg-[#141416]' : 'hover:bg-[#FAFAFC]'}>
                    <td className="p-3">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-[#CB1417] shrink-0" />
                        <div>
                          <span className={`font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
                            {doc.title}
                          </span>
                          {doc.expiryDate && (
                            <span className="block text-[10px] text-zinc-500">
                              Expires: {doc.expiryDate}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-zinc-500 font-medium">{doc.category}</td>
                    <td className="p-3 font-mono text-[11px] truncate max-w-[160px]" title={doc.originalFilename}>
                      {doc.originalFilename}
                    </td>
                    <td className="p-3 text-zinc-500">{(doc.fileSizeBytes / 1024).toFixed(0)} KB</td>
                    <td className="p-3">
                      <select
                        value={doc.verificationStatus}
                        onChange={(e) => handleQuickStatusChange(doc, e.target.value as VerificationStatus)}
                        className={`text-[10px] font-semibold px-2 py-1 rounded-md border outline-none cursor-pointer ${
                          doc.verificationStatus === 'Verified'
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                            : doc.verificationStatus === 'Rejected'
                            ? 'bg-[#ED1F24]/10 text-[#ED1F24] border-[#ED1F24]/30'
                            : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                        }`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Verified">Verified</option>
                        <option value="Rejected">Rejected</option>
                        <option value="Not Required">Not Required</option>
                      </select>
                      {doc.verificationNotes && (
                        <p className="text-[10px] text-zinc-500 mt-0.5 truncate max-w-[140px]" title={doc.verificationNotes}>
                          {doc.verificationNotes}
                        </p>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => setPreviewDoc(doc)}
                          className={`p-1.5 rounded-lg border transition cursor-pointer ${
                            isDark ? 'hover:bg-[#222226] border-[#2A2A2E] text-zinc-300' : 'hover:bg-[#E4E4E7] border-zinc-200 text-zinc-700'
                          }`}
                          title="Preview Document"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (doc.fileDataBase64) {
                              const a = window.document.createElement('a');
                              a.href = doc.fileDataBase64;
                              a.download = doc.originalFilename;
                              window.document.body.appendChild(a);
                              a.click();
                              window.document.body.removeChild(a);
                            }
                          }}
                          className={`p-1.5 rounded-lg border transition cursor-pointer ${
                            isDark ? 'hover:bg-[#222226] border-[#2A2A2E] text-zinc-300' : 'hover:bg-[#E4E4E7] border-zinc-200 text-zinc-700'
                          }`}
                          title="Download Document"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(doc)}
                          className={`p-1.5 rounded-lg border transition cursor-pointer text-red-500 ${
                            isDark ? 'hover:bg-red-950/30 border-[#2A2A2E]' : 'hover:bg-red-50 border-zinc-200'
                          }`}
                          title="Delete Document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`max-w-lg w-full rounded-2xl border shadow-2xl p-6 space-y-4 transition-colors ${
              isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className={`text-base font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
                <Upload className="w-4 h-4 text-[#CB1417]" />
                <span>Upload Employee Document</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  isDark ? 'hover:bg-[#222226] text-[#A1A1AA]' : 'hover:bg-[#E4E4E7] text-[#71717A]'
                }`}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitDocument} className="space-y-4 text-xs">
              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                  Select File (PDF, JPG, PNG, DOCX, XLSX - Max 15MB) *
                </label>
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                  className={`w-full p-2 rounded-lg border text-xs cursor-pointer ${
                    isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                  }`}
                />
                {selectedFile && (
                  <p className="text-[11px] text-emerald-500 mt-1">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                  Document Title *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Aadhaar Card Copy or Degree Certificate"
                  className={`w-full px-3 py-2 rounded-lg border outline-none ${
                    isDark ? 'bg-[#141416] border-[#27272A] text-white focus:border-[#CB1417]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black focus:border-[#CB1417]'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as DocumentCategory)}
                    className={`w-full px-3 py-2 rounded-lg border outline-none ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  >
                    {DOCUMENT_TYPES.map(docType => (
                      <option key={docType} value={docType}>{docType}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Verification Status
                  </label>
                  <select
                    value={formVerificationStatus}
                    onChange={(e) => setFormVerificationStatus(e.target.value as VerificationStatus)}
                    className={`w-full px-3 py-2 rounded-lg border outline-none ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Verified">Verified</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Not Required">Not Required</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Issue Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formIssueDate}
                    onChange={(e) => setFormIssueDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border outline-none ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Expiry Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formExpiryDate}
                    onChange={(e) => setFormExpiryDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border outline-none ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                  Verification Notes / Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Verified with original physical card"
                  className={`w-full px-3 py-2 rounded-lg border outline-none resize-none ${
                    isDark ? 'bg-[#141416] border-[#27272A] text-white focus:border-[#CB1417]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black focus:border-[#CB1417]'
                  }`}
                />
              </div>

              {uploadError && (
                <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-500 text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className={`px-4 py-2 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    isDark ? 'bg-[#141416] text-[#A1A1AA] border-[#27272A]' : 'bg-[#F4F4F6] text-[#52525B] border-[#E4E4E7]'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-[#CB1417] text-white hover:bg-[#ED1F24] disabled:opacity-50 transition cursor-pointer shadow-md shadow-[#CB1417]/25"
                >
                  {isSubmitting ? 'Saving...' : 'Upload & Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <DocumentPreviewModal
          document={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
};
