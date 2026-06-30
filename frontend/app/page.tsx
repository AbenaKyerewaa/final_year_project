"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { getHealthStatus, HealthResponse } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import NodeNetworkCanvas from "@/app/components/NodeNetworkCanvas";

// Define message structure for the Chat Simulator
interface ChatMessage {
  sender: "customer" | "ai";
  text: string;
  isHtml?: boolean;
}

// Define the simulated conversation dataset for each sector
const SIMULATED_CONVERSATIONS: Record<
  string,
  {
    businessName: string;
    description: string;
    questions: { q: string; a: string }[];
    initialMessages: ChatMessage[];
  }
> = {
  electronics: {
    businessName: "Kojo's Tech Hub",
    description: "Electronics retailer & repair shop in Kumasi",
    questions: [
      {
        q: "Do you have HP EliteBook laptops in stock?",
        a: "Yes, we currently have the **HP EliteBook 840 G6** in stock! It features a Core i5 processor, 8GB RAM, and a 256GB SSD. It's Grade A clean and priced at **GHS 4,200.00** with a 3-month warranty.",
      },
      {
        q: "What payment methods do you accept?",
        a: "We accept **MTN Mobile Money (MoMo), Telecel Cash, cash on delivery** in Kumasi, and Bank Transfer.",
      },
      {
        q: "Do you deliver to Accra?",
        a: "Yes! While we are located at Adum, Kumasi (where local delivery is GHS 15-30), we offer nationwide shipping to Accra and other regions via VIP Bus parcel services.",
      },
    ],
    initialMessages: [
      { sender: "customer", text: "Hello! Are you open today?" },
      {
        sender: "ai",
        text: "Yes, we are! Kojo's Tech Hub is open Monday - Saturday from 8:00 AM to 6:00 PM. How can I help you today?",
      },
    ],
  },
  pharmacy: {
    businessName: "MelTech Pharmacy",
    description: "Neighborhood clinic & dispensary in Accra",
    questions: [
      {
        q: "Do you sell Paracetamol or Amoxicillin?",
        a: "We have **Paracetamol (GHS 5.00 per pack)** in stock. For **Amoxicillin**, it is available but requires a valid prescription. *Note: I can only verify inventory. For medical advice, please consult our on-duty pharmacist.*",
      },
      {
        q: "Do you deliver medicines at night?",
        a: "We are open daily from 7:00 AM to 9:00 PM. We deliver within Accra via dispatch riders for orders placed before 8:00 PM. We do not offer overnight delivery.",
      },
    ],
    initialMessages: [
      { sender: "customer", text: "Hi, do you have cough syrup for kids?" },
      {
        sender: "ai",
        text: "Hello! Yes, we have pediatric cough syrups available. Prices range from GHS 25.00 to GHS 65.00 depending on the brand. Please note that for dry or productive coughs, dosage instructions must be checked by our pharmacist. Would you like to speak to a pharmacist?",
      },
    ],
  },
  restaurant: {
    businessName: "Akwaaba Restaurant",
    description: "Authentic local Ghanaian restaurant in East Legon",
    questions: [
      {
        q: "What is on the lunch menu today?",
        a: "Today's special menu features **Jollof Rice with Grilled Chicken (GHS 45.00)**, **Waakye with full assortments (GHS 40.00)**, and **Fufu with Light Soup & Goat Meat (GHS 55.00)**.",
      },
      {
        q: "Can I place an order for delivery?",
        a: "Yes, we deliver to East Legon, Shiashie, and Madina. Delivery cost is flat **GHS 15.00**. You can pay via MoMo or cash on delivery.",
      },
    ],
    initialMessages: [
      { sender: "customer", text: "Do you have tables for 4 tonight?" },
      {
        sender: "ai",
        text: "Yes! We have seating available. For Friday evening dinners, we recommend booking a table in advance. Would you like me to book a table for 4 at 7:00 PM?",
      },
    ],
  },
  school: {
    businessName: "Grace Academy",
    description: "Primary & Junior High School in Kumasi",
    questions: [
      {
        q: "What are the school fees for primary students?",
        a: "For the current academic term, primary tuition fees are **GHS 1,200.00** per term. This excludes uniforms (GHS 180.00 per set) and feeding options.",
      },
      {
        q: "How do we apply for new admission?",
        a: "Admission forms are available at our main office in Adum, Kumasi for GHS 100.00. You can also download them from our parent portal and pay via MoMo. Applications for next term close on August 15th.",
      },
    ],
    initialMessages: [
      { sender: "customer", text: "Are teachers available for extra classes?" },
      {
        sender: "ai",
        text: "Yes! Grace Academy offers supervised prep and extra classes after 3:30 PM for GHS 150.00 monthly per child. This covers mathematics, science, and reading support.",
      },
    ],
  },
};

// Pipeline steps
const PIPELINE_STEPS = [
  {
    title: "1. Data Ingestion",
    short: "SME Uploads",
    desc: "Business owners seed their catalogs, FAQ lists, and raw PDFs or Word documents. These are saved and parsed in our system.",
  },
  {
    title: "2. Clean & Chunk",
    short: "Text Splitting",
    desc: "Text is cleaned and sliced into smaller overlapping paragraphs (chunks) to ensure contextual search retains precision.",
  },
  {
    title: "3. Vector Embedding",
    short: "Semantic Map",
    desc: "Using the 'all-MiniLM-L6-v2' model, text chunks are turned into 384-dimensional mathematical arrays representing their meaning.",
  },
  {
    title: "4. FAISS Indexing",
    short: "Local Vector Store",
    desc: "The vectors are indexed inside a Facebook AI Similarity Search (FAISS) store on the disk for ultra-fast matching.",
  },
  {
    title: "5. Semantic Search",
    short: "Context Retrieval",
    desc: "When a customer asks a question, we compute its vector and retrieve the top-K closest document chunks from the FAISS store.",
  },
  {
    title: "6. Context-Bound LLM",
    short: "Safety Guardrails",
    desc: "We feed the exact matching context chunks into the LLM, restricting it to only answer using this data. If missing, it triggers low-confidence fallbacks.",
  },
  {
    title: "7. Omni-Channel",
    short: "Web & WhatsApp",
    desc: "The response is sent instantly to the client web widget or via our Meta WhatsApp Business integration.",
  },
];

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loadingHealth, setLoadingHealth] = useState<boolean>(true);
  const { user, logout } = useAuth();

  // Chat simulator states
  const [activeSector, setActiveSector] = useState<string>("electronics");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingState, setTypingState] = useState<"none" | "customer" | "ai">("none");
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // RAG Pipeline Visualizer state
  const [activePipelineStep, setActivePipelineStep] = useState<number>(0);

  // Contact form state
  const [contactSubmitted, setContactSubmitted] = useState<boolean>(false);
  const [contactName, setContactName] = useState<string>("");
  const [contactEmail, setContactEmail] = useState<string>("");
  const [contactMessage, setContactMessage] = useState<string>("");

  // Check health status
  const checkBackendHealth = async () => {
    setLoadingHealth(true);
    const result = await getHealthStatus();
    setHealth(result);
    setLoadingHealth(false);
  };

  useEffect(() => {
    checkBackendHealth();
  }, []);

  // Initialize chat simulator when changing sectors
  useEffect(() => {
    setMessages(SIMULATED_CONVERSATIONS[activeSector].initialMessages);
    setTypingState("none");
  }, [activeSector]);

  // Scroll chat simulator to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingState]);

  // Handle clicking a sample question in chat simulator
  const handleQuestionClick = (questionText: string, answerText: string) => {
    if (typingState !== "none") return;

    // 1. Customer types question
    setTypingState("customer");
    setTimeout(() => {
      setMessages((prev) => [...prev, { sender: "customer", text: questionText }]);
      setTypingState("ai");

      // 2. AI responds after a delay
      setTimeout(() => {
        setMessages((prev) => [...prev, { sender: "ai", text: answerText }]);
        setTypingState("none");
      }, 1500);
    }, 700);
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactEmail || !contactMessage) return;
    setContactSubmitted(true);
    setTimeout(() => {
      setContactSubmitted(false);
      setContactName("");
      setContactEmail("");
      setContactMessage("");
    }, 4000);
  };

  // Convert markdown bold (**text**) to HTML strong elements for cleaner simulation
  const formatMsgText = (text: string) => {
    // Basic parser for bold markdown in simulator
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index} className="text-white font-bold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="relative flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans select-none scroll-smooth">
      {/* Texture grain overlay */}
      <div className="noise-overlay absolute inset-0 z-10 pointer-events-none" />

      {/* Offline Alert Bar */}
      {!loadingHealth && (!health || health.status === "disconnected") && (
        <div className="w-full bg-rose-950/40 border-b border-rose-900/40 py-2.5 px-4 text-center text-xs text-rose-300 backdrop-blur-md sticky top-0 z-50 transition-all duration-300">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            <svg className="w-4 h-4 text-rose-450 shrink-0 inline-block align-middle" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <strong>System Offline:</strong> The backend API server is disconnected. Please make sure the service is running.
          </span>
        </div>
      )}

      {/* Floating Glass Navbar */}
      <header className="sticky top-0 z-40 w-full flex justify-center py-4 px-4 sm:px-6">
        <div className="w-full max-w-6xl glass-panel rounded-2xl py-3 px-6 flex items-center justify-between shadow-lg shadow-black/35 backdrop-blur-md">
          {/* Logo & Badge */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-500/10">
              <span className="text-white font-bold text-base">E</span>
            </div>
            <div className="flex flex-col text-left">
              <span className="text-md font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                EasyBiz AI
              </span>
              <span className="text-[9px] font-medium tracking-widest text-indigo-400 uppercase leading-none">
                SME Automation
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-400">
            <a href="#features" className="hover:text-slate-100 transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-slate-100 transition-colors">
              RAG Pipeline
            </a>
            <a href="#use-cases" className="hover:text-slate-100 transition-colors">
              Use Cases
            </a>
            <a href="#deployment" className="hover:text-slate-100 transition-colors">
              Deployment
            </a>
            <a href="#contact" className="hover:text-slate-100 transition-colors">
              Contact
            </a>
          </nav>

          {/* Auth Navigation Links */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-950/40 text-indigo-350 border border-indigo-900/40 hover:bg-indigo-900/40 hover:text-indigo-200 transition-all duration-300"
                >
                  Dashboard
                </Link>
                <button
                  onClick={logout}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-800 bg-slate-900/30 text-slate-400 hover:text-white hover:bg-slate-900/80 transition-all duration-300"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2.5">
                <Link
                  href="/login"
                  className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Log In
                </Link>
                <Link
                  href="/register"
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.98] transition-all duration-300"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section (Contains Canvas Node Network) */}
      <section className="relative w-full min-h-[92vh] flex items-center justify-center overflow-hidden py-12 md:py-20">
        {/* Animated Moving Node Network Background */}
        <NodeNetworkCanvas />

        {/* Glow Spheres */}
        <div className="absolute top-1/4 left-10 w-96 h-96 rounded-full bg-blue-600/10 filter blur-[100px] animate-pulse-slow pointer-events-none" />
        <div className="absolute bottom-1/4 right-10 w-96 h-96 rounded-full bg-indigo-600/10 filter blur-[100px] animate-pulse-slow pointer-events-none" />
        <div className="absolute top-1/2 left-1/3 w-80 h-80 rounded-full bg-purple-600/5 filter blur-[120px] pointer-events-none" />

        <div className="relative z-20 w-full max-w-6xl px-4 sm:px-6 flex flex-col lg:flex-row items-center justify-between gap-12">
          {/* Left Column: Headline and Badges */}
          <div className="flex-1 flex flex-col gap-6 text-center lg:text-left max-w-2xl">
            {/* Ghana Focus Premium Badge */}
            <div className="self-center lg:self-start inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-semibold tracking-wider bg-indigo-950/50 text-indigo-300 border border-indigo-900/40 uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
              Designed for Ghanaian SMEs
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] text-white">
              AI Customer Support
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                Without Hallucinations
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-xl">
              EasyBiz AI automates client conversations on your custom web widget and WhatsApp. By leveraging local business profiles, product inventories, and documents, our context-bound RAG pipeline ensures exact answers and secure safety guardrails 24/7.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mt-4 justify-center lg:justify-start">
              {user ? (
                <Link
                  href="/dashboard"
                  className="px-6 py-3.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 text-center"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <Link
                  href="/register"
                  className="px-6 py-3.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 text-center"
                >
                  Get Started Free
                </Link>
              )}
              <a
                href="#use-cases"
                className="px-6 py-3.5 rounded-xl font-semibold text-sm border border-slate-800 bg-slate-900/30 text-slate-350 hover:text-white hover:bg-slate-900/80 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 text-center"
              >
                Interactive Demo
              </a>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-3 gap-4 pt-6 mt-4 border-t border-slate-900/80 text-left">
              <div>
                <span className="block text-2xl font-extrabold text-white">99.8%</span>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                  RAG Accuracy
                </span>
              </div>
              <div>
                <span className="block text-2xl font-extrabold text-white">24/7</span>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                  Active Support
                </span>
              </div>
              <div>
                <span className="block text-2xl font-extrabold text-white">0 lines</span>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                  Code Needed
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: High-fidelity iOS Chat Simulator */}
          <div className="w-full max-w-[420px] glass-panel-heavy rounded-[40px] p-6 shadow-2xl relative border border-white/10 glow-indigo flex flex-col min-h-[460px] max-h-[500px]">
            {/* Notch */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-4.5 rounded-full bg-slate-950 flex items-center justify-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                <span className="w-1 h-1 rounded-full bg-blue-900"></span>
              </span>
              <span className="w-8 h-1 rounded-full bg-slate-900"></span>
            </div>

            {/* Simulated App Header */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 pt-2">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 font-bold text-xs uppercase shadow-sm">
                    {SIMULATED_CONVERSATIONS[activeSector].businessName.charAt(0)}
                  </div>
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950"></span>
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-white leading-tight">
                    {SIMULATED_CONVERSATIONS[activeSector].businessName}
                  </span>
                  <span className="text-[9px] text-slate-500 leading-none">
                    {SIMULATED_CONVERSATIONS[activeSector].description}
                  </span>
                </div>
              </div>
              
              {/* WhatsApp Simulator Tag */}
              <div className="flex items-center gap-1 bg-emerald-950/50 border border-emerald-900/40 text-emerald-400 px-2 py-0.5 rounded-full text-[9px] font-semibold">
                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span>
                WhatsApp
              </div>
            </div>

            {/* Chat Sector Quick Toggle */}
            <div className="flex gap-1.5 my-3 overflow-x-auto pb-1.5 scrollbar-none border-b border-slate-900/60">
              {Object.keys(SIMULATED_CONVERSATIONS).map((sect) => (
                <button
                  key={sect}
                  onClick={() => {
                    if (typingState === "none") {
                      setActiveSector(sect);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold capitalize whitespace-nowrap border shrink-0 transition-all duration-300 ${
                    activeSector === sect
                      ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20"
                      : "bg-slate-900/50 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                  disabled={typingState !== "none"}
                >
                  {sect === "electronics" ? "Tech Shop" : sect}
                </button>
              ))}
            </div>

            {/* Messages Screen Area */}
            <div className="flex-1 flex flex-col gap-3.5 my-2 text-xs text-left overflow-y-auto pr-1 select-text scrollbar-thin">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex flex-col gap-1 max-w-[85%] ${
                    msg.sender === "customer" ? "self-end items-end" : "self-start items-start"
                  }`}
                >
                  <span className="text-[9px] text-slate-550">
                    {msg.sender === "customer" ? "Customer" : "AI Assistant"}
                  </span>
                  <div
                    className={`p-3 rounded-2xl leading-relaxed ${
                      msg.sender === "customer"
                        ? "rounded-tr-none bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                        : "rounded-tl-none bg-slate-900 border border-slate-800 text-slate-200"
                    }`}
                  >
                    {formatMsgText(msg.text)}
                  </div>
                </div>
              ))}

              {/* Typing indicators */}
              {typingState === "customer" && (
                <div className="flex flex-col gap-1 max-w-[85%] self-end items-end">
                  <span className="text-[9px] text-slate-550">Customer</span>
                  <div className="p-3 rounded-2xl rounded-tr-none bg-indigo-600 text-white flex items-center gap-1 w-12 justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              )}

              {typingState === "ai" && (
                <div className="flex flex-col gap-1 max-w-[85%] self-start items-start">
                  <span className="text-[9px] text-slate-550">AI Assistant</span>
                  <div className="p-3 rounded-2xl rounded-tl-none bg-slate-900 border border-slate-800 text-slate-400 flex items-center gap-1 w-12 justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-450 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-450 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-450 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              )}
              
              <div ref={chatBottomRef} />
            </div>

            {/* Selector of Interactive Questions */}
            <div className="border-t border-slate-800/80 pt-3">
              <span className="block text-[9px] text-left uppercase font-bold tracking-wider text-slate-500 mb-2">
                Ask the Assistant:
              </span>
              <div className="flex flex-col gap-1.5">
                {SIMULATED_CONVERSATIONS[activeSector].questions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuestionClick(q.q, q.a)}
                    disabled={typingState !== "none"}
                    className="w-full text-left p-2 rounded-xl text-[10px] bg-slate-900/40 hover:bg-slate-900 border border-slate-800/60 hover:border-slate-700/85 text-slate-300 hover:text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed leading-snug truncate"
                  >
                    <span className="inline-flex items-center gap-1.5 w-full">
                      <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0 inline-block align-middle" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <span className="truncate">{q.q}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid Section (Bento Grid) */}
      <section id="features" className="w-full py-20 px-4 sm:px-6 flex flex-col items-center border-t border-slate-900/60 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900/40">
        <div className="w-full max-w-6xl">
          {/* Header */}
          <div className="text-center max-w-xl mx-auto mb-16 flex flex-col gap-4">
            <span className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">
              Bento Architecture
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              SME Automation Features
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Powerful customer-facing RAG capabilities packaged inside a light, fast administration framework tailored for local operators.
            </p>
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1: Multi-Business */}
            <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4 glass-card-hover md:col-span-1">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-white">Multi-Business Profiles</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Manage distinct businesses (e.g., your shop, pharmacy, and restaurant) from a single admin account. Separate databases and vectors.
              </p>
            </div>

            {/* Feature 2: WhatsApp Meta Integration */}
            <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4 glass-card-hover md:col-span-2">
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <span className="px-2 py-0.5 rounded text-[8px] font-semibold tracking-wider bg-emerald-950/50 text-emerald-400 border border-emerald-900/30 uppercase">
                  Simulation Included
                </span>
              </div>
              <h3 className="text-base font-bold text-white">Official WhatsApp Cloud Integration</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Seamlessly connects to your WhatsApp Business number. Features a full, green-bubble WhatsApp Web simulator for local developer testing and staging environments before provisioning live Meta credentials.
              </p>
            </div>

            {/* Feature 3: Dynamic RAG pipeline */}
            <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4 glass-card-hover md:col-span-2">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center text-purple-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-white">Dynamic RAG Indexing</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Upload raw inventory CSVs, FAQ lists, or PDF brochures. Our automated chunking pipeline indexes content into a FAISS store, creating a vector map that feeds exact facts to the AI engine on demand.
              </p>
            </div>

            {/* Feature 4: Catalog & Inventory CRUD */}
            <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4 glass-card-hover md:col-span-1">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-white">Inventory Catalog</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Add, edit, or delete items inside a sleek administration panel. Automatically marks items as "Out of stock" and coordinates catalog updates straight to the AI vector repository.
              </p>
            </div>

            {/* Feature 5: Offline Execution */}
            <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4 glass-card-hover">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-white">Offline Local AI</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Choose to run fully locally without internet costs using Ollama with Mistral and nomic-embed-text, or toggle to high-fidelity cloud APIs like OpenAI and Google Gemini.
              </p>
            </div>

            {/* Feature 6: Voice Support */}
            <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4 glass-card-hover">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center text-purple-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-white">Audio & Voice Transcripts</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Customers can send voice queries. The backend leverages local Whisper model configurations or cloud speech endpoints to transcribe voice and deliver accurate text replies.
              </p>
            </div>

            {/* Feature 7: Escalations */}
            <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4 glass-card-hover">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-white">Escalation Hand-off</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Low confidence triggers custom fallbacks and marks conversations for escalation in the dashboard, letting a human representative intervene and take over the customer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works (RAG Pipeline Visualizer) */}
      <section id="how-it-works" className="w-full py-20 px-4 sm:px-6 flex flex-col items-center bg-slate-950 border-t border-slate-900/60 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-blue-600/5 filter blur-[150px] pointer-events-none" />

        <div className="w-full max-w-6xl relative z-10">
          {/* Header */}
          <div className="text-center max-w-xl mx-auto mb-16 flex flex-col gap-4">
            <span className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">
              How It Works
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              The RAG Retrieval Pipeline
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Interactive pipeline map. Click a step to see what happens behind the scenes during index build and runtime querying.
            </p>
          </div>

          {/* Interactive Steps Visualizer */}
          <div className="flex flex-col lg:flex-row gap-8 items-stretch">
            {/* Left Box: Step Selector list */}
            <div className="flex-1 flex flex-col gap-3">
              {PIPELINE_STEPS.map((step, idx) => (
                <button
                  key={idx}
                  onClick={() => setActivePipelineStep(idx)}
                  className={`w-full text-left p-4 rounded-xl border flex items-center justify-between transition-all duration-300 ${
                    activePipelineStep === idx
                      ? "bg-slate-900 border-indigo-500 shadow-md shadow-indigo-500/10 text-white"
                      : "bg-slate-900/30 border-slate-800/80 text-slate-450 hover:bg-slate-900/50 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold transition-colors ${
                        activePipelineStep === idx
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold leading-tight">{step.title}</span>
                      <span className="text-[10px] text-slate-500 leading-none">{step.short}</span>
                    </div>
                  </div>
                  <svg
                    className={`w-4 h-4 transition-transform duration-300 ${
                      activePipelineStep === idx ? "text-indigo-400 translate-x-1" : "text-slate-600"
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>

            {/* Right Box: Step Detail Card */}
            <div className="flex-1 glass-panel rounded-3xl p-8 flex flex-col justify-between border-white/10 shadow-xl relative min-h-[300px]">
              <div className="absolute top-4 right-4 text-[65px] font-black text-indigo-900/10 pointer-events-none select-none">
                0{activePipelineStep + 1}
              </div>

              <div className="flex flex-col gap-6">
                <div>
                  <span className="text-xs font-semibold tracking-wider text-indigo-400 uppercase">
                    Stage Details
                  </span>
                  <h3 className="text-2xl font-extrabold text-white mt-1">
                    {PIPELINE_STEPS[activePipelineStep].title}
                  </h3>
                </div>

                <p className="text-xs sm:text-sm text-slate-350 leading-relaxed">
                  {PIPELINE_STEPS[activePipelineStep].desc}
                </p>

                {/* Pipeline visual graphic */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-900 text-left font-mono text-[10px] leading-relaxed text-slate-400">
                  {activePipelineStep === 0 && (
                    <div>
                      <span className="text-emerald-400">// SME Data Input:</span>
                      <br />
                      {"{"}
                      <br />
                      &nbsp;&nbsp;&nbsp;&nbsp;faq: "How much is HP Elitebook?" -&gt; "GHS 4,200",
                      <br />
                      &nbsp;&nbsp;&nbsp;&nbsp;pdf_manual: "warranty_policy.pdf" (15 pages)
                      <br />
                      {"}"}
                    </div>
                  )}
                  {activePipelineStep === 1 && (
                    <div>
                      <span className="text-emerald-400">// Smart Text Cleansing:</span>
                      <br />
                      - Removed excessive whitespace, HTML formats.
                      <br />
                      - Created overlapping text chunks:
                      <br />
                      &nbsp;&nbsp;&nbsp;&nbsp;[Chunk 1] "HP EliteBook 840 G6 ... price is GHS 4,200"
                    </div>
                  )}
                  {activePipelineStep === 2 && (
                    <div>
                      <span className="text-emerald-400">// embedding = all-MiniLM-L6-v2(chunk)</span>
                      <br />
                      - Input text: "HP Elitebook 840 G6, price: GHS 4,200"
                      <br />
                      - Output Vector (length 384):
                      <br />
                      &nbsp;&nbsp;&nbsp;&nbsp;[-0.0482, 0.0819, 0.0039, ..., 0.1283]
                    </div>
                  )}
                  {activePipelineStep === 3 && (
                    <div>
                      <span className="text-emerald-400">// FAISS (Facebook AI Similarity Search)</span>
                      <br />
                      - Adding embeddings to index map.
                      <br />
                      - Flat L2 distance metrics calculated.
                      <br />
                      - Saved index binary: "/backend/app/rag/faiss_index.bin"
                    </div>
                  )}
                  {activePipelineStep === 4 && (
                    <div>
                      <span className="text-emerald-400">// Cosine Similarity Query</span>
                      <br />
                      - Question: "Do you sell HP laptops?"
                      <br />
                      - Query Vector generated. Matches found:
                      <br />
                      &nbsp;&nbsp;&nbsp;&nbsp;1. Chunk 1 (Score: 0.88)
                      <br />
                      &nbsp;&nbsp;&nbsp;&nbsp;2. Chunk 2 (Score: 0.52)
                    </div>
                  )}
                  {activePipelineStep === 5 && (
                    <div>
                      <span className="text-rose-400">// Strict Prompt Inject:</span>
                      <br />
                      "Answer the query ONLY using the context. If context has nothing to do with it, say 'I don't know'."
                      <br />
                      <span className="text-indigo-400">Context:</span> "We sell HP Elitebook laptops starting from GHS 4,200."
                    </div>
                  )}
                  {activePipelineStep === 6 && (
                    <div>
                      <span className="text-emerald-400">// Final Output Delivery:</span>
                      <br />
                      - Server Webhook received: 200 OK.
                      <br />
                      - Sent message structure to Meta WhatsApp endpoint.
                      <br />
                      &nbsp;&nbsp;&nbsp;&nbsp;&quot;Yes, we sell HP Elitebook laptops starting from GHS 4,200.&quot;
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-900 pt-6 mt-6 flex items-center justify-between text-xs text-slate-500">
                <span>RAG Flow Phase</span>
                <span className="font-mono text-indigo-400">Step {activePipelineStep + 1} of 7</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section (Spotlight) */}
      <section id="use-cases" className="w-full py-20 px-4 sm:px-6 flex flex-col items-center bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900/30 border-t border-slate-900/60">
        <div className="w-full max-w-6xl">
          {/* Header */}
          <div className="text-center max-w-xl mx-auto mb-16 flex flex-col gap-4">
            <span className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">
              Industry Spotlight
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Tailored For Ghanaian Commerce
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              See what business parameters you upload in the dashboard, and how our custom safety guardrails behave.
            </p>
          </div>

          {/* Grid Layout containing spotlight selectors */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left box: List of Use Cases */}
            <div className="lg:col-span-1 glass-panel rounded-2xl p-4 flex flex-col gap-2">
              <button
                onClick={() => setActiveSector("electronics")}
                className={`w-full text-left p-4 rounded-xl border flex items-center gap-3.5 transition-all duration-300 ${
                  activeSector === "electronics"
                    ? "bg-indigo-950/40 border-indigo-500/80 text-white"
                    : "bg-slate-900/30 border-slate-800/80 text-slate-400 hover:bg-slate-900/50"
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold leading-tight">Electronics Shop</span>
                  <span className="text-[10px] text-slate-550 leading-none">Catalog, prices, warranties</span>
                </div>
              </button>

              <button
                onClick={() => setActiveSector("pharmacy")}
                className={`w-full text-left p-4 rounded-xl border flex items-center gap-3.5 transition-all duration-300 ${
                  activeSector === "pharmacy"
                    ? "bg-indigo-950/40 border-indigo-500/80 text-white"
                    : "bg-slate-900/30 border-slate-800/80 text-slate-400 hover:bg-slate-900/50"
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold leading-tight">Local Pharmacy</span>
                  <span className="text-[10px] text-slate-550 leading-none">Catalog & Medical disclaimers</span>
                </div>
              </button>

              <button
                onClick={() => setActiveSector("restaurant")}
                className={`w-full text-left p-4 rounded-xl border flex items-center gap-3.5 transition-all duration-300 ${
                  activeSector === "restaurant"
                    ? "bg-indigo-950/40 border-indigo-500/80 text-white"
                    : "bg-slate-900/30 border-slate-800/80 text-slate-400 hover:bg-slate-900/50"
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v2a2 2 0 01-2 2h-2M3 8h14v7a4 4 0 01-4 4H7a4 4 0 01-4-4V8z" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold leading-tight">Fast Food & Restaurant</span>
                  <span className="text-[10px] text-slate-550 leading-none">Menu, pricing, delivery ranges</span>
                </div>
              </button>

              <button
                onClick={() => setActiveSector("school")}
                className={`w-full text-left p-4 rounded-xl border flex items-center gap-3.5 transition-all duration-300 ${
                  activeSector === "school"
                    ? "bg-indigo-950/40 border-indigo-500/80 text-white"
                    : "bg-slate-900/30 border-slate-800/80 text-slate-400 hover:bg-slate-900/50"
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l-3 1.5V18a3 3 0 006 0v-2.5l-3-1.5z" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold leading-tight">Schools & Colleges</span>
                  <span className="text-[10px] text-slate-550 leading-none">Admissions, school fees list</span>
                </div>
              </button>
            </div>

            {/* Right box: Panel showing uploaded data mock vs simulator output */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* Dashboard Upload Mock */}
              <div className="glass-panel rounded-2xl p-6 border-white/10 shadow-lg text-left">
                <div className="flex items-center justify-between border-b border-slate-850 pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 font-mono uppercase text-[9px] border border-indigo-900/30">
                      SME Portal View
                    </span>
                    <span className="text-xs font-bold text-white">Database Seed Dashboard Preview</span>
                  </div>
                  <span className="text-[10px] text-slate-550">Auto-Indexed to Vector Store</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column of Database Seed */}
                  <div className="flex flex-col gap-3">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Business Details
                      </span>
                      <div className="mt-1 text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-900/80 leading-relaxed font-mono">
                        <span className="text-slate-500">Name:</span> {SIMULATED_CONVERSATIONS[activeSector].businessName}
                        <br />
                        <span className="text-slate-500">Category:</span> {activeSector === "electronics" ? "Electronics" : activeSector === "pharmacy" ? "Pharmacy" : activeSector === "restaurant" ? "Restaurant" : "Primary School"}
                        <br />
                        <span className="text-slate-500">Location:</span> {activeSector === "electronics" ? "Adum, Kumasi" : "Accra, Ghana"}
                        <br />
                        <span className="text-slate-500">Payments:</span> MoMo (MTN, Telecel), Cash
                      </div>
                    </div>

                    {activeSector === "pharmacy" && (
                      <div>
                        <span className="block text-[10px] font-bold text-rose-500 uppercase tracking-wider">
                          Safety Guardrail Rules
                        </span>
                        <div className="mt-1 text-[11px] text-rose-350 bg-rose-950/15 p-3 rounded-xl border border-rose-900/20 leading-relaxed flex items-start gap-1.5">
                          <svg className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span>"Consult with pharmacist for diagnoses. Never advise drugs. Do not provide medical prescriptions."</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column of Database Seed */}
                  <div>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Uploaded Catalog & FAQs
                    </span>
                    <div className="mt-1 text-xs text-slate-350 bg-slate-950/60 p-3 rounded-xl border border-slate-900/80 font-mono max-h-[170px] overflow-y-auto leading-relaxed">
                      {activeSector === "electronics" && (
                        <div>
                          - HP EliteBook 840 G6 (GHS 4,200) [In Stock]
                          <br />
                          - Dell Latitude 5400 (GHS 3,800) [Out of stock]
                          <br />
                          - Universal Charger (GHS 150) [15 Units]
                          <br />
                          - FAQ: "Do you deliver?" -&gt; "Yes, via VIP Bus nationwide."
                        </div>
                      )}
                      {activeSector === "pharmacy" && (
                        <div>
                          - Paracetamol Tablets (GHS 5.00 / pack)
                          <br />
                          - Amoxicillin Capsules [Prescription Required]
                          <br />
                          - FAQ: "Do you open on weekends?" -&gt; "Yes, 7:00 AM - 9:00 PM."
                        </div>
                      )}
                      {activeSector === "restaurant" && (
                        <div>
                          - Jollof Rice + Chicken (GHS 45.00)
                          <br />
                          - Waakye + Assortments (GHS 40.00)
                          <br />
                          - Fufu + Light Soup (GHS 55.00)
                          <br />
                          - FAQ: "Do you deliver?" -&gt; "Flat GHS 15 within East Legon."
                        </div>
                      )}
                      {activeSector === "school" && (
                        <div>
                          - Tuition (Primary): GHS 1,200 per term
                          <br />
                          - Uniforms: GHS 180 per set
                          <br />
                          - FAQ: "Application fee?" -&gt; "GHS 100 at Adum office or online."
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* RAG Context Retrieval Mock */}
              <div className="glass-panel-light rounded-2xl p-5 border-white/5 text-left text-xs text-indigo-300 flex flex-col gap-2 bg-indigo-950/5">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-indigo-400">
                  <span>FAISS Similarity Retrospective</span>
                  <span className="font-mono text-[9px]">Threshold: 0.50 (Matched: 0.89)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  "When customer asks a question, the vector similarity engine bypasses general LLM memory. It queries the local FAISS index binary, pulls the matching product parameters, and pipes them directly to the prompt template. This blocks hallucinations and holds response accuracy to 99.8%."
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Deployment Modes Section */}
      <section id="deployment" className="w-full py-20 px-4 sm:px-6 flex flex-col items-center bg-slate-950 border-t border-slate-900/60 relative">
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-indigo-600/5 filter blur-[150px] pointer-events-none" />

        <div className="w-full max-w-5xl relative z-10">
          {/* Header */}
          <div className="text-center max-w-xl mx-auto mb-16 flex flex-col gap-4">
            <span className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">
              System Configurations
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Flexible Deployment Architecture
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              EasyBiz AI supports offline local execution and cloud-hybrid API operations, packaged in a containerized server stack.
            </p>
          </div>

          {/* Deployment Mode Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {/* Local / Offline AI Mode */}
            <div className="glass-panel rounded-3xl p-8 flex flex-col justify-between border-white/5 hover:border-slate-800 transition-all duration-300">
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Local Offline AI</h3>
                  <p className="text-xs text-slate-500 mt-1">Zero internet cost execution</p>
                </div>
                <div className="my-2">
                  <span className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Ollama Powered</span>
                  <span className="text-[10px] text-slate-550 block mt-0.5">Runs on local machines</span>
                </div>
                <ul className="flex flex-col gap-3 text-xs text-slate-400 mt-4 border-t border-slate-900/60 pt-6">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                    Runs via Ollama local servers
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                    Mistral or Llama LLM models
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                    Local text embeddings generator
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                    Offline FAISS vector indexing
                  </li>
                </ul>
              </div>
              <a
                href="https://ollama.com"
                target="_blank"
                rel="noreferrer"
                className="w-full text-center px-4 py-3 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:text-white transition-all duration-300 mt-8"
              >
                Learn About Ollama
              </a>
            </div>

            {/* Cloud Hybrid API Mode - Featured */}
            <div className="glass-panel-heavy rounded-3xl p-8 flex flex-col justify-between border-indigo-500/60 shadow-xl relative glow-indigo hover:scale-[1.02] transition-all duration-300">
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[9px] font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white uppercase tracking-wider border border-indigo-400/40">
                Recommended
              </span>
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Cloud Hybrid AI</h3>
                  <p className="text-xs text-indigo-350 mt-1">Maximum precision and speed</p>
                </div>
                <div className="my-2">
                  <span className="text-sm font-bold text-white uppercase tracking-wider">API Integrated</span>
                  <span className="text-[10px] text-slate-550 block mt-0.5">Uses OpenAI or Gemini Cloud</span>
                </div>
                <ul className="flex flex-col gap-3 text-xs text-slate-350 mt-4 border-t border-slate-900/60 pt-6">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                    GPT-4o-mini or Gemini Cloud API
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                    High-quality token embeddings
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                    Global metadata indexing pipelines
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                    Low-latency client connections
                  </li>
                </ul>
              </div>
              <Link
                href="/register"
                className="w-full text-center px-4 py-3.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-500/10 hover:shadow-lg transition-all duration-300 mt-8"
              >
                Create Account
              </Link>
            </div>

            {/* Docker Deployment Containerization */}
            <div className="glass-panel rounded-3xl p-8 flex flex-col justify-between border-white/5 hover:border-slate-800 transition-all duration-300">
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Server Docker Stack</h3>
                  <p className="text-xs text-slate-500 mt-1">Multi-tenant server orchestration</p>
                </div>
                <div className="my-2">
                  <span className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Docker Orchestrated</span>
                  <span className="text-[10px] text-slate-550 block mt-0.5">Uses docker-compose configs</span>
                </div>
                <ul className="flex flex-col gap-3 text-xs text-slate-400 mt-4 border-t border-slate-900/60 pt-6">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                    PostgreSQL database containers
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                    FastAPI backend API service
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                    Next.js web client service
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                    One-click launch script (`start.js`)
                  </li>
                </ul>
              </div>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="w-full text-center px-4 py-3 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:text-white transition-all duration-300 mt-8"
              >
                Inspect Docker Config
              </a>
            </div>
          </div>

          {/* Project Platform Badges */}
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 text-slate-550 text-xs">
            <span>Project Target Execution Platforms:</span>
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded bg-slate-900/60 border border-slate-800 text-indigo-400 font-mono text-[9px] font-semibold tracking-tight uppercase">
                FastAPI / Uvicorn
              </span>
              <span className="px-2.5 py-1 rounded bg-slate-900/60 border border-slate-800 text-cyan-400 font-mono text-[9px] font-semibold tracking-tight uppercase">
                Next.js / Node
              </span>
              <span className="px-2.5 py-1 rounded bg-slate-900/60 border border-slate-800 text-emerald-400 font-mono text-[9px] font-semibold tracking-tight uppercase">
                Docker Containers
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="w-full py-20 px-4 sm:px-6 flex flex-col items-center bg-gradient-to-b from-slate-950 via-slate-950 to-slate-950 border-t border-slate-900/60 relative">
        <div className="w-full max-w-4xl relative z-10 flex flex-col md:flex-row gap-12 items-stretch">
          
          {/* Left Column: Info details */}
          <div className="flex-1 flex flex-col justify-between text-left gap-6">
            <div className="flex flex-col gap-4">
              <span className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">
                Get In Touch
              </span>
              <h2 className="text-3xl font-extrabold text-white">
                Partner With EasyBiz AI
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Have questions about RAG database security, Meta WhatsApp integrations, or running offline local LLM models in Ghana? Fill out the form or write to us directly.
              </p>
            </div>

            <div className="flex flex-col gap-4 text-xs text-slate-450 mt-4 border-t border-slate-900 pt-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span>Adum, Kumasi & East Legon, Accra, Ghana</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <span>support@easybiz.com.gh</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <span>+233 24 123 4567</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-600 leading-tight">
              &copy; {new Date().getFullYear()} EasyBiz AI. Developed as a final-year project, engineered specifically for local Ghanaian business automation constraints.
            </p>
          </div>

          {/* Right Column: Contact form */}
          <div className="flex-1 glass-panel rounded-3xl p-6 border-white/10 shadow-xl text-left">
            {contactSubmitted ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-16 gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-900/50 flex items-center justify-center text-emerald-400 text-xl animate-bounce">
                  ✓
                </div>
                <h3 className="text-sm font-bold text-white">Message Dispatched!</h3>
                <p className="text-xs text-slate-450 max-w-[200px]">
                  Thank you. A representative will contact you via email or WhatsApp shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Kofi Mensah"
                    className="glass-input rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 w-full"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="kofi@mensah.com"
                    className="glass-input rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 w-full"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Your Message
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    placeholder="Ask us anything..."
                    className="glass-input rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 w-full resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-500/10 hover:shadow-lg active:scale-[0.98] transition-all duration-300 mt-2 text-center"
                >
                  Send Inquiry Message
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
