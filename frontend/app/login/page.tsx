"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function Login() {
  const { login, loading, user } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Client-side validations
  const validateForm = () => {
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email address.");
      return false;
    }
    if (!password) {
      setError("Password is required.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) return;

    setSubmitting(true);
    try {
      await login({
        email: email.trim().toLowerCase(),
        password
      });
      // Redirect is handled automatically by AuthContext
    } catch (err: any) {
      setError(err.message || "Login failed. Please check your credentials.");
      setSubmitting(false);
    }
  };

  if (loading || user) {
    return (
      <div className="flex flex-grow items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Preparing EasyBiz AI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-grow items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 dark:from-slate-900 via-white dark:via-slate-950 to-slate-200 dark:to-black px-4 select-none transition-colors duration-300">
      
      {/* Container */}
      <div className="w-full max-w-md p-8 rounded-2xl glass-panel shadow-2xl">
        
        {/* Back Link */}
        <Link 
          href="/" 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors duration-200 mb-6 group"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 20 20" 
            fill="currentColor" 
            className="w-4 h-4 transform group-hover:-translate-x-0.5 transition-transform duration-200"
          >
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
          Back to Home
        </Link>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 dark:from-blue-400 via-cyan-600 dark:via-cyan-400 to-indigo-600 dark:to-indigo-400 bg-clip-text text-transparent">
            Welcome Back
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-2">
            Log in to manage your Ghanaian SME support agent.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-3 text-sm text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-lg animate-fade-in">
            <span className="font-semibold">Error:</span> {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Email input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="michy@techhub.com"
              required
              className="glass-input rounded-lg px-4 py-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
            />
          </div>

          {/* Password input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="glass-input rounded-lg px-4 py-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-3 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold flex justify-center items-center gap-2 hover:shadow-lg hover:shadow-blue-500/20 active:translate-y-0.5 transition-all duration-200 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Logging in...
              </>
            ) : (
              'Log In'
            )}
          </button>
        </form>

        {/* Footer info link */}
        <div className="text-center mt-6 text-sm text-slate-600 dark:text-slate-400">
          Don't have an account?{' '}
          <Link href="/register" className="text-blue-600 dark:text-blue-400 hover:underline">
            Register here
          </Link>
        </div>

      </div>

    </div>
  );
}
