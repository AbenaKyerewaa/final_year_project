"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createBusiness } from '@/services/business';

export default function CreateBusiness() {
  const { token, refreshBusinesses } = useAuth();
  const router = useRouter();

  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [paymentMethods, setPaymentMethods] = useState('');
  const [deliveryOptions, setDeliveryOptions] = useState('');
  const [description, setDescription] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Client validations
  const validateForm = () => {
    if (!businessName.trim()) {
      setError("Business Name is required.");
      return false;
    }
    if (!category.trim()) {
      setError("Category is required.");
      return false;
    }
    if (!location.trim()) {
      setError("Location is required.");
      return false;
    }
    if (!phone.trim()) {
      setError("Phone number is required.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) return;
    if (!token) {
      setError("Session expired. Please log in again.");
      return;
    }

    setSubmitting(true);
    try {
      await createBusiness({
        business_name: businessName.trim(),
        category: category.trim(),
        location: location.trim(),
        phone: phone.trim(),
        whatsapp_number: whatsappNumber.trim() || undefined,
        opening_hours: openingHours.trim() || undefined,
        payment_methods: paymentMethods.trim() || undefined,
        delivery_options: deliveryOptions.trim() || undefined,
        description: description.trim() || undefined
      }, token);

      // Refresh list in global context
      await refreshBusinesses();
      
      // Redirect back to listing
      router.push('/dashboard/businesses');
    } catch (err: any) {
      setError(err.message || "Failed to create business profile.");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-5">
        <button
          onClick={() => router.push('/dashboard/businesses')}
          className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/40 text-slate-400 hover:text-white"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="flex flex-col">
          <h2 className="text-2xl font-extrabold text-white">Create Business Profile</h2>
          <p className="text-xs text-slate-400 mt-1">Register a new Ghanaian SME context model.</p>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-3 text-xs text-rose-455 bg-rose-955/20 border border-rose-900/50 rounded-lg">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 md:p-8 rounded-2xl border border-slate-800/80 bg-slate-905/20 backdrop-blur-xl shadow-2xl flex flex-col gap-5">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Business Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-450 uppercase tracking-wider">
              Business Name *
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Kojo's Electronics Shop"
              required
              className="px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
            />
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-455 uppercase tracking-wider">
              Category *
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Electronics, Retail, Beauty"
              required
              className="px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
            />
          </div>

          {/* Location */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-455 uppercase tracking-wider">
              Location *
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Adum, Kumasi"
              required
              className="px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
            />
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-455 uppercase tracking-wider">
              Phone Number *
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +233 24 123 4567"
              required
              className="px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
            />
          </div>

          {/* WhatsApp */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-455 uppercase tracking-wider">
              WhatsApp Number
            </label>
            <input
              type="text"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="e.g. +233 24 123 4567"
              className="px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
            />
          </div>

          {/* Opening Hours */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-455 uppercase tracking-wider">
              Opening Hours
            </label>
            <input
              type="text"
              value={openingHours}
              onChange={(e) => setOpeningHours(e.target.value)}
              placeholder="e.g. Mon-Sat: 8:00 AM - 6:00 PM"
              className="px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
            />
          </div>

          {/* Payment Methods */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-455 uppercase tracking-wider">
              Payment Methods
            </label>
            <input
              type="text"
              value={paymentMethods}
              onChange={(e) => setPaymentMethods(e.target.value)}
              placeholder="e.g. MTN Mobile Money, Cash, Visa"
              className="px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
            />
          </div>

          {/* Delivery Options */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-455 uppercase tracking-wider">
              Delivery Options
            </label>
            <input
              type="text"
              value={deliveryOptions}
              onChange={(e) => setDeliveryOptions(e.target.value)}
              placeholder="e.g. Nationwide delivery via VIP bus, local pickup"
              className="px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
            />
          </div>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5 mt-1">
          <label className="text-xs font-semibold text-slate-455 uppercase tracking-wider">
            Business Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Introduce your business context, warranty options, core values, etc..."
            rows={4}
            className="px-4 py-3 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200 resize-none"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full mt-4 py-3 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold flex justify-center items-center gap-2 hover:shadow-lg hover:shadow-blue-500/20 active:translate-y-0.5 transition duration-200 disabled:opacity-50"
        >
          {submitting ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              Registering Business...
            </>
          ) : (
            'Create Business Profile'
          )}
        </button>

      </form>

    </div>
  );
}
