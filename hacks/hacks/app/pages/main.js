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

  // Hardcoded for demo - in real app comes from session
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

  const showPoll = () => {
    setPollVisible(true);
  };

  // --- HELPER: CALCULATE INDIVIDUAL SHARE ---
  const getEstimatedShare = (userId, eventContext) => {
    if (!eventContext?.categories) return "0.00";

    const total = eventContext.categories.reduce((acc, cat) => {
      const members = cat.members || [];
      const isMember = members.some(m => m.userId === userId);
      
      if (isMember) {
        const count = members.length || 1; 
        const limit = Number(cat.spendingLimit || 0);
        return acc + (limit / count);
      }
      return acc;
    }, 0);

    return total.toFixed(2);
  };

  // --- DATA LOADING ---
  const loadEvents = async () => {
    try {
      if (!selectedEvent) setLoading(true); 
      const res = await fetch("/api/events", { cache: 'no-store' });
      const data = await res.json();
      const eventsArray = Array.isArray(data) ? data : [];
      setEvents(eventsArray);

      if (selectedEvent) {
        const updated = eventsArray.find(e => e.id === selectedEvent.id);
        if (updated) setSelectedEvent(updated);
      }
    } catch (err) {
      console.error("Load Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async (eventId) => {
    try {
        const res = await fetch(`/api/events/${eventId}/audit`);
        const data = await res.json();
        setAuditLogs(Array.isArray(data) ? data : []);
    } catch (e) {
        console.error("Audit load error", e);
        setAuditLogs([]);
    }
  };

  useEffect(() => { loadEvents(); }, [refreshKey]); 

  // --- ACTIONS ---

  const handleSelectEvent = (evt) => {
      setAuditLogs([]); 
      setSelectedEvent(evt);
      loadAuditLogs(evt.id);
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
          action: isCurrentlyJoined ? "LEAVE" : "JOIN"
        }),
      });
      await loadEvents(); 
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(null); 
    }
  };

  // --- DELETE EVENT LOGIC ---
  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;
    if (!confirm("Are you sure you want to permanently delete this event? This cannot be undone.")) return;

    setIsDeleting(true);
    try {
        const res = await fetch(`/api/events/${selectedEvent.id}`, {
            method: "DELETE"
        });

        if (res.ok) {
            setEvents(prev => prev.filter(e => e.id !== selectedEvent.id));
            setSelectedEvent(null);
        } else {
            alert("Failed to delete event. Please try again.");
        }
    } catch (e) {
        console.error("Delete failed", e);
        alert("An error occurred while deleting.");
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
    await loadEvents(); 
    
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
                eventId: selectedEvent.id 
            }) 
        });
        
        const data = await res.json();
        
        console.log("Sending Payment:", { userId, eventId: selectedEvent?.id, amount: totalAmount });
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
          categories: expenseCategories.filter(c => c.name.trim() !== ""),
        }),
      });

      if (res.ok) {
        setIsCreatingEvent(false);
        setEventName("");
        setSelectedUserIds([]);
        setExpenseCategories([{ name: "", spendingLimit: "" }]);
        loadEvents();
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (isCreatingEvent) {
      fetch("/api/groups/users").then(r => r.json()).then(d => setUsers(d.users || []));
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
        
        {/* EVENT OVERLAY HEADER */}
        <div className="flex justify-between items-center mb-8">
            <button onClick={() => setSelectedEvent(null)} className="font-black text-xs text-indigo-600 hover:underline tracking-widest">
            ← BACK TO FEED
            </button>
            
            <button 
                onClick={handleDeleteEvent} 
                disabled={isDeleting}
                className="text-red-500 font-bold text-[10px] uppercase tracking-widest hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded-lg transition-all disabled:opacity-50"
            >
                {isDeleting ? "DELETING..." : "DELETE EVENT"}
            </button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 max-w-7xl mx-auto items-start">
          
          {/* LEFT: COLLECTIVE HEALTH (Sticky) */}
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
              {selectedEvent.categories?.map(cat => {
                 const memberCount = cat.members?.length || 0;
                 return (
                  <div key={cat.id} className="p-6 bg-gray-50 rounded-[30px] flex justify-between items-center border border-gray-100">
                      <div>
                        <span className="font-black text-lg uppercase tracking-tight block">{cat.name}</span>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{memberCount} Contributors</span>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-indigo-600 text-xl">${Number(cat.totalPooled).toFixed(2)}</p>
                        <p className="text-[10px] font-bold text-gray-400">TARGET: ${cat.spendingLimit}</p>
                      </div>
                  </div>
                 );
              })}
            </div>
          </div>

          {/* RIGHT: SCROLLABLE CONTENT WRAPPER (Controls + Audit) */}
          <div className="lg:col-span-7 flex flex-col gap-16">
            
            {/* 1. PARTICIPANT CONTROLS */}
            <div>
              <h2 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em] mb-10">Manage Participants & Cuts</h2>
              <div className="space-y-4">
                {selectedEvent.participants?.map((p) => {
                  const myCut = getEstimatedShare(p.userId, selectedEvent);
                  const paidAmount = auditLogs
                      .filter(log => log.user?.id === p.userId || log.userId === p.userId)
                      .reduce((sum, log) => sum + Number(log.amount), 0);
                  const isPaid = paidAmount >= (Number(myCut) - 0.1); 

                  return (
                    <div key={p.id} className={`border rounded-[40px] overflow-hidden shadow-sm transition-all hover:shadow-md ${isPaid ? 'border-green-200 bg-green-50/30' : 'border-gray-100'}`}>
                      
                      {/* USER HEADER */}
                      <div 
                        onClick={() => setExpandedUser(expandedUser === p.userId ? null : p.userId)}
                        className={`p-8 flex justify-between items-center cursor-pointer transition-colors ${expandedUser === p.userId ? 'bg-indigo-600 text-white' : 'hover:bg-gray-50'}`}
                      >
                        <div className="flex items-center gap-6">
                          <div className={`w-14 h-10 rounded-full flex items-center justify-center font-black text-xl border-2 ${expandedUser === p.userId ? 'bg-white text-indigo-600 border-white' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                            {p.user?.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                              <span className="text-xl font-black uppercase tracking-tighter block">{p.user?.name}</span>
                              <span className={`text-[10px] font-bold uppercase tracking-widest ${expandedUser === p.userId ? 'text-indigo-200' : 'text-gray-400'}`}>
                                  {isPaid ? <span className="text-green-500 font-black">SETTLED ✅</span> : `Est. Cut: $${myCut}`}
                              </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">{expandedUser === p.userId ? "CLOSE" : "MANAGE"}</span>
                      </div>

                      {/* ACTION PANEL */}
                      {expandedUser === p.userId && (
                        <div className="p-8 bg-white space-y-6 border-t border-gray-100 animate-in slide-in-from-top-4 duration-300">
                          
                          {/* BASKET TOGGLES */}
                          {selectedEvent.categories?.map(cat => {
                            const isJoined = cat.members && Array.isArray(cat.members) 
                              ? cat.members.some(m => m.userId === p.userId) 
                              : false;
                            
                            const isToggleProcessing = processing === `${p.userId}-${cat.id}-toggle`;
                            const catCost = Number(cat.spendingLimit) / (cat.members?.length || 1);

                            return (
                              <div key={cat.id} className="bg-white p-6 rounded-[25px] border border-gray-100 shadow-sm flex justify-between items-center">
                                <div>
                                  <span className="text-xs font-black uppercase text-gray-400 tracking-widest block mb-1">Basket</span>
                                  <span className="text-xl font-black uppercase">{cat.name}</span>
                                  {isJoined && <span className="block text-[10px] font-bold text-indigo-500 mt-1">COST: ${catCost.toFixed(2)}</span>}
                                </div>
                                
                                <button 
                                  onClick={() => handleOptToggle(p.userId, cat.id, isJoined)}
                                  disabled={isToggleProcessing || isPaid}
                                  className={`px-6 py-2 rounded-xl font-black text-[10px] tracking-[0.2em] transition-all shadow-sm ${
                                    isJoined 
                                      ? "bg-white text-red-600 border border-red-100 hover:bg-red-50" 
                                      : "bg-white text-green-600 border border-green-100 hover:bg-green-50"
                                  } disabled:opacity-50`}
                                >
                                  {isToggleProcessing ? "..." : (isJoined ? "LEAVE" : "JOIN")}
                                </button>
                              </div>
                            );
                          })}

                          {/* PAYMENT SECTION */}
                          <div className="mt-8 pt-8 border-t border-gray-200">
                              <div className="flex justify-between items-end mb-4">
                                  <span className="text-xs font-black uppercase text-gray-400 tracking-widest">Total Share</span>
                                  <span className="text-4xl font-black text-indigo-900">${myCut}</span>
                              </div>
                              
                              {isPaid ? (
                                  <div className="w-full bg-green-100 text-green-700 py-5 rounded-[22px] font-black text-sm uppercase tracking-[0.2em] text-center shadow-inner">
                                      ALL SETTLED ✅ (Paid ${paidAmount.toFixed(2)})
                                  </div>
                              ) : (
                                  <button
                                      onClick={() => handleTotalPay(p.userId, myCut)}
                                      className="w-full bg-black text-white py-5 rounded-[22px] font-black text-sm uppercase tracking-[0.2em] hover:bg-indigo-600 hover:shadow-xl hover:shadow-indigo-200 transition-all active:scale-95"
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

            {/* 2. AUDIT TRAIL (Now stacked nicely below the controls on the right side) */}
            <div className="border-t border-gray-100 pt-10 pb-20">
              <h2 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em] mb-6">Immutable Audit Trail</h2>
              <div className="bg-gray-50 rounded-[30px] p-8 space-y-4">
                  {auditLogs.length === 0 ? (
                      <div className="text-gray-400 italic font-bold text-center">No transactions recorded on-chain yet.</div>
                  ) : (
                      auditLogs.map((log) => (
                          <div key={log.id} className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2">
                              <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-black text-lg">✓</div>
                                  <div>
                                      <span className="block font-black uppercase text-sm">{log.user?.name || "User"} contributed</span>
                                      <span className="block text-[10px] text-gray-400 font-mono mt-1">PROOF: {log.transactionRef ? `${log.transactionRef.slice(0, 10)}...` : "Pending"}</span>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <span className="block font-black text-xl text-green-600">+${Number(log.amount).toFixed(2)}</span>
                                  <span className="block text-[10px] text-gray-400">{new Date(log.createdAt).toLocaleString()}</span>
                              </div>
                          </div>
                      ))
                  )}
              </div>
            </div>

          </div> 
          {/* END RIGHT COLUMN WRAPPER */}

        </div>
      </div>
    );
  }

  // --- MAIN FEED ---
  return (
    <div className="min-h-screen bg-gray-50 p-10 text-gray-900">
      <header className="flex justify-between items-center mb-16">
        <button
          onClick={() => router.push("../finternet")}
          className="bg-black text-white px-6 py-3 rounded-xl"
        >
          Finternet Lab
        </button>
        <h1 className="text-6xl font-black text-indigo-600 italic tracking-tighter leading-none">COOPER.</h1>
        <button className="bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors" onClick={showPoll}>View recent polls</button>
      </header>

      <div className="my-4 ml-2">
        {pollVisible && (
           <BluePollComponent onEventCreated={() => setRefreshKey(prev => prev + 1)} />
        )}
      </div>

      <h2 className="text-[20px] font-black uppercase text-gray-400 tracking-[0.3em] my-6">Your Events</h2>
      
      {loading && !selectedEvent ? (
        <div className="py-40 text-center font-black text-gray-200 italic animate-pulse text-4xl uppercase tracking-tighter">Syncing...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {events.map((event) => {
             const totalGoal = event.categories?.reduce((acc, cat) => acc + Number(cat.spendingLimit || 0), 0);
             const dbTotalPooled = Number(event.totalPooled || 0);
             const progress = totalGoal > 0 ? (dbTotalPooled / totalGoal) * 100 : 0;
             const myShare = getEstimatedShare(currentUserId, event);

             return (
              <div
                key={event.id}
                onClick={() => handleSelectEvent(event)} 
                className="bg-white p-10 rounded-[50px] shadow-sm hover:shadow-2xl transition-all cursor-pointer flex flex-col group border border-transparent hover:border-indigo-100"
              >
                <div className="flex justify-between items-start mb-8">
                    <h3 className="text-3xl font-black group-hover:text-indigo-600 transition-colors uppercase italic tracking-tighter">{event.name}</h3>
                    <div className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-black">
                        OWE: ${myShare}
                    </div>
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
                      <div key={p.id} className="w-10 h-10 rounded-full bg-gray-900 border-4 border-white flex items-center justify-center text-[8px] font-black text-white uppercase">{p.user?.name?.charAt(0)}</div>
                    ))}
                  </div>
                </div>
              </div>
             );
          })}
        </div>
      )}

      {/* CREATE EVENT MODAL */}
      {isCreatingEvent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-2xl rounded-[60px] p-12 shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-5xl font-black italic mb-10 tracking-tighter uppercase">New Basket.</h2>
            <form onSubmit={handleFinalSubmit} className="space-y-8">
              <input className="w-full text-3xl font-black border-b-4 border-gray-100 outline-none focus:border-indigo-600 pb-4 transition-colors bg-transparent" value={eventName} onChange={(e) => setEventName(e.target.value)} required placeholder="Event Name" />
              {/* ... (Existing form logic) ... */}
              <button type="submit" className="w-full bg-indigo-600 text-white py-6 rounded-[30px] font-black text-xl shadow-xl shadow-indigo-100">DEPLOY</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}