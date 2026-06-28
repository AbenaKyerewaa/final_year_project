"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getHealthStatus, HealthResponse } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { user, logout } = useAuth();

  const checkBackendHealth = async () => {
    setLoading(true);
    const result = await getHealthStatus();
    setHealth(result);
    setLoading(false);
  };

  useEffect(() => {
    checkBackendHealth();
  }, []);

  return (
    <div className="flex flex-col flex-grow items-center justify-between min-h-screen bg-slate-900 text-slate-100 font-sans bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black select-none">
      
      {/* Offline Alert Bar */}
      {!loading && (!health || health.status === 'disconnected') && (
        <div className="w-full bg-rose-950/30 border-b border-rose-900/30 py-2.5 px-4 text-center text-xs text-rose-400 backdrop-blur-md sticky top-0 z-50">
          ⚠️ <strong>System Offline:</strong> Unable to connect to the backend server. Please make sure the service is running.
        </div>
      )}

      {/* Navbar */}
      <header className="w-full max-w-6xl px-6 py-4 flex items-center justify-between border-b border-slate-800/60 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            EasyBiz AI
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider bg-blue-950/50 text-blue-400 border border-blue-900/30 uppercase">
            SME Portal
          </span>
        </div>
        
        {/* Auth Navigation Links */}
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
              >
                Go to Dashboard
              </Link>
              <button
                onClick={logout}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 bg-slate-800/40 text-slate-350 hover:text-white hover:bg-slate-800 transition-all"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="px-3 py-1.5 text-xs font-semibold text-slate-350 hover:text-white transition-colors"
              >
                Log In
              </Link>
              <Link
                href="/register"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/20 active:translate-y-0.5 transition-all"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Main Body */}
      <main className="w-full max-w-6xl px-6 py-16 flex flex-col flex-grow items-center justify-center gap-12 text-center md:text-left md:flex-row md:items-center">
        
        {/* Left column - Promo details */}
        <div className="flex-1 flex flex-col gap-6 max-w-xl">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            AI Customer Support for{' '}
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
              Ghanaian SMEs
            </span>
          </h1>
          <p className="text-lg text-slate-450 leading-relaxed">
            EasyBiz AI automates customer conversations on web widgets and WhatsApp. By uploading your business data, products, FAQs, and files, our RAG-based AI serves your customers 24/7 without hallucination.
          </p>

          <div className="flex flex-wrap gap-4 mt-2 justify-center md:justify-start">
            {user ? (
              <Link 
                href="/dashboard" 
                className="px-6 py-3 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/20 active:translate-y-0.5 transition-all duration-250"
              >
                Go to Dashboard
              </Link>
            ) : (
              <Link 
                href="/register" 
                className="px-6 py-3 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/20 active:translate-y-0.5 transition-all duration-250"
              >
                Get Started
              </Link>
            )}
            <Link 
              href="/register"
              className="px-6 py-3 rounded-lg font-semibold border border-slate-700 bg-slate-800/20 text-slate-350 hover:text-white hover:bg-slate-800/60 active:translate-y-0.5 transition-all duration-250"
            >
              Request Demo
            </Link>
          </div>
        </div>

        {/* Right column - Interactive Chat Preview Mockup */}
        <div className="w-full max-w-md flex flex-col gap-4 p-6 rounded-2xl border border-slate-800/80 bg-slate-950/60 backdrop-blur-xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
            <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-bold text-slate-200">EasyBiz AI Assistant</span>
              <span className="text-[10px] text-slate-500">Live Customer Simulator</span>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex flex-col gap-3.5 my-2 text-xs text-left max-h-[280px] overflow-y-auto">
            <div className="flex flex-col gap-1 max-w-[85%] self-end">
              <span className="text-[10px] text-slate-550 text-right">Customer</span>
              <div className="p-3 rounded-2xl rounded-tr-none bg-blue-600 text-white leading-relaxed">
                Hello! Do you have organic cocoa butter in stock, and how much is it?
              </div>
            </div>

            <div className="flex flex-col gap-1 max-w-[85%]">
              <span className="text-[10px] text-slate-550">AI Agent</span>
              <div className="p-3 rounded-2xl rounded-tl-none bg-slate-900 border border-slate-800 text-slate-200 leading-relaxed">
                Yes, we have our organic raw cocoa butter in stock! It is priced at <strong>GHS 75.00</strong> per 250g tub. We offer deliveries in Accra and Tema. Would you like me to place an order?
              </div>
            </div>

            <div className="flex flex-col gap-1 max-w-[85%] self-end">
              <span className="text-[10px] text-slate-550 text-right">Customer</span>
              <div className="p-3 rounded-2xl rounded-tr-none bg-blue-600 text-white leading-relaxed">
                Yes please! Deliver to East Legon. What payment methods do you accept?
              </div>
            </div>

            <div className="flex flex-col gap-1 max-w-[85%]">
              <span className="text-[10px] text-slate-550">AI Agent</span>
              <div className="p-3 rounded-2xl rounded-tl-none bg-slate-900 border border-slate-800 text-slate-200 leading-relaxed">
                Great! We accept <strong>MTN Mobile Money (MoMo), Telecel Cash, and cash on delivery</strong>. I will log the delivery address to East Legon. Our dispatch rider will contact you tomorrow morning.
              </div>
            </div>
          </div>
          
          <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between text-xs text-slate-450">
            <span className="text-[10px] uppercase font-semibold text-slate-550">RAG Context Enabled</span>
            <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 font-mono text-[9px]">Accuracy Rate: 99.8%</span>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl px-6 py-6 border-t border-slate-900 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-550">
        <div>
          &copy; {new Date().getFullYear()} EasyBiz AI. Built for Ghanaian SME automation.
        </div>
        <div className="flex items-center gap-6">
          <span className="hover:text-slate-450 transition-colors">Privacy</span>
          <span className="hover:text-slate-450 transition-colors">Terms of Service</span>
          <span className="hover:text-slate-450 transition-colors">Support</span>
        </div>
      </footer>

    </div>
  );
}
