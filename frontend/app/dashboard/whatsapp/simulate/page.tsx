"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { sendChatMessage } from '@/services/chat';

interface Message {
  id: string;
  sender: 'customer' | 'ai';
  text: string;
  timestamp: string;
}

export default function WhatsAppSimulator() {
  const { activeBusiness } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize welcome message when active business changes
  useEffect(() => {
    setMessages([]);
    setSessionId(undefined);
    setError(null);
    
    if (activeBusiness) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages([
        {
          id: 'welcome',
          sender: 'ai',
          text: `Hello! Welcome to ${activeBusiness.business_name}. How can we assist you today?`,
          timestamp: timeStr
        }
      ]);
    }
  }, [activeBusiness]);

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleSend = async () => {
    const textToSend = inputText.trim();
    if (!textToSend || sending || !activeBusiness) return;

    setError(null);
    setInputText('');
    setSending(true);

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Append customer message locally
    const customerMsgId = Math.random().toString(36).substring(7);
    const newMsg: Message = {
      id: customerMsgId,
      sender: 'customer',
      text: textToSend,
      timestamp: timeStr
    };
    setMessages(prev => [...prev, newMsg]);

    try {
      // Call standard RAG chat endpoint with channel 'whatsapp_simulation'
      const response = await sendChatMessage(activeBusiness.id, {
        message: textToSend,
        channel: 'whatsapp_simulation',
        session_id: sessionId
      });

      if (response.session_id) {
        setSessionId(response.session_id);
      }

      const aiMsgId = Math.random().toString(36).substring(7);
      const aiMsg: Message = {
        id: aiMsgId,
        sender: 'ai',
        text: response.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.error("WhatsApp Simulation Chat failed:", err);
      setError("Unable to connect to RAG chatbot backend. Please confirm the FastAPI server is running.");
      
      const errorMsg: Message = {
        id: 'error-fallback',
        sender: 'ai',
        text: "Error: Failed to obtain response from uvicorn backend. Please check network logs.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  if (!activeBusiness) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-slate-600 dark:text-slate-350 p-6">
        <div className="w-16 h-16 border-4 border-dashed border-slate-700 rounded-full flex items-center justify-center text-slate-500 mb-4 font-bold text-lg">?</div>
        <h2 className="text-xl font-bold">No Active Business Selected</h2>
        <p className="text-slate-500 text-sm mt-1 max-w-sm text-center">
          Please select or create a business profile using the Active Business dropdown menu in the sidebar first.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      
      {/* Simulation Page Header & Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/whatsapp"
            className="p-2 rounded-lg bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-white transition duration-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              WhatsApp Simulation
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs">
              Interact as a customer using WhatsApp simulation context: <code className="text-emerald-400 font-mono">channel = whatsapp_simulation</code>
            </p>
          </div>
        </div>
      </div>

      {/* Simulator Device Frame wrapper */}
      <div className="flex justify-center">
        
        {/* Mobile Mock Container */}
        <div className="w-full max-w-md h-[600px] border border-slate-200 dark:border-slate-800 bg-[#0b141a] rounded-3xl overflow-hidden shadow-2xl flex flex-col relative font-sans">
          
          {/* Mobile Top Speaker/Cam notch */}
          <div className="h-5 bg-slate-950 flex justify-center items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-800"></span>
            <span className="w-16 h-1 bg-slate-800 rounded-full"></span>
          </div>

          {/* WhatsApp Chat Room Header */}
          <div className="bg-[#202c33] text-slate-800 dark:text-slate-100 px-4 py-3 flex items-center justify-between shrink-0 shadow-lg border-b border-slate-200 dark:border-slate-800/30">
            <div className="flex items-center gap-3">
              {/* Profile Avatar Placeholder */}
              <div className="w-10 h-10 rounded-full bg-emerald-700/60 border border-emerald-500/20 flex items-center justify-center font-bold text-slate-800 dark:text-slate-100 select-none text-base">
                {activeBusiness.business_name.substring(0, 1).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate pr-2">
                  {activeBusiness.business_name}
                </span>
                <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  online
                </span>
              </div>
            </div>
            
            {/* Phone & Menu Icons */}
            <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400">
              <svg className="w-5 h-5 hover:text-slate-800 dark:text-slate-200 cursor-pointer transition duration-150" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {/* WhatsApp small logo */}
              <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.022-.08-.124-.184-.262-.254-.138-.07-1.077-.525-1.246-.58-.168-.056-.289-.085-.41.099-.12.184-.467.58-.573.7-.107.12-.213.135-.351.065-.138-.07-1.002-.37-1.897-1.156-.697-.611-1.168-1.365-1.305-1.579-.138-.214-.015-.33.123-.466.124-.122.261-.31.393-.464.13-.156.173-.263.26-.437.086-.174.043-.328-.021-.464-.065-.136-.57-1.36-.78-1.86-.205-.494-.41-.427-.573-.427-.147-.008-.316-.008-.485-.008-.169 0-.445.063-.678.312-.232.25-1.005 1.006-1.005 2.45 0 1.445 1.026 2.84 1.168 3.036.143.197 2.01 3.124 4.873 4.39.681.301 1.213.481 1.626.611.685.215 1.307.185 1.802.112.551-.082 1.691-.703 1.93-1.383.238-.68.238-1.264.168-1.382-.07-.12-.213-.185-.351-.255zM12.006 20.898c-1.62 0-3.21-.427-4.607-1.23l-.33-.195-3.428.91.916-3.41-.21-.34c-.878-1.423-1.341-3.056-1.341-4.739C2.996 6.945 7.042 2.9 12.012 2.9c2.408 0 4.673.955 6.376 2.7 1.701 1.745 2.637 4.056 2.634 6.516 0 5.068-4.048 9.112-9.016 9.112v-.03zm7.01-15.65c-1.874-1.81-4.368-2.81-7.01-2.81-5.467 0-9.914 4.54-9.916 10.125 0 1.785.457 3.528 1.328 5.074l-1.41 5.253 5.26-1.408c1.492.83 3.176 1.272 4.908 1.275h.005c5.468 0 9.916-4.54 9.918-10.128.002-2.707-1.01-5.25-2.883-7.06z" />
              </svg>
            </div>
          </div>

          {/* Chat Messages Body with simulated wallpaper */}
          <div 
            className="flex-grow overflow-y-auto p-4 space-y-3.5"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(11,20,26,0.95) 0%, rgba(11,20,26,0.99) 100%)',
              backgroundColor: '#0b141a',
            }}
          >
            {messages.map((msg) => {
              const isCust = msg.sender === 'customer';
              return (
                <div
                  key={msg.id}
                  className={`flex ${isCust ? 'justify-end' : 'justify-start'} w-full`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-1.5 shadow-sm text-sm relative ${
                      isCust 
                        ? 'bg-[#005c4b] text-slate-100 rounded-tr-none' 
                        : 'bg-[#202c33] text-slate-200 rounded-tl-none'
                    }`}
                  >
                    {/* Message Text */}
                    <p className="whitespace-pre-wrap leading-relaxed pr-8 pb-1">{msg.text}</p>
                    
                    {/* Timestamp & Ticks */}
                    <div className="absolute bottom-1 right-2 flex items-center gap-1 select-none">
                      <span className="text-[9px] text-slate-500 dark:text-slate-400">{msg.timestamp}</span>
                      {isCust && (
                        <svg className="w-3.5 h-3.5 text-blue-400" viewBox="0 0 16 15" fill="none">
                          <path d="M15.01 3.3l-5.5 5.5-2.76-2.76" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M11.19 3.3L5.69 8.8l-2.76-2.76" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className="flex justify-start w-full">
                <div className="bg-[#202c33] text-slate-800 dark:text-slate-200 max-w-[85%] rounded-lg px-3 py-2 shadow-sm text-sm rounded-tl-none flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            )}

            {error && (
              <div className="text-center bg-red-950/20 border border-red-500/10 text-red-400 rounded-lg p-2.5 text-xs font-semibold">
                {error}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Typing Area Footer */}
          <div className="bg-[#111b21] p-3 flex items-center gap-2 shrink-0">
            {/* Attachment Icons */}
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 shrink-0">
              <svg className="w-6 h-6 hover:text-slate-800 dark:text-slate-200 cursor-pointer transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0l-4-4a4 4 0 015.656-5.656l1.1 1.1" />
              </svg>
            </div>

            {/* Input Element */}
            <div className="flex-grow relative">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type a message"
                disabled={sending}
                className="w-full bg-[#2a3942] border border-slate-200 dark:border-slate-800 rounded-lg py-2 pl-3.5 pr-10 text-sm text-slate-800 dark:text-slate-200 focus:outline-none placeholder-slate-500"
              />
              {/* Emoticon mock icon */}
              <svg className="w-5 h-5 absolute right-3.5 top-2.5 text-slate-500 hover:text-slate-700 dark:text-slate-300 cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0l-4-4a4 4 0 015.656-5.656l1.1 1.1" />
              </svg>
            </div>

            {/* Circular Send Button */}
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || sending}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-slate-900 transition active:translate-y-0.5 shrink-0 ${
                inputText.trim() && !sending
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                  : 'bg-[#2a3942] text-slate-500 cursor-not-allowed'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
