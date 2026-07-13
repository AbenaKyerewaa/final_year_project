"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getBusinessChatSessions, getBusinessEscalations, updateEscalationStatus, ChatSessionSummary, EscalationResponse } from '@/services/chat';

export default function ChatHistory() {
  const { activeBusiness, token } = useAuth();

  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [escalations, setEscalations] = useState<EscalationResponse[]>([]);
  const [activeTab, setActiveTab] = useState<'sessions' | 'escalations'>('sessions');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load session history and escalations
  useEffect(() => {
    async function loadHistory() {
      if (!activeBusiness || !token) return;
      setLoading(true);
      setError(null);
      try {
        const [sessData, escData] = await Promise.all([
          getBusinessChatSessions(activeBusiness.id, token),
          getBusinessEscalations(activeBusiness.id, token)
        ]);
        setSessions(sessData);
        setEscalations(escData);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to load chat logs and escalations.");
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, [activeBusiness, token]);

  const handleResolveEscalation = async (e: React.MouseEvent, escId: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!token) return;

    try {
      await updateEscalationStatus(escId, 'resolved', token);
      
      // Update local state
      setEscalations(prev => 
        prev.map(esc => esc.id === escId ? { ...esc, status: 'resolved' } : esc)
      );
      // Update sessions list status if applicable
      setSessions(prev => 
        prev.map(s => {
          // If session contains this resolved escalation, update status
          const esc = escalations.find(e => e.id === escId);
          if (esc && s.id === esc.session_id) {
            return { ...s, escalated: false, escalation_status: 'resolved' };
          }
          return s;
        })
      );
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to resolve escalation.");
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (!activeBusiness) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/10 backdrop-blur-xl gap-4">
        <div className="w-12 h-12 rounded-full bg-slate-900/40 text-slate-500 dark:text-slate-400 flex items-center justify-center">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">No Active Business Profile Selected</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
          Please select or create an active business profile from the sidebar menu to view conversation logs.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-5 gap-3">
        <div className="flex flex-col">
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Conversation Logs & Escalations</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Review live chat logs, inspect AI outputs, and resolve handoff requests for <strong>{activeBusiness.business_name}</strong>.</p>
        </div>
      </div>

      {error && (
        <div className="p-3 text-xs text-rose-400 bg-rose-950/20 border border-rose-900/40 rounded-lg">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800/80 gap-6">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`pb-3 text-sm font-semibold transition cursor-pointer relative ${
            activeTab === 'sessions' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Chat Sessions ({sessions.length})
          {activeTab === 'sessions' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 rounded-full"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('escalations')}
          className={`pb-3 text-sm font-semibold transition cursor-pointer relative flex items-center gap-2 ${
            activeTab === 'escalations' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Handoff Escalations ({escalations.filter(e => e.status === 'pending').length})
          {escalations.filter(e => e.status === 'pending').length > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          )}
          {activeTab === 'escalations' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 rounded-full"></span>
          )}
        </button>
      </div>

      {/* Content views */}
      {activeTab === 'sessions' ? (
        sessions.length > 0 ? (
          <div className="overflow-hidden border border-slate-200 dark:border-slate-800/60 rounded-xl bg-slate-50 dark:bg-slate-950/10 backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-900/40 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Channel</th>
                    <th className="px-6 py-4">Latest Message</th>
                    <th className="px-6 py-4">Date/Time</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {sessions.map((sess) => (
                    <tr 
                      key={sess.id}
                      className="hover:bg-slate-900/30 transition cursor-pointer"
                    >
                      <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">
                        {sess.customer_name || 'Anonymous Guest'}
                        {sess.customer_phone && (
                          <div className="text-[10px] text-slate-500 font-normal mt-0.5">{sess.customer_phone}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                          sess.channel === 'test' 
                            ? 'bg-purple-950/40 text-purple-400 border-purple-900/30'
                            : sess.channel === 'whatsapp'
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30'
                            : 'bg-blue-950/40 text-blue-400 border-blue-900/30'
                        }`}>
                          {sess.channel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300 max-w-xs truncate font-medium">
                        {sess.latest_message || <span className="text-slate-500 italic">No messages</span>}
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium">
                        {formatDate(sess.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        {sess.escalation_status ? (
                          <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-widest ${
                            sess.escalation_status === 'pending'
                              ? 'bg-amber-950/20 text-amber-500 border-amber-900/30 animate-pulse'
                              : sess.escalation_status === 'resolved'
                              ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30'
                              : 'bg-slate-800/60 text-slate-500 border-slate-800'
                          }`}>
                            {sess.escalation_status === 'pending' ? 'Escalated' : sess.escalation_status}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-semibold uppercase text-[9px] tracking-widest">Normal</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/dashboard/chat-history/${sess.id}`}
                          className="text-blue-400 hover:text-blue-300 font-bold hover:underline transition"
                        >
                          View Transcript →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center border border-slate-200 dark:border-slate-800 bg-slate-950/5 rounded-xl">
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">No conversation logs exist for this business profile yet.</p>
          </div>
        )
      ) : (
        /* Escalations Tab */
        escalations.length > 0 ? (
          <div className="overflow-hidden border border-slate-200 dark:border-slate-800/60 rounded-xl bg-slate-50 dark:bg-slate-950/10 backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-900/40 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Reason for Handoff</th>
                    <th className="px-6 py-4">Trigger Date</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {escalations.map((esc) => (
                    <tr 
                      key={esc.id}
                      className="hover:bg-slate-900/30 transition cursor-pointer"
                    >
                      <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">
                        {esc.customer_name || 'Anonymous Guest'}
                        {esc.customer_phone && (
                          <div className="text-[10px] text-slate-500 font-normal mt-0.5">{esc.customer_phone}</div>
                        )}
                        <div className="mt-1">
                          <span className="px-2 py-0.5 rounded text-[8px] bg-slate-900 text-slate-500 dark:text-slate-400 font-semibold border border-slate-200 dark:border-slate-800 uppercase">
                            {esc.channel}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300 max-w-sm truncate font-medium">
                        {esc.reason || 'Requested manual assistance'}
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium">
                        {formatDate(esc.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-widest ${
                          esc.status === 'pending'
                            ? 'bg-amber-950/20 text-amber-500 border-amber-900/30'
                            : esc.status === 'resolved'
                            ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30'
                            : 'bg-slate-800/60 text-slate-500 border-slate-800'
                        }`}>
                          {esc.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-3 mt-1.5">
                        {esc.status === 'pending' && (
                          <button
                            onClick={(e) => handleResolveEscalation(e, esc.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-white font-bold transition text-[10px] uppercase cursor-pointer shadow-md hover:shadow-emerald-500/10"
                          >
                            Mark Resolved
                          </button>
                        )}
                        <Link
                          href={`/dashboard/chat-history/${esc.session_id}`}
                          className="text-blue-400 hover:text-blue-300 font-bold hover:underline transition"
                        >
                          View Session →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center border border-slate-200 dark:border-slate-800 bg-slate-950/5 rounded-xl">
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">No escalations registered for this business profile.</p>
          </div>
        )
      )}

    </div>
  );
}
