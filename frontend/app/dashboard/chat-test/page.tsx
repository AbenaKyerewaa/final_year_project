"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { sendChatMessage } from '@/services/chat';

interface Message {
  sender: 'customer' | 'ai';
  text: string;
  timestamp: Date;
  confidence_score?: number;
  sources?: Array<{ title: string; source_type: string; score: number }>;
}

export default function ChatTest() {
  const { activeBusiness, token } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Suggested testing prompts
  const testPrompts = [
    "Do you have HP laptops?",
    "What are your opening hours?",
    "Do you deliver?",
    "Where are you located?"
  ];

  // Reset chat when business changes
  useEffect(() => {
    setMessages([]);
    setSessionId(undefined);
    setError(null);
    if (activeBusiness) {
      setMessages([
        {
          sender: 'ai',
          text: `Hello! I am your AI assistant for "${activeBusiness.business_name}". You can test my answers, retrieve similarity scores, and review the source chunks used below.`,
          timestamp: new Date()
        }
      ]);
    }
  }, [activeBusiness]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleSendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || sending || !activeBusiness) return;

    setError(null);
    const userMsg: Message = {
      sender: 'customer',
      text: trimmed,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setSending(true);

    try {
      const response = await sendChatMessage(activeBusiness.id, {
        message: trimmed,
        channel: 'test',
        session_id: sessionId
      });

      if (response.session_id) {
        setSessionId(response.session_id);
      }

      const aiMsg: Message = {
        sender: 'ai',
        text: response.answer,
        timestamp: new Date(),
        confidence_score: response.confidence_score,
        sources: response.sources
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.error(err);
      setError("Failed to generate response. Please ensure backend is online.");
      const errorMsg: Message = {
        sender: 'ai',
        text: "Error: I encountered a connection issue fetching the response from uvicorn server.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputText);
    }
  };

  if (!activeBusiness) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-800/80 bg-slate-950/10 backdrop-blur-xl gap-4">
        <div className="w-12 h-12 rounded-full bg-slate-900/40 text-slate-400 flex items-center justify-center">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-200">No Active Business Profile Selected</h3>
        <p className="text-xs text-slate-450 max-w-sm leading-relaxed">
          Please select or create an active business profile from the sidebar menu to begin testing the AI support assistant.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[450px] border border-slate-800/60 rounded-2xl bg-slate-950/20 backdrop-blur-xl overflow-hidden relative shadow-2xl">
      
      {/* Simulation Header */}
      <header className="px-6 py-4 border-b border-slate-900 bg-slate-950/40 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-base font-extrabold text-white">AI Assistant Simulator</h2>
          <p className="text-xs text-slate-450 mt-0.5">Test responses, source files, and retrieval scores for <strong>{activeBusiness.business_name}</strong>.</p>
        </div>
        
        {sessionId && (
          <button
            onClick={() => {
              setMessages([]);
              setSessionId(undefined);
              setMessages([
                {
                  sender: 'ai',
                  text: "Simulation restarted. Active session cleared.",
                  timestamp: new Date()
                }
              ]);
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/30 text-slate-350 hover:text-white text-xs font-semibold active:translate-y-0.5 transition cursor-pointer"
          >
            Clear Session
          </button>
        )}
      </header>

      {/* Main chat window */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6 space-y-5 bg-slate-950/10">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex flex-col max-w-[85%] md:max-w-[75%] ${
              msg.sender === 'customer' ? 'ml-auto items-end' : 'mr-auto items-start'
            }`}
          >
            {/* Message Bubble */}
            <div
              className={`rounded-2xl px-4 py-3 text-sm shadow-md leading-relaxed whitespace-pre-wrap ${
                msg.sender === 'customer'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
              }`}
            >
              {msg.text}
            </div>

            {/* Diagnostics Metadata */}
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-550 px-1">
              <span>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              
              {msg.sender === 'ai' && msg.confidence_score !== undefined && (
                <>
                  <span>•</span>
                  <span className={`font-semibold ${msg.confidence_score >= 0.5 ? 'text-emerald-450' : 'text-rose-500'}`}>
                    Confidence Score: {msg.confidence_score.toFixed(3)}
                  </span>
                </>
              )}
            </div>

            {/* Source documents panel */}
            {msg.sender === 'ai' && msg.sources && msg.sources.length > 0 && (
              <details className="mt-2 text-[11px] text-slate-400 bg-slate-950/40 border border-slate-850 rounded-lg p-2 max-w-full w-full">
                <summary className="cursor-pointer font-semibold text-slate-450 hover:text-slate-300 transition outline-none">
                  Inspect Retrieval Sources ({msg.sources.length})
                </summary>
                <div className="mt-2 space-y-2 border-t border-slate-900 pt-2 font-mono">
                  {msg.sources.map((src, sIdx) => (
                    <div key={sIdx} className="flex justify-between items-center bg-slate-950/60 p-1.5 rounded border border-slate-900/60 gap-4">
                      <div className="flex flex-col gap-0.5 truncate">
                        <span className="text-slate-300 font-bold truncate">{src.title}</span>
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest">{src.source_type}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-blue-450 shrink-0">
                        Score: {src.score.toFixed(3)}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ))}

        {sending && (
          <div className="flex flex-col items-start max-w-[70%] mr-auto">
            <div className="rounded-2xl px-4 py-3 bg-slate-900 border border-slate-850 text-slate-450 rounded-bl-none shadow-md flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts Cards (only on startup) */}
      {messages.length <= 1 && !sending && (
        <div className="px-6 py-2 border-t border-slate-900/40 flex flex-col gap-2 bg-slate-950/20 shrink-0">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Suggested test prompts</span>
          <div className="flex flex-wrap gap-2 pb-1.5">
            {testPrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(p)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-800 bg-slate-900/20 text-slate-300 hover:text-white hover:bg-slate-900 transition cursor-pointer"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Input form */}
      <footer className="p-4 border-t border-slate-900 bg-slate-950 shrink-0">
        <div className="flex items-end gap-2 max-w-4xl mx-auto w-full">
          <div className="flex-1 bg-slate-900/40 border border-slate-850 rounded-xl px-4 py-2 flex items-center focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all duration-200">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type user message to test AI..."
              rows={1}
              className="flex-1 bg-transparent border-0 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-0 resize-none py-1.5 leading-relaxed"
              style={{ maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={() => handleSendMessage(inputText)}
            disabled={!inputText.trim() || sending}
            className="p-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg hover:shadow-blue-500/20 active:translate-y-0.5 transition duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none cursor-pointer"
          >
            <svg className="w-4 h-4 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9-7-9-7v14z" />
            </svg>
          </button>
        </div>
      </footer>
    </div>
  );
}
