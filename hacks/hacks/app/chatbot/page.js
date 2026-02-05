
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ChatInput from "../../components/ChatInput";

export default function Home() {
  const [submitted, setSubmitted] = useState(false);
  const [itinerary, setItinerary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function handleSubmit() {
    setSubmitted(true);
  }

  const genPoll = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/gemini", { method: "GET" });
      if (!res.ok) throw new Error("Failed to fetch suggestions");
      const data = await res.json();
      setItinerary(data.itinerary);
    } catch (err) {
      console.error(err);
      setError("Something went wrong while generating the poll.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="w-full max-w-xl rounded-2xl bg-blue-400 p-8 text-white shadow-xl space-y-6">
        <h1 className="text-xl font-semibold">Generate Poll Suggestions with AI</h1>
        {!submitted && <ChatInput addMessage={handleSubmit} />}
        {submitted && itinerary.length === 0 && (
          <button
            onClick={genPoll}
            disabled={loading}
            className="w-full rounded-xl bg-blue-700 py-3 font-semibold hover:bg-blue-800 transition disabled:bg-blue-300"
          >
            {loading ? "Generating..." : "Get estimate event budget"}
          </button>
        )}
        {error && <p className="text-sm text-red-200 text-center">{error}</p>}
        <SuggestionsList itinerary={itinerary} />
      </div>
    </div>
  );
}

function SuggestionsList({ itinerary }) {
  const router = useRouter();
  if (!itinerary?.length) return null;

  const handleSelectBudget = (item) => {
    // Store the full object: Name and Cost
    const selection = {
      name: item.item,
      cost: item.estimated_cost
    };
    localStorage.setItem("ai_selection", JSON.stringify(selection));
    router.push("/"); // Ensure this leads to your main.js location
  };

  return (
    <div className="space-y-3">
      {itinerary.map((step, i) => (
        <div key={i} className="rounded-xl bg-white p-4 flex justify-between items-center shadow-sm">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">Option {i + 1}</p>
            <p className="font-medium text-black">{step.item}</p>
            <span className="text-md text-green-600 font-bold">₹{step.estimated_cost}</span>
          </div>
          <button 
            onClick={() => handleSelectBudget(step)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            Select
          </button>
        </div>
      ))}
    </div>
  );
}