"use client";

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { listDocuments, uploadDocument, deleteDocument, DocumentResponse } from '@/services/document';

export default function DocumentManagement() {
  const { token, activeBusiness, activeBusinessLoading } = useAuth();
  
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Drag and Drop state
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Text preview modal state
  const [previewDoc, setPreviewDoc] = useState<DocumentResponse | null>(null);

  const fetchDocuments = async (showSpinner = true) => {
    if (!token || !activeBusiness) return;
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const data = await listDocuments(activeBusiness.id, token);
      setDocuments(data);
    } catch (err: any) {
      setError(err.message || "Failed to retrieve documents list.");
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    if (activeBusiness) {
      fetchDocuments();
    }
  }, [activeBusiness, token]);

  // Premium feature: Auto-poll if there are pending files
  useEffect(() => {
    const hasPending = documents.some(doc => doc.processed_status === 'pending');
    if (!hasPending || !token || !activeBusiness) return;

    const interval = setInterval(() => {
      fetchDocuments(false); // poll silently without loading spinner
    }, 3000);

    return () => clearInterval(interval);
  }, [documents, token, activeBusiness]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    if (!token || !activeBusiness) return;

    // Check size limit: 5MB
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError(`File "${file.name}" is too large. Maximum size is 5MB.`);
      return;
    }

    // Check extension
    const allowed = [".txt", ".csv", ".pdf", ".docx"];
    const ext = "." + file.name.split('.').pop()?.toLowerCase();
    if (!allowed.includes(ext)) {
      setError(`Unsupported file format "${ext}". Allowed: .txt, .csv, .pdf, .docx`);
      return;
    }

    setUploading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const uploaded = await uploadDocument(activeBusiness.id, file, token);
      setDocuments(prev => [uploaded, ...prev]);
      setSuccessMsg(`Document "${file.name}" uploaded successfully and is being processed!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || `Failed to upload "${file.name}".`);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!token) return;
    const confirmDelete = window.confirm(`Are you sure you want to delete "${name}"?\nThis will remove the document metadata and delete the physical file.`);
    if (!confirmDelete) return;

    setError(null);
    setSuccessMsg(null);

    try {
      await deleteDocument(id, token);
      setDocuments(prev => prev.filter(d => d.id !== id));
      setSuccessMsg(`Document deleted successfully.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      if (previewDoc?.id === id) {
        setPreviewDoc(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete document.");
    }
  };

  const getBadgeColor = (type: string) => {
    const ext = type.toLowerCase();
    if (ext === '.pdf') return 'bg-red-950/40 text-red-400 border-red-900/30';
    if (ext === '.docx') return 'bg-blue-950/40 text-blue-400 border-blue-900/30';
    if (ext === '.csv') return 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30';
    return 'bg-slate-900 border-slate-800 text-slate-300';
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'processed') {
      return (
        <span className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold bg-emerald-950/50 text-emerald-405 border border-emerald-900/40">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          Ready
        </span>
      );
    }
    if (s === 'failed') {
      return (
        <span className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold bg-rose-955/50 text-rose-455 border border-rose-900/40">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
          Failed
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold bg-blue-950/40 text-blue-400 border border-blue-900/30">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
        Processing
      </span>
    );
  };

  // 1. Loading active business profile state
  if (activeBusinessLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // 2. Zero-state business context warning
  if (!activeBusiness) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/10 gap-5 max-w-xl mx-auto mt-10">
        <div className="w-14 h-14 rounded-2xl bg-amber-955/20 text-amber-500 border border-amber-900/30 flex items-center justify-center">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="text-lg font-bold text-slate-200">No Active Business Selected</h3>
          <p className="text-xs text-slate-450 leading-relaxed max-w-sm">
            Please register or select an active business profile from the sidebar console before managing documents.
          </p>
        </div>
        <Link
          href="/dashboard/businesses"
          className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition"
        >
          Go to Businesses
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex flex-col">
          <h2 className="text-2xl font-extrabold text-white">Document Knowledge Base</h2>
          <p className="text-xs text-slate-400 mt-1">
            Upload text documents, FAQs, inventory lists, or guides to act as the raw intelligence of your AI Agent under <span className="text-blue-400 font-semibold">{activeBusiness.business_name}</span>.
          </p>
        </div>
        <button
          onClick={() => fetchDocuments(true)}
          className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-850 hover:border-slate-800 bg-slate-950/20 text-slate-300 hover:text-white transition flex items-center gap-1.5 self-start sm:self-center"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3m0 0l3 3m-3-3v12" />
          </svg>
          Refresh List
        </button>
      </div>

      {/* Success alert */}
      {successMsg && (
        <div className="p-3 text-xs text-emerald-450 bg-emerald-950/30 border border-emerald-900/50 rounded-lg animate-fade-in">
          <span className="font-semibold">Success:</span> {successMsg}
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="p-3 text-xs text-rose-455 bg-rose-955/20 border border-rose-900/50 rounded-lg">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      {/* Drag & Drop Upload Zone */}
      <div 
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center p-8 text-center rounded-2xl border-2 border-dashed transition duration-300 bg-slate-950/10 backdrop-blur-md gap-4 min-h-[180px] ${
          dragActive 
            ? 'border-blue-500 bg-blue-950/10 shadow-md shadow-blue-500/5' 
            : 'border-slate-800 hover:border-slate-700/60'
        }`}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          onChange={handleFileChange}
          accept=".txt,.csv,.pdf,.docx"
          className="hidden"
        />

        <div className={`w-12 h-12 rounded-xl border flex items-center justify-center transition duration-300 ${
          uploading ? 'bg-blue-955/20 text-blue-500 border-blue-900/30 animate-pulse' : 'bg-slate-900 border-slate-800 text-slate-400'
        }`}>
          {uploading ? (
            <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3m0 0l3 3m-3-3v12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-slate-200">
            {uploading ? 'Uploading your document...' : 'Drag & drop your document here, or click to browse'}
          </p>
          <p className="text-[10px] text-slate-500">
            Supports TXT, CSV, PDF, or DOCX (Max 5MB file size limit)
          </p>
        </div>

        {!uploading && (
          <button 
            type="button" 
            onClick={onButtonClick}
            className="px-4 py-2 rounded-lg text-[11px] font-bold bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-200 transition"
          >
            Choose File
          </button>
        )}
      </div>

      {/* Documents List */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-slate-300">Uploaded Knowledge Bases</h3>
        
        {loading && documents.length === 0 ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : documents.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-950/10 backdrop-blur-md shadow-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-4 px-6">Document Name</th>
                  <th className="py-4 px-6 text-center">Format</th>
                  <th className="py-4 px-6">Upload Date</th>
                  <th className="py-4 px-6">Processing Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/50">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-950/30 transition duration-150">
                    <td className="py-4 px-6 font-bold text-slate-200 truncate max-w-[200px] sm:max-w-xs">
                      {doc.file_name}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold border ${getBadgeColor(doc.file_type)}`}>
                        {doc.file_type.substring(1)}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-400">
                      {new Date(doc.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-4 px-6">
                      {getStatusBadge(doc.processed_status)}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {doc.processed_status === 'processed' && (
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/40 text-slate-300 hover:text-white transition font-semibold"
                          >
                            Preview Text
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(doc.id, doc.file_name)}
                          className="p-1.5 rounded-lg border border-slate-800 hover:border-rose-900/60 bg-slate-900/40 text-slate-400 hover:text-rose-455 transition"
                          title="Delete Document"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/10 gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-900 text-slate-500 border border-slate-800 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-sm font-semibold text-slate-350">No Documents Uploaded</h4>
              <p className="text-xs text-slate-550 max-w-xs">Upload FAQs list, catalogs, or business profiles to act as local vector references for AI chat queries.</p>
            </div>
          </div>
        )}
      </div>

      {/* Extracted Text Preview Modal Dialog */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl max-h-[85vh] rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl flex flex-col gap-4 animate-zoom-in">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-900 pb-3">
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-extrabold text-white truncate max-w-md">
                  Extracted Text: {previewDoc.file_name}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[8px] uppercase font-bold border ${getBadgeColor(previewDoc.file_type)}`}>
                  {previewDoc.file_type.substring(1)}
                </span>
              </div>
              <button 
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto bg-slate-900/60 p-4 rounded-xl border border-slate-900 text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap max-h-[55vh]">
              {previewDoc.extracted_text ? previewDoc.extracted_text : (
                <span className="text-slate-500 italic">No text extracted or document is empty.</span>
              )}
            </div>

            {/* Close Button */}
            <div className="flex items-center justify-end border-t border-slate-900 pt-4 mt-2">
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-5 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition"
              >
                Close Preview
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
