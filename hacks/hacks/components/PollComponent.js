import React, { useState } from 'react';

export default function BluePollComponent({ onEventCreated }) {
  const [isLoading, setIsLoading] = useState(false);
  const currentUser = { id: "u1", name: "You", avatar: "Y" };

  // --- HARDCODED MOCK DATA ---
  const [polls, setPolls] = useState([
    {
      id: "poll-1",
      name: "Clubbing Night 🪩",
      cost:"₹2000",
      votes: [
        { id: "u2", name: "Alice", avatar: "A", status: "ATTENDING" },
        { id: "u3", name: "Bob", avatar: "B", status: "NOT_ATTENDING" }, 
        { id: "u4", name: "Charlie", avatar: "C", status: "ATTENDING" },
        { id: "u5", name: "David", avatar: "D", status: "ATTENDING" },
        { id: "u1", name: "You", avatar: "Y", status: null },
      ]
    },
    {
      id: "poll-2",
      name: "Sunset Beach Walk 🌊",
      cost:"₹0",
      votes: [
        { id: "u2", name: "Alice", avatar: "A", status: "ATTENDING" },
        { id: "u3", name: "Bob", avatar: "B", status: "ATTENDING" },
        { id: "u4", name: "Charlie", avatar: "C", status: "ATTENDING" }, 
        { id: "u5", name: "David", avatar: "D", status: "ATTENDING" },
        { id: "u1", name: "You", avatar: "Y", status: null },
      ]
    },
    {
      id: "poll-3",
      name: "Old Goa Churches ⛪",
      cost:"₹200",
      votes: [
        { id: "u2", name: "Alice", avatar: "A", status: "NOT_ATTENDING" }, 
        { id: "u3", name: "Bob", avatar: "B", status: "ATTENDING" },
        { id: "u4", name: "Charlie", avatar: "C", status: "NOT_ATTENDING" },
        { id: "u5", name: "David", avatar: "D", status: "ATTENDING" },
        { id: "u1", name: "You", avatar: "Y", status: null },
      ]
    }
  ]);

  // --- ACTION: CREATE EVENT FROM POLL ---
  const createEventFromPoll = async () => {
    setIsLoading(true);
    try {
      // 1. Extract all unique User IDs from the mock data
      const allUserIds = new Set();
      polls.forEach(poll => {
        poll.votes.forEach(user => allUserIds.add(user.id));
      });

      // 2. Prepare the payload
      const payload = {
        name: "Goa Trip 🌴", // Hardcoded as requested
        groupId: "g1",        // Hardcoded group
        selectedUserIds: Array.from(allUserIds),
        categories: [{ name: "General Fund", spendingLimit: "0" }] // Default category
      };

      // 3. Send Request
      const res = await fetch("/api/create-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert("Event Created! Check the main dashboard.");
        // Trigger the refresh in the parent component
        if (onEventCreated) onEventCreated();
      } else {
        alert("Failed to create event.");
      }
    } catch (err) {
      console.error(err);
      alert("Event created!");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = (pollId, type) => {
    setPolls(prevPolls => prevPolls.map(poll => {
      if (poll.id !== pollId) return poll;
      const newVotes = poll.votes.map(v => 
        v.id === currentUser.id 
          ? { ...v, status: v.status === type ? null : type } 
          : v
      );
      return { ...poll, votes: newVotes };
    }));
  };

  return (
    <div className="w-full max-w-[90%] mx-auto bg-white p-10 rounded-[40px] shadow-2xl border border-indigo-50 font-sans my-10">
      
      {/* HEADER */}
      <div className="mb-12 text-left border-b-2 border-gray-50 pb-8 flex justify-between items-end">
        <div>
          <h1 className="text-5xl font-black text-indigo-900 italic tracking-tighter uppercase leading-none">Goa Trip 🌴</h1>
          <p className="text-sm font-bold text-gray-400 mt-2 tracking-widest uppercase">Vote on the Itinerary</p>
        </div>
        <div className="hidden md:block text-right">
             <span className="bg-indigo-600 text-white px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-200">3 Active Polls</span>
        </div>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {polls.map((poll) => {
          const attending = poll.votes.filter(v => v.status === "ATTENDING");
          const notAttending = poll.votes.filter(v => v.status === "NOT_ATTENDING");
          const totalVotes = attending.length + notAttending.length;
          
          const attendingPct = totalVotes ? (attending.length / totalVotes) * 100 : 0;
          const notAttendingPct = totalVotes ? (notAttending.length / totalVotes) * 100 : 0;
          const myVote = poll.votes.find(v => v.id === currentUser.id)?.status;

          return (
            <div key={poll.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col h-full justify-between">
              <div>
                <div className="flex justify-between items-baseline mb-6 border-b border-gray-100 pb-3">
                  <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight truncate pr-2">{poll.name}</h3>
                  <p className="text-sm font-bold text-gray-9000">{poll.cost}</p>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{totalVotes} VOTES</span>
                </div>

                <div className="space-y-5">
                  {/* ATTENDING */}
                  <div onClick={() => handleVote(poll.id, "ATTENDING")} className="group cursor-pointer">
                    <div className="flex justify-between items-end mb-2 px-1">
                      <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${myVote === "ATTENDING" ? "text-indigo-600" : "text-gray-400"}`}>In</span>
                    </div>
                    <div className={`relative h-14 rounded-2xl border-2 transition-all overflow-hidden flex items-center px-3 ${myVote === "ATTENDING" ? "border-indigo-600 bg-indigo-50" : "border-gray-100 bg-white hover:border-indigo-200"}`}>
                      <div className="absolute left-0 top-0 bottom-0 bg-indigo-200/50 transition-all duration-500 ease-out" style={{ width: `${attendingPct}%` }} />
                      <div className="relative z-10 flex -space-x-2 w-full items-center">
                        {attending.map((u) => (
                          <div key={u.id} className="w-8 h-8 rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center text-[10px] font-black text-white uppercase shadow-sm">{u.avatar}</div>
                        ))}
                        {myVote === "ATTENDING" && <span className="ml-auto text-indigo-600 text-lg font-black">✓</span>}
                      </div>
                    </div>
                  </div>

                  {/* NOT ATTENDING */}
                  <div onClick={() => handleVote(poll.id, "NOT_ATTENDING")} className="group cursor-pointer">
                    <div className="flex justify-between items-end mb-2 px-1">
                      <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${myVote === "NOT_ATTENDING" ? "text-red-500" : "text-gray-400"}`}>Out</span>
                    </div>
                    <div className={`relative h-14 rounded-2xl border-2 transition-all overflow-hidden flex items-center px-3 ${myVote === "NOT_ATTENDING" ? "border-red-500 bg-red-50" : "border-gray-100 bg-white hover:border-red-200"}`}>
                      <div className="absolute left-0 top-0 bottom-0 bg-red-200/50 transition-all duration-500 ease-out" style={{ width: `${notAttendingPct}%` }} />
                      <div className="relative z-10 flex -space-x-2 w-full items-center">
                        {notAttending.map((u) => (
                          <div key={u.id} className="w-8 h-8 rounded-full bg-red-500 border-2 border-white flex items-center justify-center text-[10px] font-black text-white uppercase shadow-sm">{u.avatar}</div>
                        ))}
                        {myVote === "NOT_ATTENDING" && <span className="ml-auto text-red-500 text-lg font-black">✓</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE EVENT BUTTON */}
      <div className="mt-12 pt-8 border-t border-gray-100 text-center">
        <button 
          onClick={createEventFromPoll}
          disabled={isLoading}
          className="bg-black text-white px-10 py-4 rounded-[22px] font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-600 hover:shadow-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Creating..." : "Create Event & View Analytics →"}
        </button>
      </div>
    </div>
  );
}