"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { type Address } from "viem";
import {
  type ActiveStream,
  calculateClaimable,
  calculateStreamProgress,
  formatTimeRemaining,
  salaryToStream,
  generateDemoStream,
  STREAMING_DURATIONS,
} from "@/lib/streaming";
import { formatUSDC, formatAddress } from "@/lib/payments";

export default function StreamingPayment() {
  const { address } = useAccount();
  const [streams, setStreams] = useState<ActiveStream[]>([]);
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Form state
  const [recipientAddress, setRecipientAddress] = useState("");
  const [salaryAmount, setSalaryAmount] = useState("");
  const [duration, setDuration] = useState<number>(STREAMING_DURATIONS.MONTHLY);
  
  // Update time every second for real-time display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load demo stream on mount
  useEffect(() => {
    if (address && streams.length === 0) {
      const demo = generateDemoStream(address);
      setStreams([demo]);
    }
  }, [address]);

  // Calculate stream info
  const calculateStreamInfo = () => {
    if (!salaryAmount) return null;
    
    const { ratePerSecond, ratePerHour, ratePerDay } = salaryToStream(salaryAmount);
    
    return {
      ratePerSecond,
      ratePerHour: parseFloat(ratePerHour).toFixed(2),
      ratePerDay: parseFloat(ratePerDay).toFixed(2),
      totalSeconds: duration,
      totalDays: duration / 86400,
    };
  };

  // Handle create stream
  const handleCreateStream = () => {
    if (!recipientAddress || !salaryAmount) {
      alert("Please fill in all fields");
      return;
    }

    alert("⚠️ Stream creation requires smart contract deployment. This is a demo UI.");
    
    // In production, this would call the streaming contract
    // const newStream = await createStream(recipientAddress, salaryAmount, duration);
    
    setShowCreateForm(false);
  };

  // Handle claim
  const handleClaim = (streamId: string) => {
    const stream = streams.find((s) => s.id === streamId);
    if (!stream) return;

    const claimable = calculateClaimable(stream, currentTime);
    
    if (claimable === 0n) {
      alert("Nothing to claim yet");
      return;
    }

    alert(`🚀 Claiming ${formatUSDC(claimable)} USDC...\n\nThis would call the smart contract in production.`);
    
    // In production: await claimStream(streamId);
  };

  // Stream info display
  const streamInfo = calculateStreamInfo();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">💧 Streaming Payments</h2>
          <p className="text-sm text-gray-400 mt-1">
            Real-time salary that flows every second
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-gradient-to-r from-[#ff7582] to-[#725a7a] hover:opacity-90 rounded-lg font-medium transition-opacity"
        >
          {showCreateForm ? "✕ Cancel" : "➕ New Stream"}
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="p-6 bg-white/5 border border-white/10 rounded-lg space-y-4">
          <h3 className="text-lg font-medium">Create Payment Stream</h3>
          
          {/* Recipient */}
          <div>
            <label className="block text-sm font-medium mb-2">Recipient Address</label>
            <input
              type="text"
              placeholder="0x..."
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-[#ff7582] focus:outline-none"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium mb-2">Total Amount (USDC)</label>
            <input
              type="number"
              placeholder="3000"
              step="0.01"
              value={salaryAmount}
              onChange={(e) => setSalaryAmount(e.target.value)}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-[#ff7582] focus:outline-none"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium mb-2">Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-[#ff7582] focus:outline-none"
            >
              <option value={STREAMING_DURATIONS.DAILY}>1 Day</option>
              <option value={STREAMING_DURATIONS.WEEKLY}>1 Week</option>
              <option value={STREAMING_DURATIONS.MONTHLY}>1 Month</option>
              <option value={STREAMING_DURATIONS.QUARTERLY}>3 Months</option>
              <option value={STREAMING_DURATIONS.YEARLY}>1 Year</option>
            </select>
          </div>

          {/* Stream Preview */}
          {streamInfo && (
            <div className="p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
              <p className="text-sm font-medium mb-2">💧 Stream Preview</p>
              <div className="space-y-1 text-sm">
                <p className="flex justify-between">
                  <span className="text-gray-400">Per second:</span>
                  <span className="font-mono">${(Number(streamInfo.ratePerSecond) / 1e6).toFixed(6)}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-gray-400">Per hour:</span>
                  <span className="font-mono">${streamInfo.ratePerHour}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-gray-400">Per day:</span>
                  <span className="font-mono">${streamInfo.ratePerDay}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-gray-400">Total days:</span>
                  <span className="font-mono">{streamInfo.totalDays.toFixed(1)}</span>
                </p>
              </div>
            </div>
          )}

          <button
            onClick={handleCreateStream}
            disabled={!recipientAddress || !salaryAmount}
            className="w-full py-3 bg-gradient-to-r from-[#ff7582] to-[#725a7a] hover:opacity-90 rounded-lg font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Stream
          </button>
        </div>
      )}

      {/* Active Streams */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Active Streams</h3>
        
        {streams.length === 0 ? (
          <div className="p-12 bg-white/5 border border-white/10 rounded-lg text-center">
            <p className="text-4xl mb-4">💧</p>
            <p className="text-gray-400">No active streams</p>
            <p className="text-sm text-gray-500 mt-2">
              Create your first streaming payment above
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {streams.map((stream) => {
              const claimable = calculateClaimable(stream, currentTime);
              const progress = calculateStreamProgress(stream);
              const remaining = stream.endTime ? formatTimeRemaining(stream.endTime) : "Ongoing";
              
              return (
                <div
                  key={stream.id}
                  className="p-6 bg-gradient-to-br from-[#ff7582]/10 to-[#725a7a]/10 border border-white/10 rounded-lg"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Streaming to</p>
                      <p className="font-mono text-lg">{formatAddress(stream.recipient)}</p>
                    </div>
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm rounded-full">
                      ● {stream.status}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Progress</span>
                      <span className="font-medium">{progress.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#ff7582] to-[#725a7a] transition-all duration-1000"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-xs text-gray-400 mb-1">Total Amount</p>
                      <p className="text-lg font-bold">{formatUSDC(stream.totalAmount)} USDC</p>
                    </div>
                    
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-xs text-gray-400 mb-1">Claimed</p>
                      <p className="text-lg font-bold">{formatUSDC(stream.claimedAmount)} USDC</p>
                    </div>
                    
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-xs text-gray-400 mb-1">Available Now</p>
                      <p className="text-lg font-bold text-green-400">
                        {formatUSDC(claimable)} USDC
                      </p>
                    </div>
                    
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-xs text-gray-400 mb-1">Time Remaining</p>
                      <p className="text-lg font-bold">{remaining}</p>
                    </div>
                  </div>

                  {/* Rate Display */}
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-4">
                    <p className="text-xs text-gray-400 mb-2">💧 Streaming Rate</p>
                    <div className="flex items-center justify-between text-sm">
                      <span>${(Number(stream.ratePerSecond) / 1e6).toFixed(6)}/sec</span>
                      <span>${((Number(stream.ratePerSecond) * 3600) / 1e6).toFixed(2)}/hour</span>
                      <span>${((Number(stream.ratePerSecond) * 86400) / 1e6).toFixed(2)}/day</span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => handleClaim(stream.id)}
                    disabled={claimable === 0n}
                    className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:opacity-90 rounded-lg font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {claimable === 0n
                      ? "Nothing to Claim Yet"
                      : `💰 Claim ${formatUSDC(claimable)} USDC`}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="space-y-4">
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-blue-300">
            ℹ️ <strong>How Streaming Works:</strong> Money flows from sender to recipient 
            every second based on the rate. Recipients can claim their earned amount at any time. 
            This enables real-time salaries, vesting schedules, and subscription payments.
          </p>
        </div>

        <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
          <p className="text-sm text-purple-300">
            💡 <strong>Use Cases:</strong> Hourly workers get paid per second worked, token 
            vesting with no cliff, subscription services with auto-renewal, escrow with 
            time-based release, and more.
          </p>
        </div>

        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-sm text-yellow-300">
            ⚠️ <strong>Note:</strong> Streaming requires a deployed smart contract 
            (similar to Sablier or Superfluid). This UI is functional, but contract 
            deployment is needed for production use.
          </p>
        </div>
      </div>
    </div>
  );
}