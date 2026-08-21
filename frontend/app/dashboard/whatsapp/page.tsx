"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { updateBusiness } from "@/services/business";

type WhatsAppConfig = {
  whatsappMode: string;
  verifyTokenConfigured: boolean;
  phoneNumberId: string;
  businessNumber: string;
  backendWebhookUrl: string;
};

export default function WhatsAppDashboard() {
  const { activeBusiness, token, setActiveBusiness } = useAuth();

  const apiBaseUrl = (
    process.env.NEXT_PUBLIC_API_URL ||
    "https://final-year-project-pa2z.onrender.com"
  ).replace(/\/$/, "");

  const [config, setConfig] = useState<WhatsAppConfig>({
    whatsappMode: "simulation",
    verifyTokenConfigured: false,
    phoneNumberId: "",
    businessNumber:
      activeBusiness?.whatsapp_number || activeBusiness?.phone || "",
    backendWebhookUrl: `${apiBaseUrl}/webhooks/whatsapp`,
  });

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  // States for updating WhatsApp number directly
  const [whatsappNumberInput, setWhatsappNumberInput] = useState("");
  const [savingNumber, setSavingNumber] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // States for copying Web Chat link
  const [copiedWebChatField, setCopiedWebChatField] = useState(false);

  const handleCopyWebChatLink = async () => {
    if (!activeBusiness) return;
    const chatUrl = `${window.location.origin}/b/${activeBusiness.id}/chat`;
    try {
      await navigator.clipboard.writeText(chatUrl);
      setCopiedWebChatField(true);
      setTimeout(() => setCopiedWebChatField(false), 2000);
    } catch (err) {
      console.error("Unable to copy web chat link:", err);
    }
  };

  // Synchronize input with business data when loaded
  useEffect(() => {
    if (activeBusiness) {
      setWhatsappNumberInput(activeBusiness.whatsapp_number || "");
    }
  }, [activeBusiness]);

  const handleSaveNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness || !token) return;
    setSavingNumber(true);
    setSaveSuccess(null);
    setSaveError(null);
    try {
      const updated = await updateBusiness(
        activeBusiness.id,
        { whatsapp_number: whatsappNumberInput.trim() },
        token
      );
      setActiveBusiness(updated);
      setSaveSuccess("WhatsApp Business number updated successfully!");
      setConfig((prev) => ({
        ...prev,
        businessNumber: updated.whatsapp_number || "",
      }));
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error saving WhatsApp number:", err);
      setSaveError(err.message || "Failed to update WhatsApp Business number.");
    } finally {
      setSavingNumber(false);
    }
  };

  useEffect(() => {
    async function fetchConfig() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        setConfigError(null);

        const res = await fetch(`${apiBaseUrl}/webhooks/whatsapp/config`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`Unable to load WhatsApp configuration (${res.status}).`);
        }

        const data = await res.json();

        setConfig((prev) => ({
          ...prev,
          whatsappMode: data.whatsappMode || "simulation",
          verifyTokenConfigured: Boolean(data.verifyTokenConfigured),
          phoneNumberId: data.phoneNumberId || "",
          businessNumber:
            data.businessNumber ||
            activeBusiness?.whatsapp_number ||
            activeBusiness?.phone ||
            "",
          backendWebhookUrl:
            data.backendWebhookUrl || `${apiBaseUrl}/webhooks/whatsapp`,
        }));
      } catch (err) {
        console.error("Error fetching WhatsApp config:", err);
        setConfigError(
          err instanceof Error
            ? err.message
            : "Unable to load WhatsApp configuration."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchConfig();
  }, [token, activeBusiness, apiBaseUrl]);

  const isCloudApi = config.whatsappMode.toLowerCase() === "cloud_api";

  const isConnected = useMemo(() => {
    return Boolean(
      isCloudApi &&
      config.phoneNumberId &&
      config.businessNumber &&
      config.verifyTokenConfigured
    );
  }, [
    isCloudApi,
    config.phoneNumberId,
    config.businessNumber,
    config.verifyTokenConfigured,
  ]);

  const copyToClipboard = async (text: string, fieldName: string) => {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Unable to copy to clipboard:", err);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5 transition-colors duration-300">
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-green-600 to-emerald-500 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">
            WhatsApp Integration
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Connect EasyBiz AI to WhatsApp Business Cloud API and manage your
            live customer-support channel.
          </p>
        </div>

        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors duration-300 ${isConnected
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400"
            }`}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              }`}
          />
          {loading
            ? "Checking connection..."
            : isConnected
              ? "WhatsApp Connected"
              : `Mode: ${config.whatsappMode.toUpperCase()}`}
        </div>
      </div>

      {configError && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {configError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Link WhatsApp Number Form */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 backdrop-blur-xl p-6 shadow-sm dark:shadow-none transition-colors duration-300">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-900/30 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <div className="flex-grow space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                    Step 1: Enter Your WhatsApp Business Number
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed">
                    Enter the WhatsApp phone number you set up in your Meta Developer App (including the country code, e.g. <code className="font-mono bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded text-[10px] text-slate-707 dark:text-slate-300">+233249999999</code>). This links your incoming customer chats to your EasyBiz AI assistant.
                  </p>
                </div>

                <form onSubmit={handleSaveNumber} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                  <div className="flex-grow">
                    <input
                      type="text"
                      placeholder="e.g. +233249999999"
                      value={whatsappNumberInput}
                      onChange={(e) => setWhatsappNumberInput(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-black focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 dark:text-slate-100 font-medium transition duration-200"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingNumber || !whatsappNumberInput}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 dark:disabled:text-slate-500 hover:shadow-lg hover:shadow-emerald-500/10 active:translate-y-0.5 transition duration-200 shrink-0 flex items-center justify-center gap-1.5"
                  >
                    {savingNumber ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        Saving...
                      </>
                    ) : (
                      "Save Number"
                    )}
                  </button>
                </form>

                {saveSuccess && (
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 px-3.5 py-2.5 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                    {saveSuccess}
                  </div>
                )}

                {saveError && (
                  <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300 font-medium">
                    {saveError}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Live connection status */}
          <div className="relative overflow-hidden rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-gradient-to-br from-white via-slate-50 to-emerald-50/15 dark:from-slate-900 dark:via-slate-950 dark:to-emerald-950/20 p-6 shadow-sm dark:shadow-xl transition-colors duration-300">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -z-10" />

            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <svg
                    className="w-6 h-6 text-emerald-500 dark:text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 4v-4z"
                    />
                  </svg>
                  Live WhatsApp Channel
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 max-w-xl leading-relaxed">
                  Customer messages sent to your configured WhatsApp Business
                  number are received by EasyBiz AI, processed through your
                  business knowledge base, and answered through WhatsApp.
                </p>
              </div>

              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${isConnected
                    ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                  }`}
              >
                {loading ? "Checking" : isConnected ? "Connected" : "Needs attention"}
              </span>
            </div>
          </div>

          {/* Webhook configuration */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 backdrop-blur-xl p-6 space-y-4 shadow-sm dark:shadow-none transition-colors duration-300">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-blue-500 dark:text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
              Meta Webhook Configuration
            </h2>

            <p className="text-slate-500 dark:text-slate-400 text-xs">
              These are the safe connection details used by Meta to deliver
              WhatsApp events to your EasyBiz backend.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Callback URL
                </span>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5">
                  <code className="text-xs text-slate-700 dark:text-slate-300 font-mono flex-grow truncate">
                    {config.backendWebhookUrl || "Not configured"}
                  </code>
                  <button
                    type="button"
                    disabled={!config.backendWebhookUrl}
                    onClick={() =>
                      copyToClipboard(config.backendWebhookUrl, "url")
                    }
                    className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition duration-200 disabled:opacity-50"
                    aria-label="Copy callback URL"
                  >
                    {copiedField === "url" ? (
                      <span className="text-[10px] text-emerald-500 font-bold uppercase">
                        Copied!
                      </span>
                    ) : (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Verification Token
                </span>
                <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5">
                  <div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {config.verifyTokenConfigured ? "Configured" : "Not configured"}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      The actual token is hidden for security.
                    </p>
                  </div>
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${config.verifyTokenConfigured
                        ? "bg-emerald-500"
                        : "bg-amber-500"
                      }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Test tools */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 p-6 shadow-sm transition-colors duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                  Test Tools
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 max-w-xl">
                  Use the simulator when you want to test the chatbot without
                  sending a real WhatsApp message.
                </p>
              </div>

              <Link
                href="/dashboard/whatsapp/simulate"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 transition"
              >
                Launch Simulator
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </Link>
            </div>
          </div>

          {/* Web Chat Channel Link Card */}
          {activeBusiness && (
            <div className="rounded-2xl border border-indigo-100 dark:border-indigo-950/60 bg-gradient-to-r from-indigo-50/20 via-white to-blue-50/10 dark:from-indigo-950/10 dark:via-slate-950 dark:to-blue-950/5 p-6 shadow-sm dark:shadow-none transition-colors duration-300 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -z-10" />
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                      Alternative Channel: Web Chat Link
                    </h2>
                    <p className="text-slate-505 dark:text-slate-400 text-xs mt-1 leading-relaxed">
                      Don't want to limit customer access to WhatsApp? Share this Web Chat link on your social media bios, emails, or flyers. Customers can click and chat with your AI assistant immediately in their browser, with no setup required.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center pt-2">
                  <div className="flex-grow flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-2.5 pl-3.5 font-mono text-xs text-slate-605 dark:text-slate-300 select-all truncate max-w-md">
                    {typeof window !== 'undefined' ? `${window.location.origin}/b/${activeBusiness.id}/chat` : `/b/${activeBusiness.id}/chat`}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleCopyWebChatLink}
                      className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 border flex items-center gap-1.5 shadow-sm active:translate-y-0.5 ${
                        copiedWebChatField
                          ? "bg-emerald-600 border-emerald-600 text-white shadow-emerald-500/20"
                          : "bg-indigo-600 hover:bg-indigo-500 border-indigo-600 text-white hover:shadow-indigo-500/20"
                      }`}
                    >
                      {copiedWebChatField ? (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          Copy Link
                        </>
                      )}
                    </button>
                    <a
                      href={`/b/${activeBusiness.id}/chat`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-707 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition duration-200 text-center shadow-sm"
                    >
                      Preview Chat
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 backdrop-blur-xl p-6 space-y-4 shadow-sm dark:shadow-none transition-colors duration-300">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Active Configuration
            </h3>

            <div className="space-y-3.5 text-sm">
              <div className="border-b border-slate-100 dark:border-slate-900 pb-2">
                <span className="text-xs text-slate-400 block">Connection Mode</span>
                <span className="text-slate-700 dark:text-slate-300 font-semibold text-xs uppercase">
                  {config.whatsappMode || "Not configured"}
                </span>
              </div>

              <div className="border-b border-slate-100 dark:border-slate-900 pb-2">
                <span className="text-xs text-slate-400 block">
                  WhatsApp Phone Number ID
                </span>
                <span className="text-slate-700 dark:text-slate-300 font-mono text-xs break-all">
                  {config.phoneNumberId || "Not configured"}
                </span>
              </div>

              <div className="border-b border-slate-100 dark:border-slate-900 pb-2">
                <span className="text-xs text-slate-400 block">
                  WhatsApp Business Number
                </span>
                <span className="text-slate-700 dark:text-slate-300 font-semibold">
                  {config.businessNumber || "Not configured"}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block">
                  WhatsApp Credentials Status
                </span>
                <span
                  className={`font-semibold text-xs flex items-center gap-1.5 mt-1 ${isConnected
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                    }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                  />
                  {loading
                    ? "Checking configuration"
                    : isConnected
                      ? "Connected / Live"
                      : "Configuration incomplete"}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800/40 bg-white dark:bg-slate-950/20 p-6 space-y-3 shadow-sm dark:shadow-none transition-colors duration-300">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Connection Checklist
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2">
                <span className={isCloudApi ? "text-emerald-500" : "text-amber-500"}>
                  {isCloudApi ? "✓" : "•"}
                </span>
                <span className="text-slate-600 dark:text-slate-400">
                  Cloud API mode enabled
                </span>
              </div>

              <div className="flex items-start gap-2">
                <span className={config.phoneNumberId ? "text-emerald-500" : "text-amber-500"}>
                  {config.phoneNumberId ? "✓" : "•"}
                </span>
                <span className="text-slate-600 dark:text-slate-400">
                  Meta Phone Number ID configured
                </span>
              </div>

              <div className="flex items-start gap-2">
                <span className={config.businessNumber ? "text-emerald-500" : "text-amber-500"}>
                  {config.businessNumber ? "✓" : "•"}
                </span>
                <span className="text-slate-600 dark:text-slate-400">
                  WhatsApp business number mapped
                </span>
              </div>

              <div className="flex items-start gap-2">
                <span
                  className={
                    config.verifyTokenConfigured
                      ? "text-emerald-500"
                      : "text-amber-500"
                  }
                >
                  {config.verifyTokenConfigured ? "✓" : "•"}
                </span>
                <span className="text-slate-600 dark:text-slate-400">
                  Webhook verification token configured
                </span>
              </div>
            </div>

            <p className="pt-2 text-[10px] leading-relaxed text-slate-400 border-t border-slate-100 dark:border-slate-900">
              Sensitive credentials such as the Meta access token and webhook
              verification token remain on the backend and are never displayed
              in the browser.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}