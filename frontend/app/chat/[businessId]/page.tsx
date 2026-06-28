"use client";

import React, { useState, useEffect, useRef, use } from 'react';
import { getPublicBusiness, BusinessPublicResponse } from '@/services/business';
import { sendChatMessage, sendVoiceMessage } from '@/services/chat';


interface PageProps {
  params: Promise<{ businessId: string }>;
}

interface Message {
  sender: 'customer' | 'ai';
  text: string;
  timestamp: Date;
  escalated?: boolean;
}

export default function CustomerChat({ params }: PageProps) {
  const unwrappedParams = use(params);
  const businessId = unwrappedParams.businessId;

  const [business, setBusiness] = useState<BusinessPublicResponse | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  
  const [loadingBusiness, setLoadingBusiness] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Voice recording states & refs
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isCancelledRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);


  // Suggested questions
  const suggestedQuestions = [
    "Do you have HP laptops?",
    "What are your opening hours?",
    "Do you deliver?",
    "Where are you located?"
  ];

  // Fetch business public profile on mount
  useEffect(() => {
    async function loadPublicProfile() {
      if (!businessId) return;
      try {
        setError(null);
        const data = await getPublicBusiness(businessId);
        setBusiness(data);
        
        // Seed initial welcome message
        const welcomeText = `Welcome to ${data.business_name}. Ask me about our products, services, prices, opening hours, or location.`;
        setMessages([
          {
            sender: 'ai',
            text: welcomeText,
            timestamp: new Date()
          }
        ]);
      } catch (err: any) {
        console.error("Error loading business:", err);
        setError(err.message || "Could not retrieve the business profile. Please verify the URL or try again later.");
      } finally {
        setLoadingBusiness(false);
      }
    }
    loadPublicProfile();
  }, [businessId]);

  // Scroll to bottom whenever messages list changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleSendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || sending) return;

    setError(null);
    
    // Add user message
    const userMsg: Message = {
      sender: 'customer',
      text: trimmed,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setSending(true);

    try {
      const response = await sendChatMessage(businessId, {
        message: trimmed,
        channel: 'web',
        session_id: sessionId
      });

      // Update session ID if received
      if (response.session_id) {
        setSessionId(response.session_id);
      }

      // Add AI response message
      const aiMsg: Message = {
        sender: 'ai',
        text: response.answer,
        timestamp: new Date(),
        escalated: response.escalated
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.error("Error sending message:", err);
      // Add error feedback directly in the message flow
      const errorMsg: Message = {
        sender: 'ai',
        text: "I apologize, but I am unable to connect to the backend server. Please verify if the service is online.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  // Helper to format recording seconds to MM:SS format
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Clean up media streams and active timers
  const cleanupRecording = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setRecordingDuration(0);
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  };

  // Start capturing customer audio from the microphone
  const startRecording = async () => {
    setRecordingError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Voice recording is not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      isCancelledRef.current = false;

      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = ''; // fallback to default
      }

      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        if (isCancelledRef.current) {
          isCancelledRef.current = false;
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        if (audioBlob.size > 0) {
          await handleSendVoiceMessage(audioBlob);
        }
      };

      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error("Microphone capture failed:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setRecordingError("Microphone access denied. Please check your browser's site permissions.");
      } else {
        setRecordingError(err.message || "Failed to access microphone.");
      }
    }
  };

  // Stop recording and trigger sending transcription
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    cleanupRecording();
  };

  // Cancel and discard recorded audio bytes
  const cancelRecording = () => {
    isCancelledRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    cleanupRecording();
  };

  // Dispatch audio blob to server API
  const handleSendVoiceMessage = async (audioBlob: Blob) => {
    if (sending) return;

    setError(null);
    setSending(true);

    // Add temporary voice processing customer bubble
    const tempUserMsg: Message = {
      sender: 'customer',
      text: "🎤 [Sending voice message...]",
      timestamp: new Date()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const response = await sendVoiceMessage(businessId, audioBlob, {
        session_id: sessionId,
        channel: 'voice'
      });

      if (response.session_id) {
        setSessionId(response.session_id);
      }

      // Replace placeholder bubble text with the transcribed text from server
      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && updated[lastIdx].text.startsWith("🎤 [Sending voice")) {
          updated[lastIdx] = {
            sender: 'customer',
            text: `🎤 ${response.transcription}`,
            timestamp: new Date()
          };
        }
        return updated;
      });

      // Insert AI text bubble reply
      const aiMsg: Message = {
        sender: 'ai',
        text: response.answer,
        timestamp: new Date(),
        escalated: response.escalated
      };
      setMessages(prev => [...prev, aiMsg]);

    } catch (err: any) {
      console.error("Voice processing error:", err);
      // Mark temporary bubble as failed
      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && updated[lastIdx].text.startsWith("🎤 [Sending voice")) {
          updated[lastIdx] = {
            sender: 'customer',
            text: "🎤 [Voice message failed to send]",
            timestamp: new Date()
          };
        }
        return updated;
      });

      const errorMsg: Message = {
        sender: 'ai',
        text: `I apologize, but I failed to process your voice message. ${err.message || 'Please check your connection and try again.'}`,
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

  if (loadingBusiness) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm">Connecting to business assistant...</p>
        </div>
      </div>
    );
  }

  if (error && !business) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 font-sans px-4">
        <div className="w-full max-w-md p-8 rounded-2xl border border-rose-900/50 bg-rose-950/10 backdrop-blur-xl text-center flex flex-col gap-5">
          <div className="w-12 h-12 rounded-full bg-rose-900/30 flex items-center justify-center mx-auto text-rose-500">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Assistant Offline</h2>
          <p className="text-slate-300 text-sm">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-lg text-white font-semibold text-sm transition"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div className="flex flex-col">
          <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
            {business?.business_name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-slate-400">
            <span className="font-semibold text-blue-400">{business?.category}</span>
            <span>•</span>
            <span>{business?.location}</span>
            {business?.opening_hours && (
              <>
                <span>•</span>
                <span className="text-slate-500">{business?.opening_hours}</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6 space-y-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-950 via-slate-955 to-black">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex flex-col max-w-[85%] md:max-w-[70%] ${
              msg.sender === 'customer' ? 'ml-auto items-end' : 'mr-auto items-start'
            }`}
          >
            {/* Bubble */}
            <div
              className={`rounded-2xl px-4 py-3 text-sm shadow-md leading-relaxed whitespace-pre-wrap ${
                msg.sender === 'customer'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
              }`}
            >
              {msg.text}
            </div>

            {/* Time / Status Label */}
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500 px-1">
              <span>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {msg.escalated && (
                <>
                  <span>•</span>
                  <span className="text-amber-500 font-semibold uppercase tracking-wider">
                    Agent Escalated
                  </span>
                </>
              )}
            </div>
          </div>
        ))}

        {/* Loading Indicator Bubble */}
        {sending && (
          <div className="flex flex-col items-start max-w-[70%] mr-auto">
            <div className="rounded-2xl px-4 py-3 bg-slate-900 border border-slate-800 text-slate-455 rounded-bl-none shadow-md flex items-center gap-1.5">
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Sticky Action Area */}
      <div className="border-t border-slate-900 bg-slate-950 p-4 shrink-0 flex flex-col gap-4">
        
        {/* Suggested Questions List (Only shown if conversation just started or no pending response) */}
        {messages.length === 1 && !sending && (
          <div className="flex flex-col gap-2 max-w-4xl mx-auto w-full">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-1">Suggested Questions</p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q)}
                  className="px-3.5 py-2 text-xs rounded-full border border-slate-850 bg-slate-900/40 text-slate-300 hover:text-white hover:bg-slate-900 hover:border-slate-700 transition text-left cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recording Permission Error Alert */}
        {recordingError && (
          <div className="max-w-4xl mx-auto w-full px-4 py-2.5 bg-rose-950/20 border border-rose-900/40 rounded-xl flex items-center justify-between text-xs text-rose-300">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {recordingError}
            </span>
            <button onClick={() => setRecordingError(null)} className="text-slate-400 hover:text-white font-bold text-sm leading-none ml-2">×</button>
          </div>
        )}

        {/* Input Form */}
        {isRecording ? (
          <div className="flex items-center justify-between gap-3 max-w-4xl mx-auto w-full bg-slate-900/60 border border-red-500/30 rounded-xl px-4 py-2.5 shadow-md backdrop-blur-sm animate-pulse">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-sm font-semibold text-slate-200">
                Recording... {formatTime(recordingDuration)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={cancelRecording}
                className="px-3.5 py-2 rounded-lg border border-slate-800 bg-slate-950/40 hover:bg-slate-800 text-xs text-slate-400 hover:text-rose-450 transition"
              >
                Cancel
              </button>
              <button
                onClick={stopRecording}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs text-white font-semibold flex items-center gap-1.5 shadow-lg shadow-red-650/10 active:translate-y-0.5 transition"
              >
                <span className="w-2.5 h-2.5 bg-white rounded-sm"></span>
                Stop & Send
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-end gap-2 max-w-4xl mx-auto w-full">
            <div className="flex-1 bg-slate-900/50 border border-slate-850 rounded-xl px-4 py-2 flex items-center focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all duration-200">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask a question..."
                rows={1}
                className="flex-1 bg-transparent border-0 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-0 resize-none py-1.5 leading-relaxed"
                style={{ maxHeight: '120px' }}
              />
            </div>
            
            {/* Microphone Trigger Button */}
            <button
              onClick={startRecording}
              disabled={sending}
              className="p-3.5 rounded-xl bg-slate-900 border border-slate-850 hover:border-slate-750 text-cyan-400 hover:text-cyan-300 flex items-center justify-center hover:bg-slate-850 active:translate-y-0.5 transition duration-150 disabled:opacity-40"
              title="Record voice input"
            >
              <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
            
            <button
              onClick={() => handleSendMessage(inputText)}
              disabled={!inputText.trim() || sending}
              className="p-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg hover:shadow-blue-500/20 active:translate-y-0.5 transition duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
            >
              <svg className="w-4 h-4 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9-7-9-7v14z" />
              </svg>
            </button>
          </div>
        )}

      </div>
      
    </div>
  );
}
