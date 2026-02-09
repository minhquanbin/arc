"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import {
  type ScheduledPayment,
  type PaymentRecipient,
  saveScheduledPayment,
  getScheduledPayments,
  deleteScheduledPayment,
  formatAddress,
  formatUSDC,
  generateId,
  calculateBatchTotal,
} from "@/lib/payments";
import { parseUnits } from "viem";

export default function RecurringPayment() {
  const { address } = useAccount();
  const [scheduledPayments, setScheduledPayments] = useState<ScheduledPayment[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Form state
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "biweekly" | "monthly">("monthly");
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [time, setTime] = useState("09:00");
  const [recipients, setRecipients] = useState<PaymentRecipient[]>([]);
  
  // Load scheduled payments
  useEffect(() => {
    const payments = getScheduledPayments();
    setScheduledPayments(payments);
  }, []);

  // Calculate next run time
  const calculateNextRun = (): number => {
    const now = new Date();
    const [hours, minutes] = time.split(":").map(Number);
    
    let nextRun = new Date();
    nextRun.setHours(hours, minutes, 0, 0);

    switch (frequency) {
      case "daily":
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;
        
      case "weekly":
        nextRun.setDate(nextRun.getDate() + ((dayOfWeek + 7 - nextRun.getDay()) % 7));
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 7);
        }
        break;
        
      case "biweekly":
        nextRun.setDate(nextRun.getDate() + ((dayOfWeek + 7 - nextRun.getDay()) % 7));
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 14);
        }
        break;
        
      case "monthly":
        nextRun.setDate(dayOfMonth);
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1);
        }
        break;
    }

    return nextRun.getTime();
  };

  // Handle create scheduled payment
  const handleCreate = () => {
    if (!name || recipients.length === 0) {
      alert("Please enter a name and add recipients");
      return;
    }

    const newSchedule: ScheduledPayment = {
      id: generateId(),
      name,
      recipients,
      schedule: {
        frequency,
        dayOfWeek: frequency === "weekly" || frequency === "biweekly" ? dayOfWeek : undefined,
        dayOfMonth: frequency === "monthly" ? dayOfMonth : undefined,
        time,
      },
      nextRun: calculateNextRun(),
      isActive: true,
      createdAt: Date.now(),
    };

    saveScheduledPayment(newSchedule);
    setScheduledPayments([...scheduledPayments, newSchedule]);
    
    // Reset form
    setName("");
    setRecipients([]);
    setShowCreateForm(false);
    
    alert("✅ Scheduled payment created!");
  };

  // Toggle active status
  const handleToggleActive = (id: string) => {
    const updated = scheduledPayments.map((p) => {
      if (p.id === id) {
        const toggled = { ...p, isActive: !p.isActive };
        saveScheduledPayment(toggled);
        return toggled;
      }
      return p;
    });
    setScheduledPayments(updated);
  };

  // Delete scheduled payment
  const handleDelete = (id: string) => {
    if (!confirm("Delete this scheduled payment?")) return;
    
    deleteScheduledPayment(id);
    setScheduledPayments(scheduledPayments.filter((p) => p.id !== id));
  };

  // Add recipient to form
  const handleAddRecipient = () => {
    const address = prompt("Recipient address (0x...):");
    if (!address) return;
    
    const amount = prompt("Amount (USDC):");
    if (!amount) return;
    
    const label = prompt("Label (optional):");
    
    setRecipients([
      ...recipients,
      {
        address: address as any,
        amount,
        label: label || undefined,
        id: generateId(),
      },
    ]);
  };

  // Format frequency for display
  const formatFrequency = (schedule: ScheduledPayment["schedule"]): string => {
    const { frequency, dayOfWeek, dayOfMonth, time } = schedule;
    
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    switch (frequency) {
      case "daily":
        return `Daily at ${time}`;
      case "weekly":
        return `Every ${days[dayOfWeek!]} at ${time}`;
      case "biweekly":
        return `Every 2 weeks on ${days[dayOfWeek!]} at ${time}`;
      case "monthly":
        return `Monthly on day ${dayOfMonth} at ${time}`;
    }
  };

  // Format next run time
  const formatNextRun = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `in ${days}d ${hours}h`;
    if (hours > 0) return `in ${hours}h`;
    return "soon";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">⚙️ Recurring Payments</h2>
          <p className="text-sm text-gray-400 mt-1">
            Set up automated payroll and scheduled transfers
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-[#ff7582] hover:bg-[#ff6575] rounded-lg font-medium transition-colors"
        >
          {showCreateForm ? "✕ Cancel" : "➕ New Schedule"}
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="p-6 bg-white/5 border border-white/10 rounded-lg space-y-4">
          <h3 className="text-lg font-medium">Create Scheduled Payment</h3>
          
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2">Schedule Name</label>
            <input
              type="text"
              placeholder="e.g., Monthly Payroll"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-[#ff7582] focus:outline-none"
            />
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium mb-2">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as any)}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-[#ff7582] focus:outline-none"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {/* Day selection */}
          {(frequency === "weekly" || frequency === "biweekly") && (
            <div>
              <label className="block text-sm font-medium mb-2">Day of Week</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-[#ff7582] focus:outline-none"
              >
                <option value={1}>Monday</option>
                <option value={2}>Tuesday</option>
                <option value={3}>Wednesday</option>
                <option value={4}>Thursday</option>
                <option value={5}>Friday</option>
                <option value={6}>Saturday</option>
                <option value={0}>Sunday</option>
              </select>
            </div>
          )}

          {frequency === "monthly" && (
            <div>
              <label className="block text-sm font-medium mb-2">Day of Month</label>
              <input
                type="number"
                min="1"
                max="31"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Number(e.target.value))}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-[#ff7582] focus:outline-none"
              />
            </div>
          )}

          {/* Time */}
          <div>
            <label className="block text-sm font-medium mb-2">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-[#ff7582] focus:outline-none"
            />
          </div>

          {/* Recipients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Recipients</label>
              <button
                onClick={handleAddRecipient}
                className="text-sm text-[#ff7582] hover:text-[#ff6575]"
              >
                ➕ Add
              </button>
            </div>
            
            {recipients.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                No recipients added yet
              </p>
            ) : (
              <div className="space-y-2">
                {recipients.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                  >
                    <div>
                      <p className="font-mono text-sm">{formatAddress(r.address)}</p>
                      {r.label && <p className="text-xs text-gray-400">{r.label}</p>}
                    </div>
                    <p className="font-medium">{r.amount} USDC</p>
                  </div>
                ))}
                <div className="text-sm text-gray-400 text-right pt-2">
                  Total: {formatUSDC(calculateBatchTotal(recipients))} USDC
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleCreate}
            disabled={!name || recipients.length === 0}
            className="w-full py-3 bg-gradient-to-r from-[#ff7582] to-[#725a7a] hover:opacity-90 rounded-lg font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Schedule
          </button>
        </div>
      )}

      {/* Scheduled Payments List */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Active Schedules</h3>
        
        {scheduledPayments.length === 0 ? (
          <div className="p-12 bg-white/5 border border-white/10 rounded-lg text-center">
            <p className="text-4xl mb-4">📅</p>
            <p className="text-gray-400">No scheduled payments yet</p>
            <p className="text-sm text-gray-500 mt-2">
              Create your first automated payroll above
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {scheduledPayments.map((payment) => (
              <div
                key={payment.id}
                className="p-4 bg-white/5 border border-white/10 rounded-lg hover:border-[#ff7582]/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{payment.name}</h4>
                      {payment.isActive ? (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs rounded-full">
                          Paused
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-2 space-y-1 text-sm text-gray-400">
                      <p>📅 {formatFrequency(payment.schedule)}</p>
                      <p>⏰ Next run: {formatNextRun(payment.nextRun)}</p>
                      <p>👥 {payment.recipients.length} recipients</p>
                      <p>💰 {formatUSDC(calculateBatchTotal(payment.recipients))} USDC</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleActive(payment.id)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      title={payment.isActive ? "Pause" : "Resume"}
                    >
                      {payment.isActive ? "⏸️" : "▶️"}
                    </button>
                    <button
                      onClick={() => handleDelete(payment.id)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors text-red-400"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
        <p className="text-sm text-yellow-300">
          ⚠️ <strong>Note:</strong> Scheduled payments are currently stored locally and 
          require manual execution. In production, this would be automated via backend 
          service or smart contract automation (e.g., Chainlink Automation).
        </p>
      </div>
    </div>
  );
}
