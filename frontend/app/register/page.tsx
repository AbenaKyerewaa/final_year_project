"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function Register() {
  const { register, loading, user } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('business_owner');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Client-side validations
  const validateForm = () => {
    if (!fullName.trim()) {
      setError("Full name is required.");
      return false;
    }
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email address.");
      return false;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
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
      await register({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role
      });
      // Redirect is handled automatically by AuthContext
    } catch (err: any) {
      setError(err.message || "Failed to register. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading || user) {
    return (
      <div className="flex flex-grow items-center justify-center min-h-screen bg-black text-slate-100 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm">Preparing EasyBiz AI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-grow items-center justify-center min-h-screen bg-slate-900 text-slate-100 font-sans bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black px-4 select-none">

      {/* Container */}
      <div className="w-full max-w-md p-8 rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-xl shadow-2xl">

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
            Create an Account
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Get started with EasyBiz AI automation.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-3 text-sm text-rose-450 bg-rose-955/20 border border-rose-900/50 rounded-lg animate-fade-in">
            <span className="font-semibold">Error:</span> {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Name input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Kojo Mensah"
              required
              className="px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
            />
          </div>

          {/* Email input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kojo@techhub.com"
              required
              className="px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
            />
          </div>

          {/* Password input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
            />
          </div>

          {/* Role selector dropdown */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Your Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M7 9l3 3 3-3' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundPosition: 'right 0.75rem center',
                backgroundSize: '1.25rem',
                backgroundRepeat: 'no-repeat'
              }}
            >
              <option value="business_owner" className="bg-slate-950 text-slate-200">Business Owner (Default)</option>
              <option value="staff" className="bg-slate-950 text-slate-200">Staff Member</option>
              <option value="admin" className="bg-slate-950 text-slate-200">Administrator</option>
            </select>
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
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Footer info link */}
        <div className="text-center mt-6 text-sm text-slate-450">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-400 hover:underline">
            Login here
          </Link>
        </div>

      </div>

    </div>
  );
}
