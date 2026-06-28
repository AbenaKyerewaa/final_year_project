"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { listServices, deleteService, updateService, ServiceResponse } from '@/services/service';

export default function ServicesList() {
  const { token, activeBusiness, activeBusinessLoading } = useAuth();
  const router = useRouter();

  const [services, setServices] = useState<ServiceResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null); // tracks row loading for toggle or delete

  const fetchServices = async () => {
    if (!token || !activeBusiness) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listServices(activeBusiness.id, token);
      setServices(data);
    } catch (err: any) {
      setError(err.message || "Failed to retrieve services list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeBusiness) {
      fetchServices();
    }
  }, [activeBusiness, token]);

  const handleToggleStatus = async (service: ServiceResponse) => {
    if (!token) return;
    setActionId(service.id);
    setError(null);

    const nextStatus = service.availability_status === 'available' ? 'unavailable' : 'available';

    try {
      const updated = await updateService(service.id, {
        availability_status: nextStatus
      }, token);
      
      setServices(prev => prev.map(s => s.id === service.id ? updated : s));
    } catch (err: any) {
      setError(err.message || "Failed to update service availability.");
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (serviceId: string, serviceName: string) => {
    if (!token) return;
    const confirmDelete = window.confirm(`Are you sure you want to delete service "${serviceName}"? This action cannot be undone.`);
    if (!confirmDelete) return;

    setActionId(serviceId);
    setError(null);
    try {
      await deleteService(serviceId, token);
      setServices(prev => prev.filter(s => s.id !== serviceId));
    } catch (err: any) {
      setError(err.message || "Failed to delete service.");
    } finally {
      setActionId(null);
    }
  };

  // 1. Loading active business profile state
  if (activeBusinessLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // 2. Zero-state business context warning
  if (!activeBusiness) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/10 gap-5 max-w-xl mx-auto mt-10">
        <div className="w-14 h-14 rounded-2xl bg-amber-955/20 text-amber-500 border border-amber-900/30 flex items-center justify-center">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="text-lg font-bold text-slate-200">No Active Business Selected</h3>
          <p className="text-xs text-slate-455 leading-relaxed max-w-sm">
            Please register or select an active business profile from the sidebar console before managing services.
          </p>
        </div>
        <Link
          href="/dashboard/businesses"
          className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition"
        >
          Go to Businesses
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex flex-col">
          <h2 className="text-2xl font-extrabold text-white">Services Offerings</h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage professional services, booking prices, and durations scoped under <span className="text-blue-400 font-semibold">{activeBusiness.business_name}</span>.
          </p>
        </div>
        <Link
          href="/dashboard/services/create"
          className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white text-center hover:shadow-lg hover:shadow-blue-500/20 active:translate-y-0.5 transition duration-200"
        >
          + Add Service
        </Link>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-3 text-xs text-rose-455 bg-rose-955/20 border border-rose-900/50 rounded-lg">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      {/* Data loading spinner */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : services.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-950/10 backdrop-blur-md shadow-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-4 px-6">Service details</th>
                <th className="py-4 px-6">Standard Price</th>
                <th className="py-4 px-6">Duration</th>
                <th className="py-4 px-6 text-center">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/60">
              {services.map((service) => {
                const isWorking = actionId === service.id;
                const isUnavailable = service.availability_status === 'unavailable';

                return (
                  <tr key={service.id} className="hover:bg-slate-900/20 transition duration-150">
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-200 text-sm">{service.name}</span>
                        {service.description && (
                          <span className="text-[11px] text-slate-455 mt-0.5 line-clamp-1 max-w-xs">
                            {service.description}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-200 font-semibold">
                      {service.currency} {parseFloat(service.price.toString()).toFixed(2)}
                    </td>
                    <td className="py-4 px-6 text-slate-350">
                      {service.duration ? `${service.duration} ${service.duration_unit || 'minutes'}` : "—"}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => handleToggleStatus(service)}
                          disabled={isWorking}
                          title="Click to toggle availability status"
                          className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wide border flex items-center gap-1.5 transition ${
                            isUnavailable
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            isUnavailable ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}></span>
                          {service.availability_status}
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/services/${service.id}/edit`}
                          className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/20 text-slate-400 hover:text-white hover:bg-slate-800 transition"
                          title="Edit Service"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Link>
                        <button
                          onClick={() => handleDelete(service.id, service.name)}
                          disabled={isWorking}
                          className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/20 text-rose-500/80 hover:text-rose-455 hover:bg-rose-955/10 transition disabled:opacity-50"
                          title="Delete Service"
                        >
                          {isWorking ? (
                            <span className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin inline-block"></span>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Zero state services list */
        <div className="flex flex-col items-center justify-center p-16 text-center rounded-2xl border border-dashed border-slate-800/80 bg-slate-950/10 gap-5 mt-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-955/20 text-blue-450 border border-blue-900/30 flex items-center justify-center">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="flex flex-col gap-1.5 max-w-sm">
            <h3 className="text-lg font-bold text-slate-200">No Services Registered</h3>
            <p className="text-xs text-slate-450 leading-relaxed">
              Register professional bookings, consulting packages, or school admissions to seed context into your SME's RAG chatbot.
            </p>
          </div>
          <Link
            href="/dashboard/services/create"
            className="px-6 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition hover:shadow-lg hover:shadow-blue-500/20 active:translate-y-0.5"
          >
            + Register First Service
          </Link>
        </div>
      )}

    </div>
  );
}
