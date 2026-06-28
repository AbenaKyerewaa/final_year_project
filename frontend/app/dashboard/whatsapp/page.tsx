"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function WhatsAppDashboard() {
  const { activeBusiness, token } = useAuth();
  
  const [config, setConfig] = useState({
    whatsappMode: 'simulation', // fallback
    verifyToken: 'easybiz_verify_token_2026',
    phoneNumberId: '109283746562910',
    businessNumber: activeBusiness?.whatsapp_number || activeBusiness?.phone || '+233 24 000 0000',
    backendWebhookUrl: 'http://localhost:8000/webhooks/whatsapp',
  });

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchConfig() {
      if (!token) return;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/webhooks/whatsapp/config`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          }
        });
        if (res.ok) {
          const data = await res.json();
          setConfig(prev => ({
            ...prev,
            whatsappMode: data.whatsappMode,
            verifyToken: data.verifyToken,
            phoneNumberId: data.phoneNumberId || prev.phoneNumberId,
            businessNumber: activeBusiness?.whatsapp_number || activeBusiness?.phone || data.businessNumber || prev.businessNumber,
            backendWebhookUrl: data.backendWebhookUrl
          }));
        }
      } catch (err) {
        console.error('Error fetching WhatsApp config:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, [token, activeBusiness]);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
            WhatsApp Integration
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Connect your business profile to WhatsApp Business Cloud API or run simulated demonstrations.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-950/30 border border-emerald-500/20 px-3 py-1.5 rounded-full text-emerald-400 text-xs font-semibold">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Mode: {config.whatsappMode.toUpperCase()}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main controls & status */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Simulation CTA */}
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/20 p-6 shadow-xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -z-10"></div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Demo Client Simulator
            </h2>
            <p className="text-slate-400 text-sm mt-2 max-w-xl">
              Launch our simulated WhatsApp client interface to test your business RAG chatbot instantly. You can converse as a customer and observe AI answers utilizing your loaded documents, products, and FAQs.
            </p>
            <div className="mt-5">
              <Link
                href="/dashboard/whatsapp/simulate"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-black transition duration-200 active:translate-y-0.5"
              >
                <span>Launch Client Simulator</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Webhook Settings */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 backdrop-blur-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Meta Developer Webhook Configuration
            </h2>
            <p className="text-slate-400 text-xs">
              Configure these endpoints in your Meta Developer portal to establish a real-time message stream to EasyBiz AI.
            </p>

            <div className="space-y-3 pt-2">
              {/* Webhook URL */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Callback URL</span>
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                  <code className="text-xs text-slate-300 font-mono flex-grow truncate">{config.backendWebhookUrl}</code>
                  <button
                    onClick={() => copyToClipboard(config.backendWebhookUrl, 'url')}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition duration-200"
                  >
                    {copiedField === 'url' ? (
                      <span className="text-[10px] text-emerald-400 font-bold uppercase">Copied!</span>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Verify Token */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Verification Token</span>
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                  <code className="text-xs text-slate-300 font-mono flex-grow truncate">{config.verifyToken}</code>
                  <button
                    onClick={() => copyToClipboard(config.verifyToken, 'token')}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition duration-200"
                  >
                    {copiedField === 'token' ? (
                      <span className="text-[10px] text-emerald-400 font-bold uppercase">Copied!</span>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Info card sidebar */}
        <div className="space-y-6">
          {/* Active Settings Panel */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 backdrop-blur-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Active Configuration</h3>
            
            <div className="space-y-3.5 text-sm">
              <div className="border-b border-slate-900 pb-2">
                <span className="text-xs text-slate-500 block">WhatsApp Number ID</span>
                <span className="text-slate-300 font-mono text-xs">{config.phoneNumberId}</span>
              </div>

              <div className="border-b border-slate-900 pb-2">
                <span className="text-xs text-slate-500 block">Business Number Map</span>
                <span className="text-slate-300 font-semibold">{config.businessNumber}</span>
              </div>

              <div>
                <span className="text-xs text-slate-500 block">WhatsApp Credentials Status</span>
                <span className="text-amber-400 font-semibold text-xs flex items-center gap-1.5 mt-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Demo/Simulation Default
                </span>
              </div>
            </div>
          </div>

          {/* Quick Steps Guide */}
          <div className="rounded-2xl border border-slate-800/40 bg-slate-950/20 p-6 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Meta Integration Steps</h3>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li className="flex gap-2">
                <span className="text-emerald-400 font-bold">1.</span>
                Create a Meta App with the "WhatsApp" product enabled.
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 font-bold">2.</span>
                Set <code className="text-slate-300 font-mono">WHATSAPP_MODE=cloud_api</code> in your <code className="text-slate-300 font-mono">backend/.env</code> file.
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 font-bold">3.</span>
                Provide access token, verify token, and phone numbers.
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 font-bold">4.</span>
                Save configurations and restart uvicorn.
              </li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}
