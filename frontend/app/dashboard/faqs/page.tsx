"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { listFAQs, createFAQ, updateFAQ, deleteFAQ, FAQResponse, importFAQsCSV } from '@/services/faq';

export default function FAQManagement() {
  const { token, activeBusiness, activeBusinessLoading } = useAuth();

  const [faqs, setFaqs] = useState<FAQResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [reindexAfterImport, setReindexAfterImport] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<any | null>(null);
  const [showImportPanel, setShowImportPanel] = useState(false);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedFaq, setSelectedFaq] = useState<FAQResponse | null>(null);
  
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Active accordion trackers
  const [openAccordionId, setOpenAccordionId] = useState<string | null>(null);

  const fetchFaqs = async () => {
    if (!token || !activeBusiness) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listFAQs(activeBusiness.id, token);
      setFaqs(data);
    } catch (err: any) {
      setError(err.message || "Failed to retrieve FAQ list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeBusiness) {
      fetchFaqs();
    }
  }, [activeBusiness, token]);

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setSelectedFaq(null);
    setQuestion('');
    setAnswer('');
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (faq: FAQResponse) => {
    setModalMode('edit');
    setSelectedFaq(faq);
    setQuestion(faq.question);
    setAnswer(faq.answer);
    setError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedFaq(null);
    setQuestion('');
    setAnswer('');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeBusiness) return;

    if (!question.trim()) {
      setError("Question is required.");
      return;
    }
    if (!answer.trim()) {
      setError("Answer is required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (modalMode === 'create') {
        const newFaq = await createFAQ(activeBusiness.id, { question, answer }, token);
        setFaqs(prev => [newFaq, ...prev]);
        setSuccessMsg("FAQ added successfully!");
      } else if (modalMode === 'edit' && selectedFaq) {
        const updatedFaq = await updateFAQ(selectedFaq.id, { question, answer }, token);
        setFaqs(prev => prev.map(f => f.id === selectedFaq.id ? updatedFaq : f));
        setSuccessMsg("FAQ updated successfully!");
      }
      handleCloseModal();
      // Auto dismiss success toast
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to process FAQ request.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFaq = async (id: string, questionSnippet: string) => {
    if (!token) return;
    const confirmDelete = window.confirm(`Are you sure you want to delete this FAQ?\n"${questionSnippet.substring(0, 50)}..."\nThis action cannot be undone.`);
    if (!confirmDelete) return;

    setError(null);
    setSuccessMsg(null);
    try {
      await deleteFAQ(id, token);
      setFaqs(prev => prev.filter(f => f.id !== id));
      setSuccessMsg("FAQ deleted successfully.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to delete FAQ.");
    }
  };

  const toggleAccordion = (id: string) => {
    setOpenAccordionId(prev => prev === id ? null : id);
  };

  const handleImportCSV = async () => {
    if (!csvFile || !activeBusiness || !token || importing) return;
    setImporting(true);
    setError(null);
    setImportSummary(null);
    setSuccessMsg(null);

    try {
      const summary = await importFAQsCSV(activeBusiness.id, csvFile, reindexAfterImport, token);
      setImportSummary(summary);
      
      if (summary.successful_rows > 0) {
        setSuccessMsg(`Successfully imported ${summary.successful_rows} FAQs!`);
        await fetchFaqs();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred uploading the CSV file.");
    } finally {
      setImporting(false);
    }
  };

  const downloadFAQTemplate = () => {
    const headers = "question,answer\n";
    const row1 = "Do you accept Mobile Money (MoMo)?,Yes we accept MoMo payments on MTN and Telecel.\n";
    const row2 = "Do you deliver to Accra?,Yes we ship nationwide via VIP Bus or OA Travel.\n";
    const blob = new Blob([headers + row1 + row2], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "faqs_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            Please register or select an active business profile from the sidebar console before managing FAQs.
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
          <h2 className="text-2xl font-extrabold text-white">Frequently Asked Questions</h2>
          <p className="text-xs text-slate-400 mt-1">
            Setup common questions and responses for customers, loaded dynamically by the chatbot for <span className="text-blue-400 font-semibold">{activeBusiness.business_name}</span>.
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white text-center hover:shadow-lg hover:shadow-blue-500/20 active:translate-y-0.5 transition duration-200"
        >
          + Add FAQ
        </button>
      </div>

      {/* Success alert */}
      {successMsg && (
        <div className="p-3 text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-900/50 rounded-lg animate-fade-in">
          <span className="font-semibold">Success:</span> {successMsg}
        </div>
      )}

      {/* Error alert */}
      {error && !isModalOpen && (
        <div className="p-3 text-xs text-rose-400 bg-rose-955/20 border border-rose-900/50 rounded-lg">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      {/* CSV Import Panel */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/10 backdrop-blur-xl shadow-lg p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-850 pb-3 cursor-pointer select-none" onClick={() => setShowImportPanel(!showImportPanel)}>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-405" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <h3 className="text-sm font-bold text-slate-200">Bulk Import FAQs (CSV)</h3>
          </div>
          <span className="text-xs text-slate-500 hover:text-slate-350 font-medium">
            {showImportPanel ? "Collapse [-]" : "Expand [+]"}
          </span>
        </div>

        {showImportPanel && (
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs bg-slate-950/40 p-3 rounded-lg border border-slate-900/60">
              <span className="text-slate-400">Download the default FAQs template format:</span>
              <button
                type="button"
                onClick={downloadFAQTemplate}
                className="px-3.5 py-1.5 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 hover:text-white text-slate-300 font-semibold cursor-pointer transition text-xs shrink-0"
              >
                Download CSV Template
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select CSV File</label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setCsvFile(e.target.files[0]);
                    setImportSummary(null);
                  }
                }}
                className="text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-600/20 file:text-blue-400 hover:file:bg-blue-600/30 file:cursor-pointer cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="reindex_faq_chk"
                checked={reindexAfterImport}
                onChange={(e) => setReindexAfterImport(e.target.checked)}
                className="w-4 h-4 rounded border-slate-800 bg-slate-950/40 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
              />
              <label htmlFor="reindex_faq_chk" className="text-xs text-slate-400 select-none cursor-pointer">
                Rebuild search index immediately after successful import
              </label>
            </div>

            <button
              type="button"
              onClick={handleImportCSV}
              disabled={!csvFile || importing}
              className="py-2.5 px-4 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition disabled:opacity-40 flex items-center justify-center gap-2 shadow-md hover:shadow-blue-500/10 cursor-pointer w-full md:w-auto self-start"
            >
              {importing ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Importing FAQs...
                </>
              ) : (
                "Upload & Import CSV"
              )}
            </button>

            {importSummary && (
              <div className="mt-4 border-t border-slate-900/60 pt-4 flex flex-col gap-3 text-xs">
                <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[10px]">Import Results Summary:</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-950/40 border border-slate-900/60 p-2.5 rounded-lg flex flex-col items-center">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Rows</span>
                    <span className="text-lg font-extrabold text-slate-200 mt-1">{importSummary.total_rows}</span>
                  </div>
                  <div className="bg-emerald-955/10 border border-emerald-900/30 p-2.5 rounded-lg flex flex-col items-center">
                    <span className="text-[10px] text-emerald-500/70 uppercase font-semibold">Successful</span>
                    <span className="text-lg font-extrabold text-emerald-450 mt-1">{importSummary.successful_rows}</span>
                  </div>
                  <div className="bg-rose-955/10 border border-rose-900/30 p-2.5 rounded-lg flex flex-col items-center">
                    <span className="text-[10px] text-rose-500/70 uppercase font-semibold">Failed</span>
                    <span className="text-lg font-extrabold text-rose-455 mt-1">{importSummary.failed_rows}</span>
                  </div>
                </div>

                {importSummary.errors.length > 0 && (
                  <div className="flex flex-col gap-2 mt-2">
                    <span className="text-rose-450 font-bold">Row-level errors / warnings:</span>
                    <div className="bg-rose-955/5 border border-rose-900/20 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-[11px] text-rose-355 leading-relaxed space-y-1">
                      {importSummary.errors.map((err: string, eIdx: number) => (
                        <div key={eIdx}>• {err}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content Section */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : faqs.length > 0 ? (
        <div className="flex flex-col gap-4">
          {faqs.map((faq) => {
            const isOpen = openAccordionId === faq.id;
            return (
              <div 
                key={faq.id} 
                className={`rounded-2xl border transition-all duration-350 bg-slate-950/20 backdrop-blur-md overflow-hidden ${
                  isOpen ? 'border-blue-500/50 shadow-md shadow-blue-500/5' : 'border-slate-800/80 hover:border-slate-700/60'
                }`}
              >
                {/* Header Clickable */}
                <div 
                  onClick={() => toggleAccordion(faq.id)}
                  className="flex items-center justify-between p-5 cursor-pointer select-none gap-4"
                >
                  <h3 className="text-sm font-bold text-slate-100 hover:text-blue-400 transition duration-150 pr-4">
                    {faq.question}
                  </h3>
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Action buttons */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditModal(faq);
                      }}
                      className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/40 text-slate-400 hover:text-white transition"
                      title="Edit FAQ"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFaq(faq.id, faq.question);
                      }}
                      className="p-1.5 rounded-lg border border-slate-800 hover:border-rose-900/60 bg-slate-900/40 text-slate-400 hover:text-rose-455 transition"
                      title="Delete FAQ"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    
                    {/* Chevron Indicator */}
                    <svg 
                      className={`w-4 h-4 text-slate-400 transition-transform duration-350 ${isOpen ? 'rotate-180 text-blue-450' : ''}`}
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Collapsible Content */}
                <div 
                  className={`transition-all duration-350 ease-in-out ${
                    isOpen ? 'max-h-[800px] border-t border-slate-900/60 p-5 bg-slate-950/10' : 'max-h-0'
                  }`}
                >
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {faq.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/10 gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-slate-500 border border-slate-800 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold text-slate-350">No FAQs Added</h4>
            <p className="text-xs text-slate-500">Add common queries to build a database of precise instant-replies.</p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition mt-2"
          >
            + Create First FAQ
          </button>
        </div>
      )}

      {/* Add / Edit Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl flex flex-col gap-4 animate-zoom-in">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-900 pb-3">
              <h3 className="text-base font-extrabold text-white">
                {modalMode === 'create' ? 'Add New FAQ' : 'Edit FAQ'}
              </h3>
              <button 
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Error */}
            {error && (
              <div className="p-3 text-xs text-rose-450 bg-rose-955/20 border border-rose-900/50 rounded-lg">
                <span className="font-semibold">Error:</span> {error}
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
              
              {/* Question */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Question
                </label>
                <input 
                  type="text" 
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. Do you accept mobile money payments?"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-800 bg-slate-900 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-150"
                  disabled={submitting}
                />
              </div>

              {/* Answer */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Answer
                </label>
                <textarea 
                  rows={5}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="e.g. Yes, we accept MoMo on MTN (+233 24...) and Telecel. We also support standard cash on delivery."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-800 bg-slate-900 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-150 resize-y"
                  disabled={submitting}
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-900 pt-4 mt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-800 hover:border-slate-700 bg-slate-900/40 text-slate-300 hover:text-white transition"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white hover:shadow-lg hover:shadow-blue-500/20 transition flex items-center justify-center min-w-[80px]"
                  disabled={submitting}
                >
                  {submitting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    modalMode === 'create' ? 'Save FAQ' : 'Save Changes'
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
