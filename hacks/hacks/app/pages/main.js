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
  const [refreshKey, setRefreshKey] = useState(0); // To refresh on new event
  const [expandedUser, setExpandedUser] = useState(null); 

  const showPoll = () => {
    setPollVisible(true);
  };
  
  // NEW: State for the Poll Modal
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  const [pollName, setPollName] = useState("");
  const [pollBudget, setPollBudget] = useState("");

  const currentUserId = "u3"; 
  // Form State
  const [users, setUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [eventName, setEventName] = useState("");
  const [expenseCategories, setExpenseCategories] = useState([{ name: "", spendingLimit: "" }]);

  // --- DATA LOADING ---
  const loadEvents = async () => {
    try {
      if (!selectedEvent) setLoading(true); // Only show full loader on initial load
      const res = await fetch("/api/events", { cache: 'no-store' });
      const data = await res.json();
      const eventsArray = Array.isArray(data) ? data : [];
      setEvents(eventsArray);

      if (selectedEvent) {
        // Silently update the selected event view to reflect new data
        const updated = eventsArray.find(e => e.id === selectedEvent.id);
        if (updated) setSelectedEvent(updated);
      }
    } catch (err) {
      console.error("Load Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEvents(); }, []);

  // --- ACTIONS ---
  
  // 1. JOIN / LEAVE
  const handleOptToggle = async (userId, categoryId, isCurrentlyJoined) => {
    setProcessing(`${userId}-${categoryId}-toggle`); // Lock button
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
      await loadEvents(); // Refresh data to update UI
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(null); // Unlock
    }
  };

  // 2. CONTRIBUTE $$
  const handleDeposit = async (userId, categoryId) => {
    const inputKey = `${userId}-${categoryId}`;
    const amount = parseFloat(depositAmounts[inputKey]);
    
    if (!amount || amount <= 0) return alert("Enter a valid amount");

    setProcessing(`${userId}-${categoryId}-pay`);
    try {
      await fetch("/api/categories/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, categoryId, amount }),
      });
      
      setDepositAmounts(prev => ({ ...prev, [inputKey]: "" })); // Clear input
      await loadEvents();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(null);
    }
  };

  // 3. CREATE EVENT
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

  // Load users for modal only when needed
  useEffect(() => {
    if (isCreatingEvent) {
      fetch("/api/groups/users").then(r => r.json()).then(d => setUsers(d.users || []));
    }
  }, [isCreatingEvent]);


  // --- VIEW RENDER ---
  if (selectedEvent) {
    // Math for Collective Bar
    const totalGoal = selectedEvent.categories?.reduce((acc, cat) => acc + Number(cat.spendingLimit || 0), 0);
    const totalPooled = selectedEvent.categories?.reduce((acc, cat) => acc + Number(cat.totalPooled || 0), 0);
    const globalProgress = totalGoal > 0 ? (totalPooled / totalGoal) * 100 : 0;

    return (
      
      <div className="min-h-screen bg-white p-10 text-gray-900 animate-in fade-in duration-300">
        
        <button onClick={() => setSelectedEvent(null)} className="mb-8 font-black text-xs text-indigo-600 hover:underline tracking-widest">
          ← BACK TO FEED
        </button>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 max-w-7xl mx-auto">
          
          {/* LEFT: COLLECTIVE HEALTH */}
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
                <span>Raised: ${totalPooled}</span>
                <span>Goal: ${totalGoal}</span>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em] mb-4">Baskets Overview</h2>
              {selectedEvent.categories?.map(cat => (
                <div key={cat.id} className="p-6 bg-gray-50 rounded-[30px] flex justify-between items-center border border-gray-100">
                   <span className="font-black text-lg uppercase tracking-tight">{cat.name}</span>
                   <div className="text-right">
                      <p className="font-black text-indigo-600 text-xl">${Number(cat.totalPooled)}</p>
                      <p className="text-[10px] font-bold text-gray-400">TARGET: ${cat.spendingLimit}</p>
                   </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: PARTICIPANT CONTROLS */}
          <div className="lg:col-span-7">
            <h2 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em] mb-10">Manage Participants</h2>
            <div className="space-y-4">
              {selectedEvent.participants?.map((p) => (
                <div key={p.id} className="border border-gray-100 rounded-[40px] overflow-hidden shadow-sm transition-all hover:shadow-md">
                  
                  {/* USER HEADER */}
                  <div 
                    onClick={() => setExpandedUser(expandedUser === p.userId ? null : p.userId)}
                    className={`p-8 flex justify-between items-center cursor-pointer transition-colors ${expandedUser === p.userId ? 'bg-indigo-600 text-white' : 'bg-white hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center gap-6">
                      <div className={`w-14 h-10 rounded-full flex items-center justify-center font-black text-xl border-2 ${expandedUser === p.userId ? 'bg-white text-indigo-600 border-white' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                        {p.user?.name?.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xl font-black uppercase tracking-tighter">{p.user?.name}</span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">{expandedUser === p.userId ? "CLOSE" : "MANAGE"}</span>
                  </div>

                  {/* ACTION PANEL */}
                  {expandedUser === p.userId && (
                    <div className="p-8 bg-gray-50 space-y-6 border-t border-gray-100 animate-in slide-in-from-top-4 duration-300">
                      {selectedEvent.categories?.map(cat => {
                        // Check membership safely
                        const isJoined = cat.members && Array.isArray(cat.members) 
                          ? cat.members.some(m => m.userId === p.userId) 
                          : false;
                        
                        const inputKey = `${p.userId}-${cat.id}`;
                        const isToggleProcessing = processing === `${p.userId}-${cat.id}-toggle`;
                        const isPayProcessing = processing === `${p.userId}-${cat.id}-pay`;

                        return (
                          <div key={cat.id} className="bg-white p-8 rounded-[35px] border border-gray-100 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                              <div>
                                <span className="text-xs font-black uppercase text-gray-400 tracking-widest block mb-1">Basket</span>
                                <span className="text-2xl font-black uppercase">{cat.name}</span>
                              </div>
                              
                              {/* TOGGLE BUTTON */}
                              <button 
                                onClick={() => handleOptToggle(p.userId, cat.id, isJoined)}
                                disabled={isToggleProcessing}
                                className={`px-8 py-3 rounded-2xl font-black text-[10px] tracking-[0.2em] transition-all shadow-md ${
                                  isJoined 
                                    ? "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100" 
                                    : "bg-green-50 text-green-600 border border-green-100 hover:bg-green-100"
                                } disabled:opacity-50`}
                              >
                                {isToggleProcessing ? "UPDATING..." : (isJoined ? "REJECT" : "ACCEPT")}
                              </button>
                            </div>
                            
                            {/* DEPOSIT INPUT (Only if Joined) */}
                            {isJoined && (
                              <div className="flex gap-3 animate-in fade-in zoom-in-95">
                                <input 
                                  type="number" 
                                  placeholder="Amount..."
                                  className="flex-1 bg-gray-50 border-none p-5 rounded-2xl font-bold text-lg outline-none focus:ring-2 ring-indigo-500"
                                  value={depositAmounts[inputKey] || ""}
                                  onChange={(e) => setDepositAmounts(prev => ({ ...prev, [inputKey]: e.target.value }))}
                                />
                                <button 
                                  onClick={() => handleDeposit(p.userId, cat.id)} 
                                  disabled={isPayProcessing}
                                  className="bg-black text-white px-8 rounded-2xl font-black text-xs tracking-widest hover:bg-indigo-600 transition-colors disabled:opacity-50"
                                >
                                  {isPayProcessing ? "SENDING..." : "CONTRIBUTE"}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
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
        {/* <button 
          onClick={() => createEventPoll(true)} 
          className="bg-black text-white px-10 py-5 rounded-[22px] font-black text-sm uppercase tracking-widest shadow-2xl shadow-indigo-100 hover:bg-indigo-600 transition-all"  
        >
          + Create Event Poll
        </button> */}

        <button className="bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors" onClick={showPoll}>View recent polls</button>
      </header>


<div className="my-4 ml-2">
  {pollVisible && (
       <BluePollComponent 
    onEventCreated={() => setRefreshKey(prev => prev + 1)} 
  />
      )}
</div>

      <h2 className="text-[20px] font-black uppercase text-gray-400 tracking-[0.3em] my-6">Your Events</h2>
       

      {loading && !selectedEvent ? (
        <div className="py-40 text-center font-black text-gray-200 italic animate-pulse text-4xl uppercase tracking-tighter">Syncing...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {events.map((event) => {
             const totalGoal = event.categories?.reduce((acc, cat) => acc + Number(cat.spendingLimit || 0), 0);
             const totalPooled = event.categories?.reduce((acc, cat) => acc + Number(cat.totalPooled || 0), 0);
             const progress = totalGoal > 0 ? (totalPooled / totalGoal) * 100 : 0;

             return (
              <div
                key={event.id}
                onClick={() => setSelectedEvent(event)} 
                className="bg-white p-10 rounded-[50px] shadow-sm hover:shadow-2xl transition-all cursor-pointer flex flex-col group border border-transparent hover:border-indigo-100"
              >
                <h3 className="text-3xl font-black mb-8 group-hover:text-indigo-600 transition-colors uppercase italic tracking-tighter">{event.name}</h3>
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
                  {/* <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Manage →</span> */}
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
              <div className="space-y-3">
                {expenseCategories.map((cat, idx) => (
                  <div key={idx} className="flex gap-3">
                    <input placeholder="Category" className="flex-1 bg-gray-50 p-5 rounded-[22px] font-bold outline-none" value={cat.name} onChange={(e) => { const n = [...expenseCategories]; n[idx].name = e.target.value; setExpenseCategories(n); }} />
                    <input placeholder="$" type="number" className="w-32 bg-gray-50 p-5 rounded-[22px] font-bold outline-none" value={cat.spendingLimit} onChange={(e) => { const n = [...expenseCategories]; n[idx].spendingLimit = e.target.value; setExpenseCategories(n); }} />
                  </div>
                ))}
                <button type="button" onClick={() => setExpenseCategories([...expenseCategories, { name: "", spendingLimit: "" }])} className="text-indigo-600 font-black text-[10px] uppercase tracking-widest bg-indigo-50 px-6 py-2 rounded-full">+ Add Item</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {users.map(u => (
                  <div key={u.id} onClick={() => setSelectedUserIds(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])} className={`p-5 rounded-[22px] border-2 cursor-pointer transition-all flex items-center gap-4 ${selectedUserIds.includes(u.id) ? "border-indigo-600 bg-indigo-50" : "border-gray-50 bg-gray-50"}`}>
                    <div className={`w-4 h-4 rounded-full border-2 ${selectedUserIds.includes(u.id) ? "bg-indigo-600 border-indigo-600" : "bg-transparent border-gray-300"}`} />
                    <span className="font-bold text-sm">{u.name}</span>
                  </div>
                ))}
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white py-6 rounded-[30px] font-black text-xl shadow-xl shadow-indigo-100">DEPLOY</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}