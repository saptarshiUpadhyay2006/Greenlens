'use client';
import React, { useState, useEffect } from "react";
import { products } from "../data/product.js";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft, User, Mail, Phone, Package, ListOrdered,
  MapPin, UploadCloud, FileText, CheckCircle, Trash2,
  Coins, Wallet, ReceiptText
} from "lucide-react";
import Footer from "../components/Footer.jsx";

const initialForm = {
  name: "",
  email: "",
  phone: "",
  address: "",
  productId: products[0]?.id ?? "",
  quantity: 1,
  notes: "",
  agree: false,
  fileDataUrl: null,
  fileName: "",
};

const validateEmail = (s) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).toLowerCase());

const SubmitPage = () => {
  const router = useRouter();
  const { getToken } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submittedId, setSubmittedId] = useState(null);
  const [burning, setBurning] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  // Fetch product details for dynamic preview
  const selectedProduct = products.find((p) => p.id === Number(form.productId)) || products[0];
  const totalCost = selectedProduct ? selectedProduct.price * form.quantity : 0;

  useEffect(() => {
    // Extract productId from URL if present
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const queryProductId = params.get("productId");
      if (queryProductId) {
        setForm((f) => ({ ...f, productId: Number(queryProductId) }));
      } else if (!form.productId && products.length) {
        setForm((f) => ({ ...f, productId: products[0].id }));
      }
    }

    loadSimulatedTokens();
  }, []);

  const loadSimulatedTokens = async () => {
    try {
      const token = await getToken();
      if (token) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'}/users/dashboard`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const resData = await response.json();
        if (resData.success && resData.data) {
          const balance = resData.data.totalGreenTokens;
          setWalletBalance(balance);
          if (typeof window !== 'undefined') {
            localStorage.setItem('simulatedTokens', balance.toString());
          }
          return;
        }
      }
    } catch (err) {
      console.warn("Backend offline or error fetching balance, falling back to local:", err);
    }

    if (typeof window !== 'undefined') {
      const simTokens = parseFloat(localStorage.getItem('simulatedTokens') || '0');
      setWalletBalance(simTokens);
    }
  };

  const burnTokens = async (val) => {
    setBurning(true);
    try {
      const token = await getToken();
      if (token) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'}/users/redeem`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: val,
            productId: selectedProduct?.id,
            productName: selectedProduct?.name
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.message || "insufficient");
        }

        const resData = await response.json();
        if (resData.success) {
          const updated = resData.data.newTotalTokens;
          if (typeof window !== 'undefined') {
            localStorage.setItem('simulatedTokens', updated.toString());
          }
          setWalletBalance(updated);
        }
      } else {
        if (typeof window !== 'undefined') {
          const currentSimulated = parseFloat(localStorage.getItem('simulatedTokens') || '0');
          if (currentSimulated < val) {
            throw new Error("insufficient");
          }
          const updated = currentSimulated - val;
          localStorage.setItem('simulatedTokens', updated.toString());
          setWalletBalance(updated);
        }
      }

      alert(`🔥 ${val} Green Tokens successfully redeemed & burned!`);
    } catch (error) {
      console.error("Error burning tokens:", error);
      let errorMsg = "Failed to burn tokens";
      if (error.message.includes("insufficient") || error.message.includes("Insufficient")) {
        errorMsg = "Insufficient token balance";
      } else {
        errorMsg = error.message;
      }
      alert(`❌ ${errorMsg}`);
      throw error;
    } finally {
      setBurning(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, fileDataUrl: reader.result, fileName: file.name }));
    };
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Name is a required field";
    if (!form.email.trim() || !validateEmail(form.email)) errs.email = "Valid email required";
    if (!form.agree) errs.agree = "You must confirm before submitting";
    if (!form.productId) errs.productId = "Select a product";
    if (!form.quantity || Number(form.quantity) <= 0) errs.quantity = "Quantity must be >= 1";
    return errs;
  };

  const saveSubmissionToLocal = (payload) => {
    try {
      const key = "greenlens_submissions";
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      existing.unshift(payload);
      localStorage.setItem(key, JSON.stringify(existing));
    } catch (err) {
      console.error("localStorage save failed", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setLoading(true);

    // Burn tokens first
    if (totalCost > 0) {
      try {
        await burnTokens(totalCost);
      } catch (error) {
        setLoading(false);
        return;
      }
    }

    await new Promise((r) => setTimeout(r, 700));

    const payload = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      ...form,
      product: selectedProduct,
      totalCost,
    };
    saveSubmissionToLocal(payload);

    setSubmittedId(payload.id);
    setLoading(false);

    // Keep selected product but reset personal details
    setForm((f) => ({
      ...initialForm,
      productId: f.productId,
      quantity: 1
    }));

    // Refresh submissions lists and balance
    loadSimulatedTokens();
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to reset the form?")) {
      setForm(initialForm);
      setErrors({});
      setSubmittedId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f3f9f6] via-[#eef7f2] to-[#e6f4f1] py-12 px-4 sm:px-6 lg:px-8 font-sans flex flex-col justify-between">
      <div className="max-w-7xl mx-auto flex-grow">

        {/* Navigation & Header */}
        <div className="flex justify-between items-center mb-10">
          <button
            onClick={() => router.push("/store")}
            className="group flex items-center gap-2 text-sm font-bold text-emerald-900 bg-white/60 hover:bg-white border border-white/80 hover:border-emerald-500/20 px-4 py-2.5 rounded-2xl shadow-sm hover:shadow transition-all duration-300"
          >
            <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" />
            Back to Store
          </button>
        </div>

        <div className="text-center max-w-2xl mx-auto mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-emerald-950 mb-3">
            Redeem Your Rewards
          </h1>
          <p className="text-sm sm:text-base text-emerald-900/70 font-semibold leading-relaxed">
            Confirm your shipment details and burn your Green Tokens to secure your sustainable goods.
          </p>
        </div>

        {/* Split Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start mb-12">

          {/* Left Column: Form (2/3 width) */}
          <div className="lg:col-span-2 bg-emerald-50/40 border border-emerald-500/20 rounded-[2rem] shadow-[0_20px_45px_rgba(11,61,46,0.04)] p-6 sm:p-10">
            <h2 className="text-xl font-extrabold text-emerald-950 mb-6 flex items-center gap-2">
              <span className="p-1.5 bg-emerald-100 rounded-xl text-emerald-700">
                <User className="w-5 h-5" />
              </span>
              Shipping & Burn Request Form
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {Object.keys(errors).length > 0 && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-xs sm:text-sm text-rose-800 font-semibold flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping" />
                  Please fix the validation errors before submitting.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Full Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider">Full Name *</label>
                  <div className="relative">
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      className={`input input-bordered w-full pl-10 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20 ${errors.name ? "border-rose-450 focus:border-rose-450" : ""}`}
                      placeholder="Rohit Sharma"
                    />
                    <User className="absolute left-3.5 top-3.5 w-4 h-4 text-emerald-900/50" />
                  </div>
                  {errors.name && <p className="text-xs text-rose-600 font-semibold mt-1">{errors.name}</p>}
                </div>

                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider">Email Address *</label>
                  <div className="relative">
                    <input
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      className={`input input-bordered w-full pl-10 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20 ${errors.email ? "border-rose-450 focus:border-rose-450" : ""}`}
                      placeholder="rohitsharma@example.com"
                      type="email"
                    />
                    <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-emerald-700/50" />
                  </div>
                  {errors.email && <p className="text-xs text-rose-600 font-semibold mt-1">{errors.email}</p>}
                </div>

                {/* Phone */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider">Phone Number</label>
                  <div className="relative">
                    <input
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      className="input input-bordered w-full pl-10 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20"
                      placeholder="+91 98765 43210"
                    />
                    <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-emerald-700/50" />
                  </div>
                </div>

                {/* Select Product */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider">Select Product *</label>
                  <div className="relative">
                    <select
                      name="productId"
                      value={form.productId}
                      onChange={handleChange}
                      className={`select select-bordered w-full pl-10 rounded-xl bg-white text-slate-900 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20 ${errors.productId ? "border-rose-450" : ""}`}
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id} className="text-slate-900 bg-white">
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <Package className="absolute left-3.5 top-3.5 w-4 h-4 text-emerald-700/50" />
                  </div>
                </div>

                {/* Quantity */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider">Quantity *</label>
                  <div className="relative">
                    <input
                      name="quantity"
                      type="number"
                      min="1"
                      value={form.quantity}
                      onChange={handleChange}
                      className={`input input-bordered w-full pl-10 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20 ${errors.quantity ? "border-rose-450" : ""}`}
                    />
                    <ListOrdered className="absolute left-3.5 top-3.5 w-4 h-4 text-emerald-700/50" />
                  </div>
                  {errors.quantity && <p className="text-xs text-rose-600 font-semibold mt-1">{errors.quantity}</p>}
                </div>
              </div>

              {/* Address */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider">Shipping Address</label>
                <div className="relative">
                  <textarea
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    className="textarea textarea-bordered w-full pl-10 pt-3.5 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20"
                    rows="3"
                    placeholder="House No., Street Name, City, State, ZIP..."
                  />
                  <MapPin className="absolute left-3.5 top-3.5 w-4 h-4 text-emerald-700/50" />
                </div>
              </div>

              {/* Upload Receipt */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider">Verification Document / ID (Optional)</label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 hover:border-emerald-500/40 rounded-2xl cursor-pointer bg-white hover:bg-slate-50/20 transition-colors duration-300">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <UploadCloud className="w-8 h-8 text-emerald-600/60 mb-2" />
                      <p className="text-xs text-slate-500 font-semibold">Click to upload (PDF, PNG, JPG)</p>
                    </div>
                    <input type="file" accept="image/*,.pdf" onChange={handleFile} className="hidden" />
                  </label>
                </div>
                {form.fileName && (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 p-2 rounded-xl text-xs font-semibold text-emerald-800">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    Uploaded: {form.fileName}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider">Special Notes (Optional)</label>
                <input
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="e.g. Leave package at door"
                  className="input input-bordered w-full rounded-xl bg-white text-slate-900 placeholder:text-slate-400 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20"
                />
              </div>

              {/* Checkbox confirmation */}
              <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200/50 p-4 rounded-2xl">
                <input
                  type="checkbox"
                  id="agree"
                  name="agree"
                  checked={form.agree}
                  onChange={handleChange}
                  className="checkbox checkbox-emerald rounded-lg border-2 border-emerald-600 checked:bg-emerald-600"
                />
                <label htmlFor="agree" className="text-xs sm:text-sm font-bold text-emerald-950">
                  I confirm that my details are correct and authorize GreenLens to redeem and burn {totalCost} GT from my balance. *
                </label>
              </div>
              {errors.agree && <p className="text-xs text-rose-600 font-semibold">{errors.agree}</p>}

              {/* Form Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading || burning}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-extrabold py-4 px-6 rounded-2xl shadow-md hover:shadow-[0_8px_25px_rgba(16,185,129,0.2)] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading || burning ? (
                    <>
                      <span className="loading loading-spinner loading-sm" />
                      Processing Eco Redemption...
                    </>
                  ) : (
                    <>
                      <Coins className="w-5 h-5" />
                      Burn Tokens & Request
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={loading || burning}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-4 rounded-2xl transition-all duration-300 disabled:opacity-50"
                >
                  Reset
                </button>
              </div>

              {submittedId && (
                <div className="p-4 bg-emerald-100 border border-emerald-200/50 text-emerald-800 font-bold rounded-2xl text-sm flex items-center gap-2 shadow-sm animate-bounce">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  Success! Request submitted (Transaction ID: {submittedId})
                </div>
              )}
            </form>
          </div>

          {/* Right Column: Order Preview Sidebar (1/3 width) */}
          <div className="bg-emerald-50/40 border border-emerald-500/20 rounded-[2rem] shadow-[0_20px_45px_rgba(11,61,46,0.04)] p-6 sm:p-8 flex flex-col gap-6">
            <h3 className="text-lg font-black text-emerald-950 flex items-center gap-2 pb-4 border-b border-slate-100">
              <ReceiptText className="w-5 h-5 text-emerald-600" />
              Order Summary
            </h3>

            {/* Selected Product Card Preview */}
            <div className="bg-white/90 border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
              <div className="aspect-video relative overflow-hidden bg-slate-50 border-b">
                <img
                  src={selectedProduct?.image}
                  alt={selectedProduct?.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                  NGO: {selectedProduct?.ngo}
                </span>
                <h4 className="text-base font-extrabold text-emerald-950 mt-2">
                  {selectedProduct?.name}
                </h4>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  {selectedProduct?.description}
                </p>
              </div>
            </div>

            {/* Checkout pricing details */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span>Reward Unit Price</span>
                <span className="text-emerald-950 font-extrabold">{selectedProduct?.price} GT</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span>Quantity Requested</span>
                <span className="text-emerald-950 font-extrabold">× {form.quantity}</span>
              </div>
              <div className="h-px bg-slate-100 my-2" />
              <div className="flex justify-between items-center">
                <span className="text-sm font-black text-emerald-950">Total Burn Cost</span>
                <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-700 to-teal-600">
                  {totalCost} GT
                </span>
              </div>
            </div>

            {/* Green Tokens balance status preview */}
            <div className="mt-4 border border-slate-100 bg-slate-50/50 p-4 rounded-2xl flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold text-emerald-950">Ecosystem Balance Status</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                  <span>Balance Type</span>
                  <span className="font-bold text-slate-700">ML Calculated Tokens</span>
                </div>
                <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                  <span>Available Balance</span>
                  <span className="font-extrabold text-emerald-700">{walletBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} GT</span>
                </div>
                {walletBalance < totalCost ? (
                  <p className="text-[10px] text-rose-600 font-bold bg-rose-50 p-1.5 rounded-lg border border-rose-100 mt-2">
                    ⚠️ Insufficient tokens to complete purchase.
                  </p>
                ) : (
                  <p className="text-[10px] text-emerald-700 font-bold bg-emerald-50 p-1.5 rounded-lg border border-emerald-100 mt-2">
                    ✓ Balance verified. Ready to redeem.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Submissions Section */}
        <div className="mt-12">
          <SubmissionsList />
        </div>
      </div>
      <Footer />
    </div>
  );
};

function SubmissionsList() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const loadSubmissions = () => {
      const key = "greenlens_submissions";
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      setItems(existing);
    };
    loadSubmissions();

    // Update items periodically or listen to custom storage updates
    window.addEventListener("storage", loadSubmissions);
    return () => window.removeEventListener("storage", loadSubmissions);
  }, []);

  const clearAll = () => {
    if (!confirm("Clear all saved redemption submissions?")) return;
    localStorage.removeItem("greenlens_submissions");
    setItems([]);
  };

  const deleteItem = (id) => {
    if (!confirm("Remove this transaction record?")) return;
    const key = "greenlens_submissions";
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    const updated = existing.filter((item) => item.id !== id);
    localStorage.setItem(key, JSON.stringify(updated));
    setItems(updated);
  };

  return (
    <div className="bg-emerald-50/40 border border-emerald-500/20 rounded-[2rem] shadow-[0_20px_45px_rgba(11,61,46,0.04)] p-6 sm:p-8">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-slate-100 rounded-xl text-slate-700">
            <ReceiptText className="w-5 h-5" />
          </span>
          <h3 className="text-lg font-black text-emerald-950">Redemption History Ledger</h3>
        </div>
        {items.length > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100/60 px-3.5 py-2 rounded-xl transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear History
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 bg-white/40 border border-dashed border-slate-200 rounded-2xl">
          <ReceiptText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-bold">No redemption requests submitted yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.map((s) => (
            <div
              key={s.id}
              className="bg-white border border-slate-100 p-5 rounded-2xl hover:border-emerald-500/20 hover:shadow-[0_10px_30px_rgba(27,94,32,0.02)] transition-all duration-300 relative group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-extrabold text-sm text-emerald-950">{s.name}</div>
                    <div className="text-xs text-slate-400 font-semibold mt-0.5">{s.email}</div>
                  </div>
                  <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full text-[10px] font-bold text-emerald-800">
                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                    Burn Confirmed
                  </span>
                </div>

                <div className="h-px bg-slate-100 my-4" />

                <div className="flex gap-4 items-center">
                  {s.product?.image && (
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-50 flex-shrink-0 border">
                      <img src={s.product.image} alt={s.product.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Product Purchased</div>
                    <div className="text-sm font-extrabold text-emerald-950 mt-0.5">
                      {s.product?.name} <span className="text-slate-500 font-semibold">({s.quantity}x)</span>
                    </div>
                    {s.totalCost && (
                      <div className="flex items-center gap-1 mt-1 text-emerald-700 font-black text-sm">
                        <Coins className="w-3.5 h-3.5" />
                        -{s.totalCost} GT
                      </div>
                    )}
                  </div>
                </div>

                {s.fileDataUrl && (
                  <div className="mt-4 border rounded-xl p-2 bg-slate-50 flex gap-2 items-center">
                    <img src={s.fileDataUrl} alt="upload preview" className="w-10 h-10 rounded-md object-cover border bg-white" />
                    <div className="text-[10px] font-bold text-slate-500 truncate max-w-[200px]">
                      {s.fileName}
                    </div>
                  </div>
                )}

                {s.notes && (
                  <div className="mt-3 text-xs text-slate-500 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    Note: &quot;{s.notes}&quot;
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center mt-5 pt-3 border-t border-slate-100/80">
                <span className="text-[10px] font-semibold text-slate-400">
                  {new Date(s.createdAt).toLocaleString()}
                </span>
                <button
                  onClick={() => deleteItem(s.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                  title="Remove item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SubmitPage;