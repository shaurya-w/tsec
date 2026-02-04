"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import BluePollComponent from "../../components/PollComponent";

export default function UnifiedDashboard() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // UI State
  const [pollVisible, setPollVisible] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedUser, setExpandedUser] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  
  // ✅ New State for Audit Log Dropdown
  const [expandedLogId, setExpandedLogId] = useState(null);

  // Settlement State
  const [isSettling, setIsSettling] = useState(false);
  const [settlementPlan, setSettlementPlan] = useState([]);
  const [vendorAmount, setVendorAmount] = useState("");
  const [vendorCategory, setVendorCategory] = useState(""); 

  // Hardcoded for demo
  const currentUserId = "u3";

  // State for Processing
  const [processing, setProcessing] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("Idle");
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [users, setUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [eventName, setEventName] = useState("");
  const [expenseCategories, setExpenseCategories] = useState([{ name: "", spendingLimit: "" }]);

  const showPoll = () => setPollVisible(true);

  // --- HELPER: CALCULATE INDIVIDUAL SHARE ---
  const getEstimatedShare = (userId, eventContext) => {
    if (!eventContext?.categories) return "0.00";
    const total = eventContext.categories.reduce((acc, cat) => {
      const members = cat.members || [];
      const isMember = members.some((m) => m.userId === userId);
      if (isMember) {
        const count = members.length || 1;
        const limit = Number(cat.spendingLimit || 0);
        return acc + limit / count;
      }
      return acc;
    }, 0);
    return total.toFixed(2);
  };

  // --- DATA LOADING ---
  const loadEvents = async (targetEventId = null) => {
    try {
      if (!selectedEvent && !targetEventId) setLoading(true);
      const res = await fetch("/api/events", { cache: "no-store" });
      const data = await res.json();
      const eventsArray = Array.isArray(data) ? data : [];
      setEvents(eventsArray);

      const idToRefresh = targetEventId || selectedEvent?.id;
      if (idToRefresh) {
        const updated = eventsArray.find((e) => e.id === idToRefresh);
        if (updated) setSelectedEvent(updated);
      }
    } catch (err) {
      console.error("Load Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async (eventId) => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/events/${eventId}/audit`);
      const data = await res.json();
      setAuditLogs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Audit load error", e);
      setAuditLogs([]);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [refreshKey]);

  // --- SETTLEMENT LOGIC ---
  const fetchSettlementPlan = async () => {
    if (!selectedEvent) return;
    try {
      const res = await fetch(`/api/events/${selectedEvent.id}/settlement`);
      if (!res.ok) throw new Error("Failed to fetch settlement");
      const data = await res.json();
      setSettlementPlan(data.settlementPlan || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePayVendor = async () => {
    if (!vendorAmount) return alert("Enter vendor amount");
    if (!vendorCategory) return alert("Select a basket to pay from");

    setPaymentStatus("Paying Vendor...");
    await fetch(`/api/events/${selectedEvent.id}/settlement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
          type: "VENDOR", 
          amount: vendorAmount,
          categoryId: vendorCategory 
      }),
    });

    setPaymentStatus("Vendor Paid ✅");
    setTimeout(() => setPaymentStatus("Idle"), 2000);
    await loadAuditLogs(selectedEvent.id);
    await loadEvents(selectedEvent.id);
    fetchSettlementPlan();
  };

  const handleProcessRefunds = async () => {
    if (!confirm("Confirm issuing refunds to original payment methods?")) return;

    setPaymentStatus("Processing Refunds...");
    await fetch(`/api/events/${selectedEvent.id}/settlement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "REFUND" }),
    });

    setPaymentStatus("Refunds Sent ✅");
    setTimeout(() => setPaymentStatus("Idle"), 2000);
    await loadAuditLogs(selectedEvent.id);
    setIsSettling(false);
  };

  // --- ACTIONS ---
  const handleSelectEvent = (evt) => {
    setAuditLogs([]);
    setSelectedEvent(evt);
    loadAuditLogs(evt.id);
    setIsSettling(false);
  };

  const handleOptToggle = async (userId, categoryId, isCurrentlyJoined) => {
    setProcessing(`${userId}-${categoryId}-toggle`);
    try {
      await fetch("/api/categories/opt-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          categoryId,
          action: isCurrentlyJoined ? "LEAVE" : "JOIN",
        }),
      });
      await loadEvents(selectedEvent?.id);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(null);
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;
    if (!confirm("Are you sure you want to permanently delete this event?")) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/events/${selectedEvent.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== selectedEvent.id));
        setSelectedEvent(null);
      } else {
        alert("Failed to delete event.");
      }
    } catch (e) {
      console.error("Delete failed", e);
    } finally {
      setIsDeleting(false);
    }
  };

  // --- PAYMENT PIPELINE ---
  const pollIntent = (intentId, currentEventId) => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/intent/${intentId}`);
      const data = await res.json();

      if (data.status === "PROCESSING") {
        clearInterval(interval);
        finalizePayment(intentId, currentEventId);
      }
    }, 3000);
  };

  const finalizePayment = async (intentId, currentEventId) => {
    setPaymentStatus("Verifying Proof...");
    await fetch(`/api/pipeline/${intentId}`, { method: "POST" });
    setPaymentStatus("✅ Paid & Verified!");

    await loadAuditLogs(currentEventId);
    await loadEvents(currentEventId);

    setTimeout(() => setPaymentStatus("Idle"), 3000);
  };

  const handleTotalPay = async (userId, totalAmount) => {
    if (totalAmount <= 0) return alert("Nothing to pay.");
    setPaymentStatus("Initiating...");

    try {
      const res = await fetch("/api/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: totalAmount,
          userId: userId,
          eventId: selectedEvent.id,
        }),
      });

      const data = await res.json();
      window.open(data.paymentUrl, "_blank");

      setPaymentStatus("Waiting for Bank...");
      pollIntent(data.intentId, selectedEvent.id);
    } catch (e) {
      console.error(e);
      setPaymentStatus("Error");
    }
  };

  // --- CREATE EVENT ---
  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/create-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: eventName,
          groupId: "g1",
          selectedUserIds,
          categories: expenseCategories.filter((c) => c.name.trim() !== ""),
        }),
      });

      if (res.ok) {
        setIsCreatingEvent(false);
        setEventName("");
        setSelectedUserIds([]);
        setExpenseCategories([{ name: "", spendingLimit: "" }]);
        loadEvents();
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isCreatingEvent) {
      fetch("/api/groups/users")
        .then((r) => r.json())
        .then((d) => setUsers(d.users || []));
    }
  }, [isCreatingEvent]);

  // --- VIEW RENDER ---
  if (selectedEvent) {
    const dbTotalPooled = Number(selectedEvent.totalPooled || 0);
    const calcTotalPooled = selectedEvent.categories?.reduce((acc, cat) => acc + Number(cat.totalPooled || 0), 0);
    const realTotalPooled = Math.max(dbTotalPooled, calcTotalPooled);

    const totalGoal = selectedEvent.categories?.reduce((acc, cat) => acc + Number(cat.spendingLimit || 0), 0);
    const globalProgress = totalGoal > 0 ? (realTotalPooled / totalGoal) * 100 : 0;

    return (
      <div className="min-h-screen bg-white p-10 text-gray-900 animate-in fade-in duration-300">
        
        {/* HEADER & ACTIONS */}
        <div className="flex justify-between items-center mb-8">
          <button onClick={() => setSelectedEvent(null)} className="font-black text-xs text-indigo-600 hover:underline tracking-widest">
            ← BACK TO FEED
          </button>
          <div className="flex gap-4">
            {!isSettling && (
              <button
                onClick={() => {
                  setIsSettling(true);
                  fetchSettlementPlan();
                }}
                className="bg-black text-white font-bold text-[10px] uppercase tracking-widest px-6 py-2 rounded-lg hover:bg-gray-800 transition-all"
              >
                Settlement Mode
              </button>
            )}
            <button
              onClick={handleDeleteEvent}
              disabled={isDeleting}
              className="text-red-500 font-bold text-[10px] uppercase tracking-widest hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded-lg transition-all disabled:opacity-50"
            >
              {isDeleting ? "DELETING..." : "DELETE EVENT"}
            </button>
          </div>
        </div>

        {/* === SETTLEMENT MODE === */}
        {isSettling ? (
          <div className="max-w-4xl mx-auto bg-gray-50 p-10 rounded-[40px] animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-10">
              <h1 className="text-3xl font-black uppercase italic">Final Settlement</h1>
              <button onClick={() => setIsSettling(false)} className="text-gray-400 font-bold">
                CLOSE
              </button>
            </div>

            {/* 1. PAY VENDOR */}
            <div className="bg-white p-8 rounded-[30px] shadow-sm mb-8">
              <h2 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-4">Step 1: Pay Vendor</h2>
              <div className="flex flex-col gap-4">
                
                {/* SELECT BASKET */}
                <select 
                    className="bg-gray-100 p-4 rounded-xl font-bold text-sm outline-none"
                    value={vendorCategory}
                    onChange={(e) => setVendorCategory(e.target.value)}
                >
                    <option value="">Select Basket to Pay From...</option>
                    {selectedEvent.categories?.map(cat => (
                        <option key={cat.id} value={cat.id}>
                            {cat.name} (Available: ${Number(cat.totalPooled).toFixed(2)})
                        </option>
                    ))}
                </select>

                <div className="flex gap-4">
                  <input
                    type="number"
                    placeholder="Total Bill Amount..."
                    className="flex-1 bg-gray-100 p-4 rounded-xl font-bold text-xl outline-none"
                    value={vendorAmount}
                    onChange={(e) => setVendorAmount(e.target.value)}
                  />
                  <button
                    onClick={handlePayVendor}
                    className="bg-black text-white px-8 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-600 transition-colors"
                  >
                    {paymentStatus !== "Idle" ? paymentStatus : "Pay Vendor"}
                  </button>
                </div>
              </div>
            </div>

            {/* 2. REFUNDS */}
            <div className="bg-white p-8 rounded-[30px] shadow-sm">
              <h2 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-6">Step 2: Refund Distribution</h2>
              <div className="space-y-3 mb-8">
                {settlementPlan.length === 0 && <div className="text-gray-400 italic">No refund data. Pay vendor to update balance.</div>}
                {settlementPlan.map((r, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b border-gray-100 pb-3">
                    <span className="font-bold">{r.userName}</span>
                    <div className="text-right">
                      <span className="text-xs text-gray-400 block">Contributed: ${r.contributed.toFixed(2)}</span>
                      <span className={`font-black ${r.balance > 0 ? "text-green-500" : "text-gray-400"}`}>
                        {r.balance > 0 ? `REFUND: $${r.balance}` : "SETTLED"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={handleProcessRefunds}
                className="w-full bg-green-500 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-green-600 transition-colors shadow-xl shadow-green-100"
              >
                Execute Refunds
              </button>
            </div>
          </div>
        ) : (
          // === NORMAL EVENT VIEW ===
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 max-w-7xl mx-auto items-start">
            
            {/* LEFT COLUMN: Sticky Info */}
            <div className="lg:col-span-5 border-r border-gray-100 pr-12 sticky top-10 h-fit">
              <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none mb-12">{selectedEvent.name}</h1>

              <div className="mb-12">
                <div className="flex justify-between items-end mb-4">
                  <h2 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em]">Collective Pool</h2>
                  <span className="text-5xl font-black text-indigo-600 tracking-tighter">{Math.round(globalProgress)}%</span>
                </div>
                <div className="w-full bg-gray-100 h-12 rounded-full overflow-hidden border-4 border-white shadow-xl">
                  <div className="bg-indigo-600 h-full transition-all duration-700 ease-out" style={{ width: `${Math.min(globalProgress, 100)}%` }} />
                </div>
                <div className="mt-6 flex justify-between font-black uppercase text-[10px] tracking-widest text-gray-400">
                  <span>Raised: ${realTotalPooled.toFixed(2)}</span>
                  <span>Goal: ${totalGoal}</span>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em] mb-4">Baskets Overview</h2>
                {selectedEvent.categories?.map((cat) => (
                  <div key={cat.id} className="p-6 bg-gray-50 rounded-[30px] flex justify-between items-center border border-gray-100">
                    <div>
                      <span className="font-black text-lg uppercase tracking-tight block">{cat.name}</span>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{cat.members?.length || 0} Contributors</span>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-indigo-600 text-xl">${Number(cat.totalPooled).toFixed(2)}</p>
                      <p className="text-[10px] font-bold text-gray-400">TARGET: ${cat.spendingLimit}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT COLUMN: Controls & Audit */}
            <div className="lg:col-span-7 flex flex-col gap-16">
              
              {/* Participant Controls */}
              <div>
                <h2 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em] mb-10">Manage Participants</h2>
                <div className="space-y-4">
                  {selectedEvent.participants?.map((p) => {
                    const myCut = getEstimatedShare(p.userId, selectedEvent);
                    
                    const paidAmount = auditLogs
                      .filter((log) => log.user?.id === p.userId || log.userId === p.userId)
                      .filter((log) => log.amount > 0)
                      .reduce((sum, log) => sum + Number(log.amount), 0);
                    
                    const isPaid = paidAmount >= Number(myCut) - 0.1;

                    return (
                      <div key={p.id} className={`border rounded-[40px] overflow-hidden shadow-sm transition-all hover:shadow-md ${isPaid ? "border-green-200 bg-green-50/30" : "border-gray-100"}`}>
                        <div
                          onClick={() => setExpandedUser(expandedUser === p.userId ? null : p.userId)}
                          className={`p-8 flex justify-between items-center cursor-pointer transition-colors ${expandedUser === p.userId ? "bg-indigo-600 text-white" : "hover:bg-gray-50"}`}
                        >
                          <div className="flex items-center gap-6">
                            <div className={`w-14 h-10 rounded-full flex items-center justify-center font-black text-xl border-2 ${expandedUser === p.userId ? "bg-white text-indigo-600 border-white" : "bg-indigo-50 text-indigo-600 border-indigo-100"}`}>
                              {p.user?.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="text-xl font-black uppercase tracking-tighter block">{p.user?.name}</span>
                              <span className={`text-[10px] font-bold uppercase tracking-widest ${expandedUser === p.userId ? "text-indigo-200" : "text-gray-400"}`}>
                                {isPaid ? <span className="text-green-500 font-black">SETTLED ✅</span> : `Est. Cut: $${myCut}`}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em]">{expandedUser === p.userId ? "CLOSE" : "MANAGE"}</span>
                        </div>
                        {expandedUser === p.userId && (
                          <div className="p-8 bg-white space-y-6 border-t border-gray-100 animate-in slide-in-from-top-4">
                            {selectedEvent.categories?.map((cat) => {
                              const isJoined = cat.members?.some((m) => m.userId === p.userId);
                              const isToggleProcessing = processing === `${p.userId}-${cat.id}-toggle`;
                              const catCost = Number(cat.spendingLimit) / (cat.members?.length || 1);
                              return (
                                <div key={cat.id} className="bg-white p-6 rounded-[25px] border border-gray-100 shadow-sm flex justify-between items-center">
                                  <div>
                                    <span className="text-xs font-black uppercase text-gray-400 mb-1 block">Basket</span>
                                    <span className="text-xl font-black uppercase">{cat.name}</span>
                                    {isJoined && <span className="block text-[10px] font-bold text-indigo-500 mt-1">COST: ${catCost.toFixed(2)}</span>}
                                  </div>
                                  <button
                                    onClick={() => handleOptToggle(p.userId, cat.id, isJoined)}
                                    disabled={isToggleProcessing || isPaid}
                                    className={`px-6 py-2 rounded-xl font-black text-[10px] tracking-widest ${isJoined ? "text-red-600 border border-red-100" : "text-green-600 border border-green-100"}`}
                                  >
                                    {isToggleProcessing ? "..." : isJoined ? "LEAVE" : "JOIN"}
                                  </button>
                                </div>
                              );
                            })}
                            <div className="mt-8 pt-8 border-t border-gray-200">
                              <div className="flex justify-between items-end mb-4">
                                <span className="text-xs font-black uppercase text-gray-400">Total Share</span>
                                <span className="text-4xl font-black text-indigo-900">${myCut}</span>
                              </div>
                              {isPaid ? (
                                <div className="w-full bg-green-100 text-green-700 py-5 rounded-[22px] font-black text-sm text-center shadow-inner">ALL SETTLED ✅</div>
                              ) : (
                                <button
                                  onClick={() => handleTotalPay(p.userId, myCut)}
                                  className="w-full bg-black text-white py-5 rounded-[22px] font-black text-sm uppercase hover:bg-indigo-600 transition-all"
                                >
                                  {paymentStatus !== "Idle" ? paymentStatus : `Pay Total $${myCut} via Finternet`}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ✅ AUDIT TRAIL with JSON DROPDOWN */}
              <div className="border-t border-gray-100 pt-10 pb-20">
                <h2 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em] mb-6">Immutable Audit Trail</h2>
                <div className="bg-gray-50 rounded-[30px] p-8 space-y-4">
                  {auditLogs.length === 0 ? (
                    <div className="text-gray-400 italic font-bold text-center">No transactions recorded on-chain yet.</div>
                  ) : (
                    auditLogs.map((log) => (
                      <div key={log.id} className="rounded-2xl shadow-sm border border-gray-100 bg-white overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                        {/* Header (Clickable) */}
                        <div 
                            onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                            className="flex justify-between items-center p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg ${log.amount < 0 ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}>
                              {log.amount < 0 ? "←" : "✓"}
                            </div>
                            <div>
                              <span className="block font-black uppercase text-sm">
                                {log.userId === "VENDOR" ? <span className="text-indigo-600">🏢 VENDOR PAYMENT</span> : `${log.user?.name || "User"} contributed`}
                              </span>
                              <span className="block text-[10px] text-gray-400 font-mono mt-1">
                                PROOF: {log.transactionRef ? `${log.transactionRef.slice(0, 15)}...` : "Pending..."} <span className="ml-2 text-[8px] text-gray-300">▼ DETAILS</span>
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`block font-black text-xl ${log.amount < 0 ? "text-red-500" : "text-green-600"}`}>
                              {log.amount > 0 ? "+" : ""}${Number(log.amount).toFixed(2)}
                            </span>
                            <span className="block text-[10px] text-gray-400">{new Date(log.createdAt).toLocaleString()}</span>
                          </div>
                        </div>

                        {/* JSON Body */}
                        {expandedLogId === log.id && (
                            <div className="bg-gray-50 p-6 border-t border-gray-100">
                                <h4 className="text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">Raw Ledger Data</h4>
                                <pre className="text-[10px] font-mono text-gray-600 whitespace-pre-wrap break-all bg-gray-100 p-4 rounded-xl">
                                    {JSON.stringify(log, null, 2)}
                                </pre>
                            </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === CREATE MODAL === */}
        {isCreatingEvent && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-50 flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-2xl rounded-[60px] p-12 shadow-2xl overflow-y-auto max-h-[90vh]">
              <h2 className="text-5xl font-black italic mb-10 tracking-tighter uppercase">New Basket.</h2>
              <form onSubmit={handleFinalSubmit} className="space-y-8">
                <input
                  className="w-full text-3xl font-black border-b-4 border-gray-100 outline-none focus:border-indigo-600 pb-4 transition-colors bg-transparent"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  required
                  placeholder="Event Name"
                />
                <div className="space-y-3">
                  {expenseCategories.map((cat, idx) => (
                    <div key={idx} className="flex gap-3">
                      <input
                        placeholder="Category"
                        className="flex-1 bg-gray-50 p-5 rounded-[22px] font-bold outline-none"
                        value={cat.name}
                        onChange={(e) => {
                          const n = [...expenseCategories];
                          n[idx].name = e.target.value;
                          setExpenseCategories(n);
                        }}
                      />
                      <input
                        placeholder="$"
                        type="number"
                        className="w-32 bg-gray-50 p-5 rounded-[22px] font-bold outline-none"
                        value={cat.spendingLimit}
                        onChange={(e) => {
                          const n = [...expenseCategories];
                          n[idx].spendingLimit = e.target.value;
                          setExpenseCategories(n);
                        }}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setExpenseCategories([...expenseCategories, { name: "", spendingLimit: "" }])}
                    className="text-indigo-600 font-black text-[10px] uppercase tracking-widest bg-indigo-50 px-6 py-2 rounded-full"
                  >
                    + Add Item
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => setSelectedUserIds((prev) => (prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]))}
                      className={`p-5 rounded-[22px] border-2 cursor-pointer transition-all flex items-center gap-4 ${selectedUserIds.includes(u.id) ? "border-indigo-600 bg-indigo-50" : "border-gray-50 bg-gray-50"}`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 ${selectedUserIds.includes(u.id) ? "bg-indigo-600 border-indigo-600" : "bg-transparent border-gray-300"}`} />
                      <span className="font-bold text-sm">{u.name}</span>
                    </div>
                  ))}
                </div>
                <button type="submit" className="w-full bg-indigo-600 text-white py-6 rounded-[30px] font-black text-xl shadow-xl shadow-indigo-100">
                  DEPLOY
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- MAIN FEED VIEW ---
  return (
    <div className="min-h-screen bg-gray-50 p-10 text-gray-900">
      <header className="flex justify-between items-center mb-16">
        
        <h1 className="text-6xl font-black text-indigo-600 italic tracking-tighter leading-none">COOPER.</h1>
        <div className="flex gap-4">
          <button className="bg-white border-2 border-indigo-600 text-indigo-600 font-black px-6 py-3 rounded-xl hover:bg-indigo-50 transition-colors" onClick={() => setIsCreatingEvent(true)}>
            + Create Event
          </button>
          <button className="bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors" onClick={showPoll}>
            View Recent Polls
          </button>
        </div>
      </header>

      {pollVisible && (
        <div className="my-8 animate-in slide-in-from-top-4 duration-500">
          <BluePollComponent onEventCreated={() => setRefreshKey((prev) => prev + 1)} />
        </div>
      )}

      <h2 className="text-[20px] font-black uppercase text-gray-400 tracking-[0.3em] my-6">Your Events</h2>

      {loading && !selectedEvent ? (
        <div className="py-40 text-center font-black text-gray-200 italic animate-pulse text-4xl uppercase tracking-tighter">Syncing...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {events.map((event) => {
            const totalGoal = event.categories?.reduce((acc, cat) => acc + Number(cat.spendingLimit || 0), 0);
            const progress = totalGoal > 0 ? (Number(event.totalPooled || 0) / totalGoal) * 100 : 0;
            const myShare = getEstimatedShare(currentUserId, event);

            return (
              <div
                key={event.id}
                onClick={() => handleSelectEvent(event)}
                className="bg-white p-10 rounded-[50px] shadow-sm hover:shadow-2xl transition-all cursor-pointer flex flex-col group border border-transparent hover:border-indigo-100"
              >
                <div className="flex justify-between items-start mb-8">
                  <h3 className="text-3xl font-black group-hover:text-indigo-600 transition-colors uppercase italic tracking-tighter">{event.name}</h3>
                  <div className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-black">OWE: ${myShare}</div>
                </div>
                <div className="mb-2">
                  <div className="flex justify-between text-[10px] font-black uppercase text-gray-400 mb-2">
                    <span>Collective Pool</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                    <div className="bg-indigo-600 h-full" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <div className="mt-auto pt-8 border-t border-gray-50 flex items-center justify-between">
                  <div className="flex -space-x-3">
                    {event.participants?.map((p) => (
                      <div key={p.id} className="w-10 h-10 rounded-full bg-gray-900 border-4 border-white flex items-center justify-center text-[8px] font-black text-white uppercase">
                        {p.user?.name?.charAt(0)}
                      </div>
                    ))}
                  </div>
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">View Details →</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* RE-USING CREATE MODAL FROM ABOVE FOR MAIN FEED ACCESS */}
      {isCreatingEvent && !selectedEvent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-2xl rounded-[60px] p-12 shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-5xl font-black italic mb-10 tracking-tighter uppercase">New Basket.</h2>
            <form onSubmit={handleFinalSubmit} className="space-y-8">
              <input
                className="w-full text-3xl font-black border-b-4 border-gray-100 outline-none focus:border-indigo-600 pb-4 transition-colors bg-transparent"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                required
                placeholder="Event Name"
              />
              <div className="space-y-3">
                {expenseCategories.map((cat, idx) => (
                  <div key={idx} className="flex gap-3">
                    <input
                      placeholder="Category"
                      className="flex-1 bg-gray-50 p-5 rounded-[22px] font-bold outline-none"
                      value={cat.name}
                      onChange={(e) => {
                        const n = [...expenseCategories];
                        n[idx].name = e.target.value;
                        setExpenseCategories(n);
                      }}
                    />
                    <input
                      placeholder="$"
                      type="number"
                      className="w-32 bg-gray-50 p-5 rounded-[22px] font-bold outline-none"
                      value={cat.spendingLimit}
                      onChange={(e) => {
                        const n = [...expenseCategories];
                        n[idx].spendingLimit = e.target.value;
                        setExpenseCategories(n);
                      }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setExpenseCategories([...expenseCategories, { name: "", spendingLimit: "" }])}
                  className="text-indigo-600 font-black text-[10px] uppercase tracking-widest bg-indigo-50 px-6 py-2 rounded-full"
                >
                  + Add Item
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {users.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => setSelectedUserIds((prev) => (prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]))}
                    className={`p-5 rounded-[22px] border-2 cursor-pointer transition-all flex items-center gap-4 ${selectedUserIds.includes(u.id) ? "border-indigo-600 bg-indigo-50" : "border-gray-50 bg-gray-50"}`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 ${selectedUserIds.includes(u.id) ? "bg-indigo-600 border-indigo-600" : "bg-transparent border-gray-300"}`} />
                    <span className="font-bold text-sm">{u.name}</span>
                  </div>
                ))}
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white py-6 rounded-[30px] font-black text-xl shadow-xl shadow-indigo-100">
                DEPLOY
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}