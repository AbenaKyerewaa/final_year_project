"use client";

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getChatSessionDetails, updateEscalationStatus, replyToChatSession, ChatSessionDetail } from '@/services/chat';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default function ChatSessionDetailPage({ params }: PageProps) {
  const unwrappedParams = use(params);
  const sessionId = unwrappedParams.sessionId;

  const { token } = useAuth();
  const router = useRouter();

  const [session, setSession] = useState<ChatSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    async function loadSession() {
      if (!sessionId || !token) return;
      try {
        setLoading(true);
        setError(null);
        const data = await getChatSessionDetails(sessionId, token);
        setSession(data);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to load session details.");
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, [sessionId, token]);

  const handleResolve = async () => {
    if (!session || !token || resolving) return;
    setResolving(true);
    try {
      if (!session.escalation_id) {
        throw new Error("No active pending escalation found for this session.");
      }

      await updateEscalationStatus(session.escalation_id, 'resolved', token);
      
      setSession(prev => prev ? { ...prev, escalated: false, escalation_status: 'resolved', escalation_id: undefined } : null);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to resolve escalation.");
    } finally {
      setResolving(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !session || !token || sendingReply) return;
    setSendingReply(true);
    try {
      const newMsg = await replyToChatSession(session.id, replyText.trim(), token);
      setSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          escalated: false,
          escalation_status: 'resolved',
          messages: [...prev.messages, newMsg]
        };
      });
      setReplyText('');
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to send reply.");
    } finally {
      setSendingReply(false);
    }
  };

  const formatWhatsAppUrl = (phone?: string) => {
    if (!phone) return '#';
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.length === 10 && clean.startsWith('0')) {
      clean = '233' + clean.substring(1);
    }
    const text = encodeURIComponent(`Hello! This is regarding your recent inquiry on our business chat assistant.`);
    return `https://wa.me/${clean}?text=${text}`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const parseSources = (sourcesJson: string | undefined): Array<{ title: string; score: number }> => {
    if (!sourcesJson) return [];
    try {
      return JSON.parse(sourcesJson);
    } catch {
      return [];
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="p-6 max-w-md mx-auto text-center flex flex-col gap-4">
        <h3 className="text-lg font-bold text-rose-500">Error Loading Session</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">{error || "The session details could not be found."}</p>
        <button
          onClick={() => router.push('/dashboard/chat-history')}
          className="px-4 py-2 rounded bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-700 text-xs font-semibold cursor-pointer"
        >
          Back to History
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      
      {/* Header with back navigation button */}
      <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <button
          onClick={() => router.push('/dashboard/chat-history')}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-900/40 text-slate-500 dark:text-slate-400 hover:text-white transition cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        
        <div className="flex flex-col">
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Transcript: {session.customer_name || 'Anonymous Guest'}
          </h2>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span>Session ID: {session.id}</span>
            <span>•</span>
            <span className="text-slate-500">{formatDate(session.created_at)}</span>
            <span>•</span>
            <span className="font-semibold text-blue-400 uppercase">{session.channel}</span>
          </div>
        </div>
      </div>

      {/* Escalation Banner warning alert */}
      {session.escalation_status === 'pending' && (
        <div className="p-4 rounded-xl border border-amber-900/50 bg-amber-950/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-900/30 flex items-center justify-center text-amber-500 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-amber-400">Escalated Handoff Active</span>
              <span className="text-xs text-slate-600 dark:text-slate-350 mt-0.5">This session triggered an escalation because the customer requested human support or similarity confidence was too low.</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {session.customer_phone && (
              <a
                href={formatWhatsAppUrl(session.customer_phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase rounded transition inline-flex items-center gap-1.5 shadow-md"
              >
                <span>💬 Reply via WhatsApp</span>
              </a>
            )}
            <button
              onClick={handleResolve}
              disabled={resolving}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 text-white font-bold text-xs uppercase rounded transition cursor-pointer shadow-md"
            >
              {resolving ? "Saving..." : "Mark as Resolved"}
            </button>
          </div>
        </div>
      )}

      {/* Message List panel */}
      <div className="flex flex-col gap-5 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-950/20 backdrop-blur-xl shadow-lg">
        {session.messages.map((msg, index) => {
          const sourcesList = parseSources(msg.ai_response_source);
          return (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[85%] md:max-w-[75%] ${
                msg.sender === 'customer' ? 'ml-auto items-end' : 'mr-auto items-start'
              }`}
            >
              {/* Sender Label */}
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1 mb-1">
                {msg.sender === 'customer'
                  ? 'Customer'
                  : msg.sender === 'human'
                  ? 'Representative (You)'
                  : 'AI Assistant'}
              </span>

              {/* Message Bubble */}
              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.sender === 'customer'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : msg.sender === 'human'
                    ? 'bg-emerald-700 border border-emerald-600 text-white rounded-bl-none shadow-md'
                    : 'bg-slate-900 border border-slate-800 text-slate-250 rounded-bl-none'
                }`}
              >
                {msg.message}
              </div>

              {/* Message Footer metadata */}
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-500 px-1">
                <span>{formatDate(msg.created_at)}</span>
                
                {msg.sender === 'ai' && msg.confidence_score !== undefined && (
                  <>
                    <span>•</span>
                    <span className={msg.confidence_score >= 0.5 ? 'text-emerald-400 font-medium' : 'text-rose-500 font-medium'}>
                      Confidence: {msg.confidence_score.toFixed(3)}
                    </span>
                  </>
                )}
              </div>

              {/* Diagnostic Sources logs toggle */}
              {msg.sender === 'ai' && sourcesList.length > 0 && (
                <details className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg p-2 max-w-full w-full font-mono">
                  <summary className="cursor-pointer font-bold text-slate-400 hover:text-slate-700 dark:text-slate-300 outline-none">
                    Retrieved Knowledge Sources ({sourcesList.length})
                  </summary>
                  <div className="mt-2 space-y-2 border-t border-slate-900 pt-2">
                    {sourcesList.map((src, sIdx) => (
                      <div key={sIdx} className="flex justify-between items-center bg-slate-950/60 p-1.5 rounded border border-slate-900/60 gap-4">
                        <span className="text-slate-700 dark:text-slate-300 font-bold truncate">{src.title}</span>
                        <span className="text-[10px] font-semibold text-blue-400 shrink-0">
                          Score: {src.score.toFixed(3)}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>

      {/* Merchant Live Reply Box */}
      <form onSubmit={handleSendReply} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 backdrop-blur-md shadow-md flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Reply as Merchant / Human Representative
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            Replying automatically marks any active escalation as resolved
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Type your reply to this customer..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={sendingReply || !replyText.trim()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition shrink-0 cursor-pointer shadow-md"
          >
            {sendingReply ? "Sending..." : "Send Reply"}
          </button>
        </div>
      </form>

    </div>
  );
}
