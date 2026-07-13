"use client";

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getService, updateService } from '@/services/service';

export default function EditService({ params }: { params: any }) {
  const unwrappedParams = use<{ id: string }>(params);
  const id = unwrappedParams.id;

  const { token, activeBusiness } = useAuth();
  const router = useRouter();

  const getPlaceholders = () => {
    if (!activeBusiness) return {
      name: "e.g. Laptop Diagnostics / Cleaning",
      duration: "e.g. 15-20",
      description: "e.g. Full system teardown, thermal paste replacement, and motherboard dust cleaning."
    };
    
    const category = (activeBusiness.category || "").toLowerCase();
    
    if (category.includes("education") || category.includes("school") || category.includes("academy")) {
      return {
        name: "e.g. Term Tuition / Admission Registration",
        duration: "e.g. 1",
        description: "e.g. Full tuition fee cover for one child per academic term, including course textbooks."
      };
    } else if (category.includes("food") || category.includes("beverage") || category.includes("restaurant") || category.includes("cafe")) {
      return {
        name: "e.g. VIP Table Reservation / Event Catering",
        duration: "e.g. 1-2",
        description: "e.g. VIP lounge table booking for up to 6 guests including a complimentary welcome mocktail."
      };
    } else if (category.includes("pharmacy") || category.includes("dispensary") || category.includes("medical") || category.includes("clinic")) {
      return {
        name: "e.g. Pharmacist Consultation / BP Check",
        duration: "e.g. 10-15",
        description: "e.g. General health consultation with the on-duty pharmacist, including blood pressure check."
      };
    }
    
    return {
      name: "e.g. Laptop Diagnostics / Cleaning",
      duration: "e.g. 15-20",
      description: "e.g. Full system teardown, thermal paste replacement, and motherboard dust cleaning."
    };
  };

  const placeholders = getPlaceholders();

  const getDurationLabel = () => {
    if (!activeBusiness) return "Duration";
    const category = (activeBusiness.category || "").toLowerCase();
    if (category.includes("school") || category.includes("education") || category.includes("academy") || category.includes("food") || category.includes("beverage") || category.includes("restaurant") || category.includes("cafe")) {
      return "Service Unit";
    }
    return "Duration";
  };

  const getDurationOptions = () => {
    if (!activeBusiness) return [
      { value: "minutes", label: "Minutes" },
      { value: "hours", label: "Hours" },
      { value: "days", label: "Days" }
    ];
    
    const category = (activeBusiness.category || "").toLowerCase();
    
    if (category.includes("education") || category.includes("school") || category.includes("academy")) {
      return [
        { value: "term", label: "Per Term" },
        { value: "month", label: "Per Month" },
        { value: "one-time", label: "One-Time Fee" }
      ];
    } else if (category.includes("food") || category.includes("beverage") || category.includes("restaurant") || category.includes("cafe")) {
      return [
        { value: "booking", label: "Per Booking" },
        { value: "guest", label: "Per Guest" },
        { value: "hour", label: "Per Hour" },
        { value: "delivery", label: "Per Delivery" },
        { value: "one-time", label: "One-Time Fee" }
      ];
    }
    
    return [
      { value: "minutes", label: "Minutes" },
      { value: "hours", label: "Hours" },
      { value: "days", label: "Days" }
    ];
  };

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('GHS');
  const [duration, setDuration] = useState('');
  const [durationUnit, setDurationUnit] = useState('minutes');
  const [availabilityStatus, setAvailabilityStatus] = useState('available');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadServiceData() {
      if (!token || !id) return;
      try {
        const data = await getService(id, token);
        setName(data.name || '');
        setDescription(data.description || '');
        setPrice(data.price ? data.price.toString() : '');
        setCurrency(data.currency || 'GHS');
        setDuration(data.duration !== undefined && data.duration !== null ? data.duration.toString() : '');
        setDurationUnit(data.duration_unit || 'minutes');
        setAvailabilityStatus(data.availability_status || 'available');
      } catch (err: any) {
        setError(err.message || "Failed to load service data.");
      } finally {
        setLoading(false);
      }
    }
    loadServiceData();
  }, [id, token]);

  const validateForm = () => {
    if (!name.trim()) {
      setError("Service Name is required.");
      return false;
    }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setError("Price must be a positive number.");
      return false;
    }
    if (duration.trim() !== '') {
      const rangeRegex = /^\s*\d+\s*(-\s*\d+)?\s*$/;
      if (!rangeRegex.test(duration)) {
        setError("Duration must be a number or a range (e.g. 30 or 15-20).");
        return false;
      }
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
      await updateService(id, {
        name: name.trim(),
        description: description.trim(),
        price: parseFloat(price),
        currency: currency.trim(),
        duration: duration.trim() !== '' ? duration.trim() : null as any, // Cast for API expectation
        duration_unit: durationUnit,
        availability_status: availabilityStatus
      }, token);

      router.push('/dashboard/services');
    } catch (err: any) {
      setError(err.message || "Failed to update service.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-5">
        <button
          onClick={() => router.push('/dashboard/services')}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-900/40 text-slate-500 dark:text-slate-400 hover:text-white"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="flex flex-col">
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Edit Service</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Modify properties of service offering.</p>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-3 text-xs text-rose-500 bg-rose-950/20 border border-rose-900/50 rounded-lg">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 md:p-8 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-slate-950/5 backdrop-blur-xl shadow-2xl flex flex-col gap-5">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Service Name */}
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Service Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={placeholders.name}
              required
              className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          {/* Price */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Price *
            </label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              required
              className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          {/* Currency */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Currency
            </label>
            <input
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="GHS"
              required
              className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          {/* Duration */}
          {/* Duration / Service Unit */}
          <div className="flex flex-col gap-1.5 md:col-span-1">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {getDurationLabel()}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder={placeholders.duration}
                className="w-28 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
              />
              <select
                value={durationUnit}
                onChange={(e) => setDurationUnit(e.target.value)}
                className="flex-1 px-4 py-2.5 min-w-[120px] rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
              >
                {getDurationOptions().map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Availability Status */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Availability Status
            </label>
            <select
              value={availabilityStatus}
              onChange={(e) => setAvailabilityStatus(e.target.value)}
              className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
            >
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={placeholders.description}
            rows={4}
            className="px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition resize-none"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full mt-4 py-3 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold flex justify-center items-center gap-2 hover:shadow-lg hover:shadow-blue-500/20 active:translate-y-0.5 transition disabled:opacity-50"
        >
          {submitting ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              Saving changes...
            </>
          ) : (
            'Save Changes'
          )}
        </button>

      </form>

    </div>
  );
}
