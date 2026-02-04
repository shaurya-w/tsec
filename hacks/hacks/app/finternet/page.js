"use client";
import { useEffect, useState } from "react";

export default function Page() {
  const [ledger, setLedger] = useState([]);
  const [status, setStatus] = useState("Idle...");
  const [currentIntent, setCurrentIntent] = useState(null);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("pool-ledger") || "[]");
    setLedger(stored);
  }, []);

  // 🔁 Poll intent in background while user pays in other tab
  const pollIntent = (intent) => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/intent/${intent}`);
      const data = await res.json();

      if (data.status === "PROCESSING") {
        clearInterval(interval);
        runPipeline(intent);
      }
    }, 2500);
  };

  const runPipeline = async (intent) => {
    setStatus("Finalizing payment pipeline...");

    const res = await fetch(`/api/pipeline/${intent}`, {
      method: "POST",
    });

    const data = await res.json();

    const entry = {
      intentId: intent,
      buyer: data.escrow.data.buyerAddress,
      amount: data.escrow.data.amount,
      proofId: data.proof.data.id,
      timestamp: new Date().toISOString(),
    };

    const updated = [
      ...JSON.parse(localStorage.getItem("pool-ledger") || "[]"),
      entry,
    ];

    localStorage.setItem("pool-ledger", JSON.stringify(updated));
    setLedger(updated);
    setStatus("✅ Payment + Proof recorded!");
  };

  const startPayment = async () => {
    setStatus("Creating payment...");
    const res = await fetch("/api/pay", { method: "POST" });
    const data = await res.json();

    setCurrentIntent(data.intentId);

    // ✅ Open Finternet in new tab
    window.open(data.paymentUrl, "_blank");

    setStatus("Waiting for user to complete payment...");
    pollIntent(data.intentId);
  };

  return (
    <div className="p-10">
      <h1 className="text-3xl mb-6">Transparent Pool Ledger</h1>

      <div className="mb-4 font-mono">Status: {status}</div>

      <button
        onClick={startPayment}
        className="bg-black text-white px-6 py-2 mb-6"
      >
        Pay Now
      </button>

      <h2 className="text-xl mb-2">Pool Contributions</h2>
      <pre>{JSON.stringify(ledger, null, 2)}</pre>
    </div>
  );
}
