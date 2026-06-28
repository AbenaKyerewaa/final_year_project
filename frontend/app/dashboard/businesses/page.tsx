"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { deleteBusiness } from '@/services/business';

export default function BusinessList() {
  const { token, businesses, activeBusiness, setActiveBusiness, refreshBusinesses, activeBusinessLoading } = useAuth();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle business activation
  const handleActivate = (bizId: string) => {
    const biz = businesses.find(b => b.id === bizId);
    if (biz) {
      setActiveBusiness(biz);
    }
  };

  // Handle delete action
  const handleDelete = async (bizId: string, bizName: string) => {
    if (!token) return;
    
    const confirmDelete = window.confirm(`Are you sure you want to permanently delete the business "${bizName}"? All associated products, services, FAQs, and documents will be deleted. This action cannot be undone.`);
    if (!confirmDelete) return;

    setDeletingId(bizId);
    setError(null);
    
    try {
      await deleteBusiness(bizId, token);
      await refreshBusinesses();
    } catch (err: any) {
      setError(err.message || "Failed to delete business profile.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex flex-col">
          <h2 className="text-2xl font-extrabold text-white">Business Profiles</h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage your registered SME profiles. Scoping controls which business is currently managed.
          </p>
        </div>
        <Link
          href="/dashboard/businesses/create"
          className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white text-center hover:shadow-lg hover:shadow-blue-500/20 active:translate-y-0.5 transition duration-200"
        >
          + Add New Business
        </Link>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-3 text-xs text-rose-455 bg-rose-955/20 border border-rose-900/50 rounded-lg">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      {/* Grid of Business Profiles */}
      {activeBusinessLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : businesses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {businesses.map((biz) => {
            const isActive = activeBusiness?.id === biz.id;
            const isDeleting = deletingId === biz.id;

            return (
              <div
                key={biz.id}
                className={`p-6 rounded-2xl border transition duration-300 flex flex-col justify-between min-h-[220px] bg-slate-950/10 backdrop-blur-md relative ${
                  isActive
                    ? 'border-blue-500/50 shadow-lg shadow-blue-900/5'
                    : 'border-slate-800/80 hover:border-slate-700/80'
                }`}
              >
                {/* Active Indicator Badge */}
                {isActive && (
                  <span className="absolute top-4 right-4 px-2 py-0.5 rounded text-[9px] font-bold bg-blue-950/50 text-blue-400 border border-blue-800/50 uppercase tracking-wider">
                    Active Console
                  </span>
                )}

                {/* Info summary */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                    {biz.category}
                  </span>
                  <h3 className="text-lg font-bold text-slate-200 leading-tight">
                    {biz.business_name}
                  </h3>
                  <p className="text-xs text-slate-450 line-clamp-2 mt-1">
                    {biz.description || "No description provided."}
                  </p>
                  
                  {/* Small metadata details */}
                  <div className="flex flex-col gap-1 mt-2 text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-600">Location:</span>
                      <span className="truncate">{biz.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-600">Phone:</span>
                      <span>{biz.phone}</span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-900/60">
                  {isActive ? (
                    <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-950/20 text-blue-500 border border-blue-900/30 flex items-center gap-1 cursor-default select-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                      Currently Managing
                    </span>
                  ) : (
                    <button
                      onClick={() => handleActivate(biz.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-800 bg-slate-900/20 text-slate-300 hover:text-white hover:bg-slate-800 transition duration-200"
                    >
                      Select Active
                    </button>
                  )}

                  <div className="ml-auto flex items-center gap-2">
                    <Link
                      href={`/dashboard/businesses/${biz.id}/edit`}
                      className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/10 text-slate-400 hover:text-white hover:bg-slate-800 transition duration-200"
                      title="Edit business profile"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </Link>
                    <button
                      onClick={() => handleDelete(biz.id, biz.business_name)}
                      disabled={isDeleting}
                      className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/10 text-rose-500/80 hover:text-rose-455 hover:bg-rose-955/10 transition duration-200 disabled:opacity-50"
                      title="Delete business profile"
                    >
                      {isDeleting ? (
                        <span className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin inline-block"></span>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        /* Zero state fallback */
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-800/80 bg-slate-950/10 gap-4 mt-4">
          <p className="text-sm text-slate-450">No business profiles created yet.</p>
          <Link
            href="/dashboard/businesses/create"
            className="px-5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white"
          >
            Create Your First Profile
          </Link>
        </div>
      )}

    </div>
  );
}
