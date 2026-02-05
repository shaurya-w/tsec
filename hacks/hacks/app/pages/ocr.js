'use client';

import { useState } from 'react';

export default function ReceiptScanner() {
  const [file, setFile] = useState(null);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    try {
      const base64 = await toBase64(file);

      const res = await fetch('/api/extract-total', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: base64 }),
      });

      const data = await res.json();
      setTotal(data.total);
    } catch (err) {
      console.error('Extraction Error:', err);
      alert("Failed to extract total. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white w-full rounded-[40px] p-10 border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-all">
      <header className="mb-8">
        <h1 className="text-2xl font-black italic uppercase tracking-tighter leading-none mb-3">
          Receipt <span className="text-indigo-600">Scanner.</span>
        </h1>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
          Upload PDF invoice to auto-fill totals.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block relative cursor-pointer">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files[0])}
            className="hidden"
          />
          <div className={`
            border-2 border-dashed rounded-[25px] p-8 text-center transition-all
            ${file 
              ? 'border-indigo-600 bg-indigo-50/30' 
              : 'border-gray-100 bg-gray-50 hover:bg-white hover:border-indigo-200'}
          `}>
            <span className={`text-[10px] font-black uppercase tracking-widest ${file ? 'text-indigo-600' : 'text-gray-400'}`}>
              {file ? file.name : 'Select PDF Receipt'}
            </span>
          </div>
        </label>

        <button 
          disabled={loading || !file}
          className="w-full bg-black text-white py-4 rounded-[20px] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all disabled:opacity-20"
        >
          {loading ? 'Processing...' : 'Extract Amount'}
        </button>
      </form>

      {total && (
        <div className="mt-8 p-6 bg-indigo-600 rounded-[25px] text-white animate-in slide-in-from-bottom-2 duration-500">
          <p className="text-[8px] font-black uppercase tracking-[0.3em] opacity-70 mb-1">Detected</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tighter italic">₹{total}</span>
            <span className="text-[10px] font-bold opacity-80 uppercase tracking-widest">INR</span>
          </div>
        </div>
      )}
    </div>
  );
}