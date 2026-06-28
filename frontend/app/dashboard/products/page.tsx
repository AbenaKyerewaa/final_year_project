"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { listProducts, deleteProduct, updateProduct, ProductResponse, importProductsCSV } from '@/services/product';

export default function ProductsList() {
  const { token, activeBusiness, activeBusinessLoading } = useAuth();
  const router = useRouter();

  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null); // tracks row loading for toggle or delete

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [reindexAfterImport, setReindexAfterImport] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<any | null>(null);
  const [showImportPanel, setShowImportPanel] = useState(false);

  const fetchProducts = async () => {
    if (!token || !activeBusiness) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listProducts(activeBusiness.id, token);
      setProducts(data);
    } catch (err: any) {
      setError(err.message || "Failed to retrieve products list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeBusiness) {
      fetchProducts();
    }
  }, [activeBusiness, token]);

  const handleToggleStock = async (product: ProductResponse) => {
    if (!token) return;
    setActionId(product.id);
    setError(null);

    const nextStatus = product.availability_status === 'available' ? 'out_of_stock' : 'available';
    const nextQty = nextStatus === 'out_of_stock' ? 0 : product.quantity === 0 ? 5 : product.quantity;

    try {
      const updated = await updateProduct(product.id, {
        availability_status: nextStatus,
        quantity: nextQty
      }, token);
      
      setProducts(prev => prev.map(p => p.id === product.id ? updated : p));
    } catch (err: any) {
      setError(err.message || "Failed to update stock status.");
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (productId: string, productName: string) => {
    if (!token) return;
    const confirmDelete = window.confirm(`Are you sure you want to delete "${productName}"? This action cannot be undone.`);
    if (!confirmDelete) return;

    setActionId(productId);
    setError(null);
    try {
      await deleteProduct(productId, token);
      setProducts(prev => prev.filter(p => p.id !== productId));
    } catch (err: any) {
      setError(err.message || "Failed to delete product.");
    } finally {
      setActionId(null);
    }
  };

  const handleImportCSV = async () => {
    if (!csvFile || !activeBusiness || !token || importing) return;
    setImporting(true);
    setError(null);
    setImportSummary(null);

    try {
      const summary = await importProductsCSV(activeBusiness.id, csvFile, reindexAfterImport, token);
      setImportSummary(summary);
      
      // If we imported some valid rows, reload the list!
      if (summary.successful_rows > 0) {
        await fetchProducts();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred uploading the CSV file.");
    } finally {
      setImporting(false);
    }
  };

  const downloadProductTemplate = () => {
    const headers = "name,category,description,price,currency,quantity,availability_status,warranty\n";
    const row1 = "HP EliteBook 840 G6,Laptops,Core i5 8GB 256GB SSD,4200,GHS,5,available,3 months\n";
    const row2 = "Wireless Mouse,Accessories,Ergonomic 2.4GHz mouse,85,GHS,20,available,No warranty\n";
    const blob = new Blob([headers + row1 + row2], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "products_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          <p className="text-xs text-slate-450 leading-relaxed max-w-sm">
            Please register or select an active business profile from the sidebar console before managing products.
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
          <h2 className="text-2xl font-extrabold text-white">Product Catalog</h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage inventory and pricing scoped under <span className="text-blue-400 font-semibold">{activeBusiness.business_name}</span>.
          </p>
        </div>
        <Link
          href="/dashboard/products/create"
          className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white text-center hover:shadow-lg hover:shadow-blue-500/20 active:translate-y-0.5 transition duration-200"
        >
          + Add Product
        </Link>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-3 text-xs text-rose-455 bg-rose-955/20 border border-rose-900/50 rounded-lg">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      {/* CSV Import Panel */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/10 backdrop-blur-xl shadow-lg p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-850 pb-3 cursor-pointer select-none" onClick={() => setShowImportPanel(!showImportPanel)}>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-405" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <h3 className="text-sm font-bold text-slate-200">Bulk Import Products (CSV)</h3>
          </div>
          <span className="text-xs text-slate-500 hover:text-slate-350 font-medium">
            {showImportPanel ? "Collapse [-]" : "Expand [+]"}
          </span>
        </div>

        {showImportPanel && (
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs bg-slate-950/40 p-3 rounded-lg border border-slate-900/60">
              <span className="text-slate-400">Download the default products template format:</span>
              <button
                type="button"
                onClick={downloadProductTemplate}
                className="px-3.5 py-1.5 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 hover:text-white text-slate-300 font-semibold cursor-pointer transition text-xs shrink-0"
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
                className="text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-600/20 file:text-blue-400 hover:file:bg-blue-600/30 file:cursor-pointer cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="reindex_chk"
                checked={reindexAfterImport}
                onChange={(e) => setReindexAfterImport(e.target.checked)}
                className="w-4 h-4 rounded border-slate-800 bg-slate-950/40 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
              />
              <label htmlFor="reindex_chk" className="text-xs text-slate-400 select-none cursor-pointer">
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
                  Importing Products...
                </>
              ) : (
                "Upload & Import CSV"
              )}
            </button>

            {importSummary && (
              <div className="mt-4 border-t border-slate-900/60 pt-4 flex flex-col gap-3 text-xs">
                <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[10px]">Import Results Summary:</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-950/40 border border-slate-900/60 p-2.5 rounded-lg flex flex-col items-center">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Rows</span>
                    <span className="text-lg font-extrabold text-slate-200 mt-1">{importSummary.total_rows}</span>
                  </div>
                  <div className="bg-emerald-955/10 border border-emerald-900/30 p-2.5 rounded-lg flex flex-col items-center">
                    <span className="text-[10px] text-emerald-500/70 uppercase font-semibold">Successful</span>
                    <span className="text-lg font-extrabold text-emerald-450 mt-1">{importSummary.successful_rows}</span>
                  </div>
                  <div className="bg-rose-955/10 border border-rose-900/30 p-2.5 rounded-lg flex flex-col items-center">
                    <span className="text-[10px] text-rose-500/70 uppercase font-semibold">Failed</span>
                    <span className="text-lg font-extrabold text-rose-455 mt-1">{importSummary.failed_rows}</span>
                  </div>
                </div>

                {importSummary.errors.length > 0 && (
                  <div className="flex flex-col gap-2 mt-2">
                    <span className="text-rose-450 font-bold">Row-level errors / warnings:</span>
                    <div className="bg-rose-955/5 border border-rose-900/20 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-[11px] text-rose-350 leading-relaxed space-y-1">
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
      ) : products.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-950/10 backdrop-blur-md shadow-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-4 px-6">Product Details</th>
                <th className="py-4 px-6">Category</th>
                <th className="py-4 px-6">Price</th>
                <th className="py-4 px-6">Quantity</th>
                <th className="py-4 px-6">Warranty</th>
                <th className="py-4 px-6 text-center">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/60">
              {products.map((product) => {
                const isWorking = actionId === product.id;
                const isOutOfStock = product.availability_status === 'out_of_stock' || product.quantity <= 0;
                const isLimited = product.availability_status === 'limited';

                return (
                  <tr key={product.id} className="hover:bg-slate-900/20 transition duration-150">
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-200 text-sm">{product.name}</span>
                        {product.description && (
                          <span className="text-[11px] text-slate-450 mt-0.5 line-clamp-1 max-w-xs">
                            {product.description}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-300 font-medium">
                      {product.category || "—"}
                    </td>
                    <td className="py-4 px-6 text-slate-200 font-semibold">
                      {product.currency} {parseFloat(product.price.toString()).toFixed(2)}
                    </td>
                    <td className="py-4 px-6 text-slate-350">
                      {product.quantity} unit(s)
                    </td>
                    <td className="py-4 px-6 text-slate-400">
                      {product.warranty || "—"}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => handleToggleStock(product)}
                          disabled={isWorking}
                          title="Click to toggle availability status"
                          className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wide border flex items-center gap-1.5 transition ${
                            isOutOfStock
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                              : isLimited
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            isOutOfStock ? 'bg-rose-500' : isLimited ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}></span>
                          {product.availability_status}
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/products/${product.id}/edit`}
                          className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/20 text-slate-400 hover:text-white hover:bg-slate-800 transition"
                          title="Edit Product"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Link>
                        <button
                          onClick={() => handleDelete(product.id, product.name)}
                          disabled={isWorking}
                          className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/20 text-rose-500/80 hover:text-rose-455 hover:bg-rose-955/10 transition disabled:opacity-50"
                          title="Delete Product"
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
        /* Zero state products list */
        <div className="flex flex-col items-center justify-center p-16 text-center rounded-2xl border border-dashed border-slate-800/80 bg-slate-950/10 gap-5 mt-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-955/20 text-blue-450 border border-blue-900/30 flex items-center justify-center">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div className="flex flex-col gap-1.5 max-w-sm">
            <h3 className="text-lg font-bold text-slate-200">No Products Registered</h3>
            <p className="text-xs text-slate-450 leading-relaxed">
              Register electronic wares, merchandise, or inventory assets to feed context into your SME's RAG chatbot.
            </p>
          </div>
          <Link
            href="/dashboard/products/create"
            className="px-6 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition hover:shadow-lg hover:shadow-blue-500/20 active:translate-y-0.5"
          >
            + Register First Product
          </Link>
        </div>
      )}

    </div>
  );
}
