"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { listServices, deleteService, updateService, ServiceResponse, importServicesCSV } from '@/services/service';

export default function ServicesList() {
  const { token, activeBusiness, activeBusinessLoading } = useAuth();
  const router = useRouter();

  const [services, setServices] = useState<ServiceResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null); // tracks row loading for toggle or delete

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [reindexAfterImport, setReindexAfterImport] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<any | null>(null);
  const [showImportPanel, setShowImportPanel] = useState(false);

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

  const getServiceCategoryText = () => {
    if (!activeBusiness) return {
      title: "Services Offerings",
      addBtn: "+ Add Service",
      importTitle: "Bulk Import Services (CSV)",
      downloadLabel: "Download the default services template format:",
      filename: "services_template.csv"
    };
    const category = (activeBusiness.category || "").toLowerCase();
    if (category.includes("education") || category.includes("school") || category.includes("academy")) {
      return {
        title: "School Fees & Billing",
        addBtn: "+ Add School Fee / Item",
        importTitle: "Bulk Import School Fees (CSV)",
        downloadLabel: "Download the default school fees template format:",
        filename: "school_fees_template.csv"
      };
    } else if (category.includes("food") || category.includes("beverage") || category.includes("restaurant") || category.includes("cafe")) {
      return {
        title: "Restaurant Booking & Catering Services",
        addBtn: "+ Add Catering Service",
        importTitle: "Bulk Import Catering Services (CSV)",
        downloadLabel: "Download the default catering template format:",
        filename: "catering_template.csv"
      };
    } else if (category.includes("pharmacy") || category.includes("dispensary") || category.includes("medical") || category.includes("clinic")) {
      return {
        title: "Pharmacy Clinical Services",
        addBtn: "+ Add Clinical Service",
        importTitle: "Bulk Import Pharmacy Services (CSV)",
        downloadLabel: "Download the default pharmacy services template format:",
        filename: "pharmacy_services_template.csv"
      };
    }
    return {
      title: "Services Offerings",
      addBtn: "+ Add Service Offering",
      importTitle: "Bulk Import Services (CSV)",
      downloadLabel: "Download the default services template format:",
      filename: "services_template.csv"
    };
  };

  const textMapping = getServiceCategoryText();

  const downloadServiceTemplate = () => {
    let headers = "service details,description,price,duration,status\n";
    let row1 = "Laptop Diagnostics,Full system teardown and hardware diagnostic check,50,30-60 mins,available\n";
    let row2 = "OS Reinstallation,Clean install of Windows or macOS including drivers,120,1-2 hours,available\n";
    
    if (activeBusiness) {
      const category = (activeBusiness.category || "").toLowerCase();
      if (category.includes("education") || category.includes("school") || category.includes("academy")) {
        headers = "fee name,description,price,billing unit,status\n";
        row1 = "Term Tuition,Full tuition fee cover per academic term,1500,term,available\n";
        row2 = "Bus Transport,Monthly school bus pickup,350,month,available\n";
      } else if (category.includes("food") || category.includes("beverage") || category.includes("restaurant") || category.includes("cafe")) {
        headers = "service name,description,price,billing unit,status\n";
        row1 = "VIP Table Reservation,Lounge table booking for up to 6 guests,100,booking,available\n";
        row2 = "Event Catering,Full buffet setup and service per guest,150,guest,available\n";
      } else if (category.includes("pharmacy") || category.includes("dispensary") || category.includes("medical") || category.includes("clinic")) {
        headers = "service name,description,price,duration,status\n";
        row1 = "Pharmacist Consultation,General health consultation with the on-duty pharmacist,50,15-30 mins,available\n";
        row2 = "Blood Pressure Check,Quick check of blood pressure,10,10-15 mins,available\n";
      }
    }
    
    const blob = new Blob([headers + row1 + row2], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", textMapping.filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = async () => {
    if (!csvFile || !activeBusiness || !token || importing) return;
    setImporting(true);
    setError(null);
    setImportSummary(null);

    try {
      const summary = await importServicesCSV(activeBusiness.id, csvFile, reindexAfterImport, token);
      setImportSummary(summary);
      
      if (summary.successful_rows > 0) {
        await fetchServices();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred uploading the CSV file.");
    } finally {
      setImporting(false);
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
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/10 gap-5 max-w-xl mx-auto mt-10">
        <div className="w-14 h-14 rounded-2xl bg-amber-950/20 text-amber-500 border border-amber-900/30 flex items-center justify-center">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">No Active Business Selected</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-5">
        <div className="flex flex-col">
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">{textMapping.title}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage professional services, booking prices, and durations scoped under <span className="text-blue-400 font-semibold">{activeBusiness.business_name}</span>.
          </p>
        </div>
        <Link
          href="/dashboard/services/create"
          className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white text-center hover:shadow-lg hover:shadow-blue-500/20 active:translate-y-0.5 transition duration-200"
        >
          {textMapping.addBtn}
        </Link>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-3 text-xs text-rose-500 bg-rose-950/20 border border-rose-900/50 rounded-lg">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      {/* CSV Import Panel */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-slate-900/10 backdrop-blur-xl shadow-lg p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 cursor-pointer select-none" onClick={() => setShowImportPanel(!showImportPanel)}>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-405" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{textMapping.importTitle}</h3>
          </div>
          <span className="text-xs text-slate-500 hover:text-slate-600 dark:text-slate-350 font-medium">
            {showImportPanel ? "Collapse [-]" : "Expand [+]"}
          </span>
        </div>

        {showImportPanel && (
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs bg-slate-100 dark:bg-slate-950/40 p-3 rounded-lg border border-slate-900/60">
              <span className="text-slate-500 dark:text-slate-400">{textMapping.downloadLabel}</span>
              <button
                type="button"
                onClick={downloadServiceTemplate}
                className="px-3.5 py-1.5 rounded bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-700 hover:text-white text-slate-700 dark:text-slate-300 font-semibold cursor-pointer transition text-xs shrink-0"
              >
                Download CSV Template
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select CSV File</label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setCsvFile(e.target.files[0]);
                    setImportSummary(null);
                  }
                }}
                className="text-xs text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-600/20 file:text-blue-400 hover:file:bg-blue-600/30 file:cursor-pointer cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="reindex_service_chk"
                checked={reindexAfterImport}
                onChange={(e) => setReindexAfterImport(e.target.checked)}
                className="w-4 h-4 rounded border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/40 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
              />
              <label htmlFor="reindex_service_chk" className="text-xs text-slate-500 dark:text-slate-400 select-none cursor-pointer">
                Rebuild search index immediately after successful import
              </label>
            </div>

            <button
              type="button"
              onClick={handleImportCSV}
              disabled={!csvFile || importing}
              className="py-2.5 px-4 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition disabled:opacity-40 flex items-center justify-center gap-2 shadow-md hover:shadow-blue-500/10 cursor-pointer w-full md:w-auto self-start"
            >
              {importing ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Importing Services...
                </>
              ) : (
                "Upload & Import CSV"
              )}
            </button>

            {importSummary && (
              <div className="mt-4 border-t border-slate-900/60 pt-4 flex flex-col gap-3 text-xs">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[10px]">Import Results Summary:</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-100 dark:bg-slate-950/40 border border-slate-900/60 p-2.5 rounded-lg flex flex-col items-center">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Rows</span>
                    <span className="text-lg font-extrabold text-slate-800 dark:text-slate-200 mt-1">{importSummary.total_rows}</span>
                  </div>
                  <div className="bg-emerald-950/10 border border-emerald-900/30 p-2.5 rounded-lg flex flex-col items-center">
                    <span className="text-[10px] text-emerald-500/70 uppercase font-semibold">Successful</span>
                    <span className="text-lg font-extrabold text-emerald-400 mt-1">{importSummary.successful_rows}</span>
                  </div>
                  <div className="bg-rose-950/10 border border-rose-900/30 p-2.5 rounded-lg flex flex-col items-center">
                    <span className="text-[10px] text-rose-500/70 uppercase font-semibold">Failed</span>
                    <span className="text-lg font-extrabold text-rose-500 mt-1">{importSummary.failed_rows}</span>
                  </div>
                </div>

                {importSummary.errors.length > 0 && (
                  <div className="flex flex-col gap-2 mt-2">
                    <span className="text-rose-500 font-bold">Row-level errors / warnings:</span>
                    <div className="bg-rose-950/5 border border-rose-900/20 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-[11px] text-rose-350 leading-relaxed space-y-1">
                      {importSummary.errors.map((err: string, eIdx: number) => (
                        <div key={eIdx}>• {err}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Data loading spinner */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : services.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/10 backdrop-blur-md shadow-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-4 px-6">Service details</th>
                <th className="py-4 px-6">Standard Price</th>
                <th className="py-4 px-6">Duration</th>
                <th className="py-4 px-6 text-center">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {services.map((service) => {
                const isWorking = actionId === service.id;
                const isUnavailable = service.availability_status === 'unavailable';

                return (
                  <tr key={service.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/20 transition duration-150">
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{service.name}</span>
                        {service.description && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1 max-w-xs">
                            {service.description}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-800 dark:text-slate-200 font-semibold">
                      {service.currency} {parseFloat(service.price.toString()).toFixed(2)}
                    </td>
                    <td className="py-4 px-6 text-slate-600 dark:text-slate-350">
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
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-900/20 text-slate-500 dark:text-slate-400 hover:text-white hover:bg-slate-800 transition"
                          title="Edit Service"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Link>
                        <button
                          onClick={() => handleDelete(service.id, service.name)}
                          disabled={isWorking}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-900/20 text-rose-500/80 hover:text-rose-500 hover:bg-rose-950/10 transition disabled:opacity-50"
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
        <div className="flex flex-col items-center justify-center p-16 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/10 gap-5 mt-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-950/20 text-blue-400 border border-blue-900/30 flex items-center justify-center">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="flex flex-col gap-1.5 max-w-sm">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">No Services Registered</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
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
