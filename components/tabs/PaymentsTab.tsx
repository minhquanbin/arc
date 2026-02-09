"use client";

import { useState } from "react";
import BatchPayment from "@/components/payments/BatchPayment";
import RecurringPayment from "@/components/payments/RecurringPayment";
import StreamingPayment from "@/components/payments/StreamingPayment";

type PaymentMode = "batch" | "recurring" | "streaming";

export default function PaymentsTab() {
  const [mode, setMode] = useState<PaymentMode>("batch");

  const modes = [
    {
      id: "batch" as const,
      icon: "💸",
      title: "One-time Batch",
      description: "Pay multiple recipients instantly",
      features: ["CSV upload", "Multi-send", "Templates", "Instant settlement"],
      status: "✅ Ready",
      phase: "Phase 1",
    },
    {
      id: "recurring" as const,
      icon: "📅",
      title: "Recurring Payroll",
      description: "Automated scheduled payments",
      features: ["Set & forget", "Weekly/Monthly", "Auto-execute", "Predictable"],
      status: "🚧 Beta",
      phase: "Phase 2",
    },
    {
      id: "streaming" as const,
      icon: "💧",
      title: "Real-time Stream",
      description: "Salary flows every second",
      features: ["Per-second pay", "Instant claim", "Token vesting", "Escrow"],
      status: "🔬 Demo",
      phase: "Phase 3",
    },
  ];

  const currentMode = modes.find((m) => m.id === mode);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">💰 Payments</h1>
        <p className="text-gray-400">
          Complete payment infrastructure for global teams. Choose your payment method below.
        </p>
      </div>

      {/* Mode Selection */}
      <div className="space-y-4">
        <h2 className="text-xl font-medium">How do you want to pay?</h2>
        
        <div className="grid md:grid-cols-3 gap-4">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`
                p-6 rounded-lg border-2 transition-all text-left
                ${
                  mode === m.id
                    ? "border-[#ff7582] bg-[#ff7582]/10"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }
              `}
            >
              {/* Icon & Title */}
              <div className="flex items-start justify-between mb-3">
                <span className="text-4xl">{m.icon}</span>
                <span className="text-xs px-2 py-1 bg-white/10 rounded-full">
                  {m.status}
                </span>
              </div>
              
              <h3 className="text-lg font-bold mb-1">{m.title}</h3>
              <p className="text-sm text-gray-400 mb-3">{m.description}</p>
              
              {/* Features */}
              <div className="space-y-1">
                {m.features.map((feature, i) => (
                  <p key={i} className="text-xs text-gray-500">
                    ✓ {feature}
                  </p>
                ))}
              </div>
              
              {/* Phase Badge */}
              <div className="mt-4 pt-3 border-t border-white/10">
                <span className="text-xs font-mono text-gray-500">{m.phase}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Active Mode Info Banner */}
      <div className="p-4 bg-gradient-to-r from-[#ff7582]/20 to-[#725a7a]/20 rounded-lg border border-[#ff7582]/30">
        <div className="flex items-start gap-3">
          <span className="text-3xl">{currentMode?.icon}</span>
          <div>
            <h3 className="font-bold text-lg mb-1">{currentMode?.title}</h3>
            <p className="text-sm text-gray-300">{currentMode?.description}</p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/10" />

      {/* Dynamic Content Based on Mode */}
      {mode === "batch" && <BatchPayment />}
      {mode === "recurring" && <RecurringPayment />}
      {mode === "streaming" && <StreamingPayment />}

      {/* Footer Info */}
      <div className="space-y-3 pt-6">
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-blue-300">
            💡 <strong>Why Arc Payroll?</strong> Traditional payment systems charge $15-50 per 
            transaction and take 3-5 days. Arc Payroll costs ~$0.01 per transaction and settles 
            in under 10 seconds. Perfect for global teams, DAOs, and remote companies.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-xs text-green-300 font-medium mb-1">⚡ Instant</p>
            <p className="text-xs text-gray-400">Settlement in &lt;10 seconds</p>
          </div>
          
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-blue-300 font-medium mb-1">💰 Cheap</p>
            <p className="text-xs text-gray-400">~$0.01 per transaction</p>
          </div>
          
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <p className="text-xs text-purple-300 font-medium mb-1">🌍 Global</p>
            <p className="text-xs text-gray-400">Pay anyone, anywhere</p>
          </div>
        </div>

        {/* Comparison Table */}
        <details className="p-4 bg-white/5 rounded-lg border border-white/10">
          <summary className="cursor-pointer font-medium text-sm">
            📊 Compare with Traditional Solutions
          </summary>
          
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 pr-4">Feature</th>
                  <th className="text-left py-2 pr-4">Traditional</th>
                  <th className="text-left py-2 text-[#ff7582]">Arc Payroll</th>
                </tr>
              </thead>
              <tbody className="text-gray-400">
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4">Speed</td>
                  <td className="py-2 pr-4">3-5 days</td>
                  <td className="py-2 text-green-400">&lt;10 seconds</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4">Cost per tx</td>
                  <td className="py-2 pr-4">$15-50</td>
                  <td className="py-2 text-green-400">~$0.01</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4">Multi-recipient</td>
                  <td className="py-2 pr-4">Multiple txs</td>
                  <td className="py-2 text-green-400">1 transaction</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4">Automation</td>
                  <td className="py-2 pr-4">Manual</td>
                  <td className="py-2 text-green-400">Fully automated</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4">Streaming</td>
                  <td className="py-2 pr-4">Not possible</td>
                  <td className="py-2 text-green-400">Real-time</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Transparency</td>
                  <td className="py-2 pr-4">Opaque</td>
                  <td className="py-2 text-green-400">On-chain proof</td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </div>
  );
}
