"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/components/Providers';
import { Sun, Moon } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, businesses, activeBusiness, setActiveBusiness } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sidebar Links
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )},
    { name: 'Businesses', path: '/dashboard/businesses', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    )},
    { name: 'Products', path: '/dashboard/products', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    )},
    { name: 'Services', path: '/dashboard/services', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    )},
    { name: 'FAQs', path: '/dashboard/faqs', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )},
    { name: 'Documents', path: '/dashboard/documents', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )},
    { name: 'Chat Test', path: '/dashboard/chat-test', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    )},
    { name: 'Chat History', path: '/dashboard/chat-history', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )},
    { name: 'WhatsApp', path: '/dashboard/whatsapp', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
      </svg>
    )}
  ];

  // Route protection loading state
  if (loading || !user) {
    return (
      <div className="flex flex-grow items-center justify-center min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-800 dark:text-slate-100 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Verifying session...</p>
        </div>
      </div>
    );
  }

  // Handle active business change
  const handleBusinessChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    if (selectedId === 'create') {
      window.location.href = '/dashboard/businesses/create';
      return;
    }
    const biz = businesses.find(b => b.id === selectedId);
    if (biz) {
      setActiveBusiness(biz);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-800 dark:text-slate-100 font-sans transition-colors duration-300">
      
      {/* Sidebar - Desktop */}
      <aside className="w-64 hidden lg:flex flex-col border-r border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-950/20 backdrop-blur-xl shrink-0 p-6 gap-6 transition-colors duration-300">
        
        {/* Brand Logo & Theme Toggler Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent tracking-tight">
              EasyBiz AI
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30 uppercase">
              SME
            </span>
          </div>
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition duration-200 active:scale-95"
            title="Toggle Theme"
          >
            {resolvedTheme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-600" />}
          </button>
        </div>

        {/* Business Selector dropdown */}
        <div className="flex flex-col gap-1.5 mt-2">
          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest">
            Active Business
          </label>
          {businesses.length > 0 ? (
            <select
              value={activeBusiness?.id || ''}
              onChange={handleBusinessChange}
              className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
            >
              {businesses.map((biz) => (
                <option key={biz.id} value={biz.id} className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">
                  {biz.business_name}
                </option>
              ))}
              <option value="create" className="bg-white dark:bg-slate-950 text-blue-600 dark:text-blue-400 font-semibold">
                + Create New Profile
              </option>
            </select>
          ) : (
            <Link
              href="/dashboard/businesses/create"
              className="w-full text-center px-3 py-2 text-xs font-semibold rounded-lg border border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 bg-slate-50/50 dark:bg-slate-950/10 text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white transition duration-200"
            >
              + Add Business Profile
            </Link>
          )}
        </div>

        {/* Navigation List */}
        <nav className="flex flex-col gap-1.5 flex-grow mt-4">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            
            return (
              <Link
                key={item.name}
                href={item.path}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition duration-200 ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30 font-semibold shadow-sm dark:shadow-none'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/40'
                }`}
              >
                {item.icon}
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User Card footer */}
        <div className="flex flex-col gap-3 border-t border-slate-200 dark:border-slate-800 pt-4 mt-auto">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{user.full_name}</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate uppercase tracking-wider">{user.role}</span>
          </div>
          <button
            onClick={logout}
            className="w-full py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold active:translate-y-0.5 transition duration-200"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <div className="flex flex-col flex-grow min-w-0">
        
        {/* Header - Mobile Menu Toggler */}
        <header className="lg:hidden w-full px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-950/20 backdrop-blur-xl z-40 transition-colors duration-300">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent tracking-tight">
              EasyBiz AI
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300"
              title="Toggle Theme"
            >
              {resolvedTheme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(prev => !prev)}
              className="p-2 rounded-lg border border-slate-250 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                )}
              </svg>
            </button>
          </div>
        </header>

        {/* Mobile Menu Content Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden flex flex-col border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/90 backdrop-blur-2xl p-6 gap-5 animate-fade-in absolute w-full left-0 z-30 shadow-lg">
            {/* Mobile Business selector */}
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-widest">
                Active Business
              </label>
              {businesses.length > 0 ? (
                <select
                  value={activeBusiness?.id || ''}
                  onChange={(e) => {
                    handleBusinessChange(e);
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200"
                >
                  {businesses.map((biz) => (
                    <option key={biz.id} value={biz.id} className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">
                      {biz.business_name}
                    </option>
                  ))}
                  <option value="create" className="bg-white dark:bg-slate-950 text-blue-600 dark:text-blue-400 font-semibold">+ Create New Profile</option>
                </select>
              ) : (
                <Link
                  href="/dashboard/businesses/create"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center px-3 py-2 text-xs font-semibold rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/10 text-slate-600 dark:text-slate-300"
                >
                  + Add Business Profile
                </Link>
              )}
            </div>

            {/* Mobile Nav links */}
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.path;
                
                return (
                  <Link
                    key={item.name}
                    href={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium ${
                      isActive 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    {item.icon}
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* Mobile Logout / Profile info */}
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-4 mt-2">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{user.full_name}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">{user.role}</span>
              </div>
              <button
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 text-xs font-semibold"
              >
                Logout
              </button>
            </div>
          </div>
        )}

        {/* Children Page View */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10 transition-colors duration-300">
          {children}
        </main>

      </div>

    </div>
  );
}
