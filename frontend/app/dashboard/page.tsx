"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { listProducts } from '@/services/product';
import { listServices } from '@/services/service';
import { listFAQs } from '@/services/faq';
import { listDocuments } from '@/services/document';
import { rebuildRAGIndex } from '@/services/business';

export default function DashboardHome() {
  const { user, activeBusiness, activeBusinessLoading, businesses, token } = useAuth();
  const [stats, setStats] = useState({ products: 0, services: 0, faqs: 0, documents: 0 });
  const [statsLoading, setStatsLoading] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [reindexSuccess, setReindexSuccess] = useState<string | null>(null);
  const [reindexError, setReindexError] = useState<string | null>(null);

  const handleRebuildIndex = async () => {
    if (!activeBusiness || !token || reindexing) return;
    setReindexing(true);
    setReindexSuccess(null);
    setReindexError(null);
    try {
      const res = await rebuildRAGIndex(activeBusiness.id, token);
      setReindexSuccess(`Success! Rebuilt search index with ${res.chunks_indexed} knowledge chunks.`);
    } catch (err: any) {
      setReindexError(err.message || "Failed to rebuild search index.");
    } finally {
      setReindexing(false);
    }
  };

  useEffect(() => {
    async function fetchStats() {
      if (!activeBusiness || !token) return;
      setStatsLoading(true);
      try {
        const [p, s, f, d] = await Promise.all([
          listProducts(activeBusiness.id, token).catch(() => []),
          listServices(activeBusiness.id, token).catch(() => []),
          listFAQs(activeBusiness.id, token).catch(() => []),
          listDocuments(activeBusiness.id, token).catch(() => [])
        ]);
        setStats({
          products: p.length,
          services: s.length,
          faqs: f.length,
          documents: d.length
        });
      } catch (err) {
        console.error("Error loading stats:", err);
      } finally {
        setStatsLoading(false);
      }
    }
    fetchStats();
  }, [activeBusiness, token]);

  if (activeBusinessLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      
      {/* Welcome Card banner */}
      <div className="p-6 md:p-8 rounded-2xl border border-slate-800/80 bg-gradient-to-r from-slate-900 to-indigo-950/20 backdrop-blur-xl shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -z-10"></div>
        <div className="flex flex-col gap-1.5">
          <div className="text-[10px] text-blue-400 uppercase tracking-widest font-bold">Active Console</div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white">
            Akwaaba, {user?.full_name}!
          </h2>
          <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Welcome back to EasyBiz AI. Manage your businesses, upload documents and product catalogues, configure frequently asked questions, and train your support chatbot.
          </p>
        </div>
      </div>

      {activeBusiness ? (
        <>
          {/* Active Business stats dashboard grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Business overview profile metadata */}
            <div className="lg:col-span-2 p-6 rounded-2xl border border-slate-800/60 bg-slate-950/10 backdrop-blur-md flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Currently Managed Profile</span>
                  <h3 className="text-xl font-bold text-slate-200 mt-1">{activeBusiness.business_name}</h3>
                  <span className="text-xs text-blue-450 mt-0.5">{activeBusiness.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRebuildIndex}
                    disabled={reindexing}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-900 bg-blue-950/20 text-blue-400 hover:text-white hover:bg-blue-900 transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {reindexing ? (
                      <>
                        <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span>
                        Rebuilding Index...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3m-3-3v12" />
                        </svg>
                        Rebuild Index
                      </>
                    )}
                  </button>
                  <Link
                    href={`/dashboard/businesses/${activeBusiness.id}/edit`}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-800 bg-slate-900/30 text-slate-350 hover:text-white hover:bg-slate-800 transition"
                  >
                    Edit Profile
                  </Link>
                </div>
              </div>

              {reindexSuccess && (
                <div className="p-3 text-xs bg-emerald-950/30 border border-emerald-900/60 text-emerald-400 rounded-lg">
                  {reindexSuccess}
                </div>
              )}

              {reindexError && (
                <div className="p-3 text-xs bg-rose-950/30 border border-rose-900/60 text-rose-400 rounded-lg">
                  {reindexError}
                </div>
              )}

              {activeBusiness.description && (
                <p className="text-xs text-slate-400 leading-relaxed border-t border-slate-900 pt-3">
                  {activeBusiness.description}
                </p>
              )}

              {/* Attributes details grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-900 pt-4 mt-1 text-xs">
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500 font-semibold">Location:</span>
                  <span className="text-slate-300 font-medium">{activeBusiness.location}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500 font-semibold">Phone Contact:</span>
                  <span className="text-slate-300 font-medium">{activeBusiness.phone}</span>
                </div>
                {activeBusiness.whatsapp_number && (
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 font-semibold">WhatsApp channel:</span>
                    <span className="text-slate-300 font-medium">{activeBusiness.whatsapp_number}</span>
                  </div>
                )}
                {activeBusiness.opening_hours && (
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 font-semibold">Opening Hours:</span>
                    <span className="text-slate-300 font-medium">{activeBusiness.opening_hours}</span>
                  </div>
                )}
                {activeBusiness.payment_methods && (
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 font-semibold">Accepted Payments:</span>
                    <span className="text-slate-300 font-medium">{activeBusiness.payment_methods}</span>
                  </div>
                )}
                {activeBusiness.delivery_options && (
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 font-semibold">Delivery Channels:</span>
                    <span className="text-slate-300 font-medium">{activeBusiness.delivery_options}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick configuration index card */}
            <div className="p-6 rounded-2xl border border-slate-800/60 bg-slate-950/10 flex flex-col gap-4">
              <h4 className="text-sm font-semibold text-slate-200 uppercase tracking-wider border-b border-slate-900 pb-2">
                Knowledge Base Index
              </h4>
              
              <div className="flex flex-col gap-3.5 mt-1 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/40 border border-slate-850/60">
                  <span className="text-slate-450">Products Registered</span>
                  <span className="font-semibold px-2 py-0.5 rounded bg-slate-900 border border-slate-850 text-slate-300">
                    {statsLoading ? 'Loading...' : `${stats.products} ${stats.products === 1 ? 'Item' : 'Items'}`}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/40 border border-slate-850/60">
                  <span className="text-slate-450">Services Registered</span>
                  <span className="font-semibold px-2 py-0.5 rounded bg-slate-900 border border-slate-850 text-slate-300">
                    {statsLoading ? 'Loading...' : `${stats.services} ${stats.services === 1 ? 'Item' : 'Items'}`}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/40 border border-slate-850/60">
                  <span className="text-slate-450">FAQs Configured</span>
                  <span className="font-semibold px-2 py-0.5 rounded bg-slate-900 border border-slate-850 text-slate-300">
                    {statsLoading ? 'Loading...' : `${stats.faqs} ${stats.faqs === 1 ? 'QA Pair' : 'QA Pairs'}`}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/40 border border-slate-850/60">
                  <span className="text-slate-450">Training Documents</span>
                  <span className="font-semibold px-2 py-0.5 rounded bg-slate-900 border border-slate-850 text-slate-300">
                    {statsLoading ? 'Loading...' : `${stats.documents} ${stats.documents === 1 ? 'File' : 'Files'}`}
                  </span>
                </div>
              </div>
            </div>

          </div>
          
          {/* Quick Actions / Integration Cards */}
          <div className="flex flex-col gap-4 mt-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Live SME Assistant Tools
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Chat Test */}
              <div className="p-6 rounded-2xl border border-slate-850 bg-slate-950/10 hover:border-slate-800 transition flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-950/30 text-blue-400 border border-blue-900/30 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-bold text-slate-300">Chatbot Testing Console</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Open the widget simulator to test your chatbot's responses. Check how it utilizes your catalogs and documents.
                  </p>
                </div>
                <Link 
                  href="/dashboard/chat-test" 
                  className="text-xs font-semibold text-blue-450 hover:text-blue-400 flex items-center gap-1 group mt-2"
                >
                  <span>Launch Simulator</span>
                  <svg className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>

              {/* Card 2: WhatsApp Simulate */}
              <div className="p-6 rounded-2xl border border-slate-850 bg-slate-950/10 hover:border-slate-800 transition flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-950/30 text-emerald-400 border border-emerald-900/30 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-bold text-slate-300">WhatsApp Channel Demo</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Simulate customer queries arriving via WhatsApp. Check how your auto-responses perform in simulated client phone contexts.
                  </p>
                </div>
                <Link 
                  href="/dashboard/whatsapp" 
                  className="text-xs font-semibold text-emerald-450 hover:text-emerald-400 flex items-center gap-1 group mt-2"
                >
                  <span>Manage WhatsApp</span>
                  <svg className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>

              {/* Card 3: Chat Logs */}
              <div className="p-6 rounded-2xl border border-slate-850 bg-slate-950/10 hover:border-slate-800 transition flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <div className="w-10 h-10 rounded-xl bg-purple-950/30 text-purple-400 border border-purple-900/30 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-bold text-slate-300">Chat History Logs</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Audit logs of previous sessions. Oversee conversations, audit response accuracy, and check for staff escalations.
                  </p>
                </div>
                <Link 
                  href="/dashboard/chat-history" 
                  className="text-xs font-semibold text-purple-450 hover:text-purple-400 flex items-center gap-1 group mt-2"
                >
                  <span>View Chat Logs</span>
                  <svg className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Zero State Onboarding banner */
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-800/80 bg-slate-950/10 backdrop-blur-xl gap-5">
          <div className="w-16 h-16 rounded-2xl bg-blue-950/30 text-blue-450 border border-blue-900/30 flex items-center justify-center">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          
          <div className="flex flex-col gap-1.5 max-w-md">
            <h3 className="text-lg font-bold text-slate-200">No Business Profiles Found</h3>
            <p className="text-xs text-slate-450 leading-relaxed mt-1">
              To activate the EasyBiz AI knowledge base, products cataloguing, and WhatsApp bot, you must create a business profile first.
            </p>
          </div>

          <Link
            href="/dashboard/businesses/create"
            className="px-6 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white hover:shadow-lg hover:shadow-blue-500/20 active:translate-y-0.5 transition duration-200"
          >
            Create Business Profile
          </Link>
        </div>
      )}

    </div>
  );
}
