"use client";

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getProduct, updateProduct } from '@/services/product';

export default function EditProduct({ params }: { params: any }) {
  const unwrappedParams = use<{ id: string }>(params);
  const id = unwrappedParams.id;

  const { token } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('GHS');
  const [quantity, setQuantity] = useState('0');
  const [availabilityStatus, setAvailabilityStatus] = useState('available');
  const [warranty, setWarranty] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadProductData() {
      if (!token || !id) return;
      try {
        const data = await getProduct(id, token);
        setName(data.name || '');
        setCategory(data.category || '');
        setDescription(data.description || '');
        setPrice(data.price ? data.price.toString() : '');
        setCurrency(data.currency || 'GHS');
        setQuantity(data.quantity !== undefined ? data.quantity.toString() : '0');
        setAvailabilityStatus(data.availability_status || 'available');
        setWarranty(data.warranty || '');
        setImageUrl(data.image_url || '');
      } catch (err: any) {
        setError(err.message || "Failed to load product data.");
      } finally {
        setLoading(false);
      }
    }
    loadProductData();
  }, [id, token]);

  const validateForm = () => {
    if (!name.trim()) {
      setError("Product Name is required.");
      return false;
    }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setError("Price must be a positive number.");
      return false;
    }
    const parsedQty = parseInt(quantity);
    if (isNaN(parsedQty) || parsedQty < 0) {
      setError("Quantity must be a positive integer.");
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
      await updateProduct(id, {
        name: name.trim(),
        category: category.trim(),
        description: description.trim(),
        price: parseFloat(price),
        currency: currency.trim(),
        quantity: parseInt(quantity),
        availability_status: availabilityStatus,
        warranty: warranty.trim(),
        image_url: imageUrl.trim()
      }, token);

      router.push('/dashboard/products');
    } catch (err: any) {
      setError(err.message || "Failed to update product.");
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
      <div className="flex items-center gap-3 border-b border-slate-800 pb-5">
        <button
          onClick={() => router.push('/dashboard/products')}
          className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/40 text-slate-400 hover:text-white"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="flex flex-col">
          <h2 className="text-2xl font-extrabold text-white">Edit Product</h2>
          <p className="text-xs text-slate-400 mt-1">Modify properties of product item.</p>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-3 text-xs text-rose-455 bg-rose-955/20 border border-rose-900/50 rounded-lg">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 md:p-8 rounded-2xl border border-slate-800/80 bg-slate-955/5 backdrop-blur-xl shadow-2xl flex flex-col gap-5">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Product Name */}
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-slate-450 uppercase tracking-wider">
              Product Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. HP EliteBook 840 G6"
              required
              className="px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-455 uppercase tracking-wider">
              Category
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Laptops, Accessories"
              className="px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          {/* Warranty */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-455 uppercase tracking-wider">
              Warranty
            </label>
            <input
              type="text"
              value={warranty}
              onChange={(e) => setWarranty(e.target.value)}
              placeholder="e.g. 3 months, 1 year"
              className="px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          {/* Price */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-455 uppercase tracking-wider">
              Price *
            </label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              required
              className="px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          {/* Currency */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-455 uppercase tracking-wider">
              Currency
            </label>
            <input
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="GHS"
              required
              className="px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          {/* Quantity */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-455 uppercase tracking-wider">
              Stock Quantity *
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              required
              className="px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          {/* Availability Status */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-455 uppercase tracking-wider">
              Availability Status
            </label>
            <select
              value={availabilityStatus}
              onChange={(e) => setAvailabilityStatus(e.target.value)}
              className="px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
            >
              <option value="available">Available</option>
              <option value="out_of_stock">Out of Stock</option>
              <option value="limited">Limited Stock</option>
            </select>
          </div>

          {/* Image URL */}
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-slate-455 uppercase tracking-wider">
              Image URL
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="http://example.com/image.png"
              className="px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-455 uppercase tracking-wider">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Intel Core i5, 8GB RAM, 256GB SSD storage, 14-inch screen"
            rows={4}
            className="px-4 py-3 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 transition resize-none"
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
