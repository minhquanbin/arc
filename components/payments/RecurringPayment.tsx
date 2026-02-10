"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { parseUnits, type Address, formatUnits } from "viem";
import { type PaymentRecipient, formatAddress, formatUSDC } from "@/lib/payments";

const ERC20_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const RECURRING_ABI = [
  {
    type: "function",
    name: "scheduleCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getSchedule",
    stateMutability: "view",
    inputs: [{ name: "scheduleId", type: "uint256" }],
    outputs: [
      { name: "payer", type: "address" },
      { name: "token", type: "address" },
      { name: "name", type: "string" },
      { name: "intervalSeconds", type: "uint64" },
      { name: "nextRun", type: "uint64" },
      { name: "active", type: "bool" },
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
  },
  {
    type: "function",
    name: "getSchedulesByRecipient",
    stateMutability: "view",
    inputs: [{ name: "recipient", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "getSchedulesByPayer",
    stateMutability: "view",
    inputs: [{ name: "payer", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "createSchedule",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "name", type: "string" },
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
      { name: "intervalSeconds", type: "uint64" },
      { name: "firstRun", type: "uint64" },
    ],
    outputs: [{ name: "scheduleId", type: "uint256" }],
  },
  {
    type: "function",
    name: "toggleActive",
    stateMutability: "nonpayable",
    inputs: [
      { name: "scheduleId", type: "uint256" },
      { name: "active", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "deleteSchedule",
    stateMutability: "nonpayable",
    inputs: [{ name: "scheduleId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "execute",
    stateMutability: "nonpayable",
    inputs: [{ name: "scheduleId", type: "uint256" }],
    outputs: [],
  },
] as const;

type OnchainSchedule = {
  id: bigint;
  name: string;
  payer: Address;
  token: Address;
  intervalSeconds: bigint;
  nextRun: bigint;
  active: boolean;
  recipients: Address[];
  amounts: bigint[];
};

function setLocalScheduleName(id: bigint, name: string) {
  try {
    localStorage.setItem(`arc:recurring:scheduleName:${id.toString()}`, name);
  } catch {
    // ignore
  }
}

function getLocalScheduleName(id: bigint): string {
  try {
    return localStorage.getItem(`arc:recurring:scheduleName:${id.toString()}`) || "";
  } catch {
    return "";
  }
}

function intervalSecondsFromFrequency(
  freq: "hourly" | "daily" | "weekly" | "biweekly" | "monthly",
): number {
  if (freq === "hourly") return 60 * 60;
  if (freq === "daily") return 24 * 60 * 60;
  if (freq === "weekly") return 7 * 24 * 60 * 60;
  if (freq === "biweekly") return 14 * 24 * 60 * 60;
  return 30 * 24 * 60 * 60; // simple month
}

function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0m";
  const s = Math.floor(totalSeconds);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function RecurringPayment() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const RECURRING_PAYMENTS_ADDRESS = (process.env.NEXT_PUBLIC_ARC_RECURRING_PAYMENTS ||
    "0x0000000000000000000000000000000000000000") as Address;

  const USDC_ADDRESS = ((process.env.NEXT_PUBLIC_ARC_USDC ||
    process.env.NEXT_PUBLIC_ARC_USDC_ADDRESS) ||
    "0x3600000000000000000000000000000000000000") as Address;

  const isConfigured =
    RECURRING_PAYMENTS_ADDRESS !== ("0x0000000000000000000000000000000000000000" as Address);

  const [scheduledPayments, setScheduledPayments] = useState<OnchainSchedule[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [lastError, setLastError] = useState<string>("");
  const [nowSec, setNowSec] = useState<number>(Math.floor(Date.now() / 1000));

  // form
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<"hourly" | "daily" | "weekly" | "biweekly" | "monthly">("monthly");
  const [time, setTime] = useState("09:00");
  const [recipients, setRecipients] = useState<PaymentRecipient[]>([]);
  const [newRecipientAddress, setNewRecipientAddress] = useState("");
  const [newRecipientAmount, setNewRecipientAmount] = useState("");
  const [newRecipientLabel, setNewRecipientLabel] = useState("");

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const isBusy = isPending || isConfirming;

  const totalPerRun = useMemo(() => {
    try {
      return recipients.reduce((acc, r) => acc + parseUnits(r.amount || "0", 6), 0n);
    } catch {
      return 0n;
    }
  }, [recipients]);

  const [allowance, setAllowance] = useState<bigint>(0n);

  const hasSufficientAllowance = useMemo(() => {
    // For creating/executing schedules, allowance must cover at least the total amount per run.
    // If totalPerRun is 0, consider it "sufficient" so the UI doesn't block approval unnecessarily.
    if (totalPerRun === 0n) return true;
    return allowance >= totalPerRun;
  }, [allowance, totalPerRun]);

  async function refreshAllowance() {
    if (!publicClient || !address || !isConfigured) return;
    try {
      const a = (await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address as Address, RECURRING_PAYMENTS_ADDRESS],
      })) as bigint;
      setAllowance(a);
    } catch {
      setAllowance(0n);
    }
  }

  function humanizeWagmiError(e: unknown): string {
    const anyErr = e as any;
    const msg =
      anyErr?.shortMessage ||
      anyErr?.details ||
      anyErr?.message ||
      "Transaction failed";
    const lower = String(msg).toLowerCase();
    if (lower.includes("tooearly")) return "TooEarly: schedule not due yet.";
    if (lower.includes("insufficient")) return "Insufficient balance to pay recipients.";
    if (lower.includes("allowance")) return "Allowance too low. Please approve USDC.";
    if (lower.includes("user rejected") || lower.includes("rejected")) return "User rejected the request.";
    return String(msg);
  }

  async function loadSchedules() {
    if (!publicClient || !address || !isConfigured) return;
    setStatus("Loading schedules...");
    setLastError("");
    try {
      const contractBytecode = await publicClient.getBytecode({ address: RECURRING_PAYMENTS_ADDRESS });
      if (!contractBytecode) {
        setLastError(`No contract code found at ${RECURRING_PAYMENTS_ADDRESS}. Check NEXT_PUBLIC_ARC_RECURRING_PAYMENTS.`);
        setStatus("");
        return;
      }
    } catch {
      // ignore
    }

    const items: OnchainSchedule[] = [];

    const [recipientIds, payerIds] = (await Promise.all([
      publicClient.readContract({
        address: RECURRING_PAYMENTS_ADDRESS,
        abi: RECURRING_ABI,
        functionName: "getSchedulesByRecipient",
        args: [address as Address],
      }),
      publicClient.readContract({
        address: RECURRING_PAYMENTS_ADDRESS,
        abi: RECURRING_ABI,
        functionName: "getSchedulesByPayer",
        args: [address as Address],
      }),
    ])) as [bigint[], bigint[]];

    const ids = Array.from(new Set([...recipientIds, ...payerIds].map((x) => x.toString()))).map(BigInt);

    for (const i of ids) {
      const [payer, token, schedName, intervalSeconds, nextRun, active, recs, amts] =
        (await publicClient.readContract({
          address: RECURRING_PAYMENTS_ADDRESS,
          abi: RECURRING_ABI,
          functionName: "getSchedule",
          args: [i],
        })) as [Address, Address, string, bigint, bigint, boolean, Address[], bigint[]];

      items.push({
        id: i,
        name: schedName || getLocalScheduleName(i) || `Schedule #${i.toString()}`,
        payer,
        token,
        intervalSeconds,
        nextRun,
        active,
        recipients: recs,
        amounts: amts,
      });
    }

    setScheduledPayments(items);
    setStatus("");
    // Helpful debug signal (safe in prod)
    console.log("[RecurringPayment] loaded schedules", {
      contract: RECURRING_PAYMENTS_ADDRESS,
      recipientIds: recipientIds.length,
      payerIds: payerIds.length,
      total: ids.length,
    });
    setLastError("");
  }

  useEffect(() => {
    if (!isConfigured) return;
    loadSchedules();
    refreshAllowance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, isConfigured]);

  useEffect(() => {
    if (!isConfirmed) return;
    loadSchedules();
    refreshAllowance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed]);

  useEffect(() => {
    const t = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  function addRecipientInline() {
    const addr = newRecipientAddress.trim();
    const amt = newRecipientAmount.trim();
    const label = newRecipientLabel.trim();

    if (!addr || !amt) {
      setLastError("Please enter a recipient address and amount.");
      return;
    }
    if (!addr.startsWith("0x") || addr.length !== 42) {
      setLastError("Recipient address must be a valid 0x address (42 chars).");
      return;
    }
    // Basic numeric validation; parseUnits will still enforce decimals rules.
    if (!/^\d+(\.\d+)?$/.test(amt)) {
      setLastError("Amount must be a number (e.g. 1 or 1.5).");
      return;
    }

    setLastError("");
    setRecipients((prev) => [
      ...prev,
      {
        address: addr as Address,
        amount: amt,
        label: label || undefined,
        id: `${Date.now()}-${Math.random()}`,
      },
    ]);
    setNewRecipientAddress("");
    setNewRecipientAmount("");
    setNewRecipientLabel("");
  }

  function removeRecipient(id?: string) {
    if (!id) return;
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  }

  function computeFirstRunUnix(): bigint {
    const now = new Date();

    const first = new Date();
    if (frequency === "hourly") {
      // "Hourly" ignores the time picker; schedule the next whole hour.
      first.setMinutes(0, 0, 0);
      first.setHours(first.getHours() + 1);
    } else {
      const [hh, mm] = time.split(":").map(Number);
      first.setHours(hh, mm, 0, 0);

      if (first <= now) {
        if (frequency === "daily") first.setDate(first.getDate() + 1);
        if (frequency === "weekly") first.setDate(first.getDate() + 7);
        if (frequency === "biweekly") first.setDate(first.getDate() + 14);
        if (frequency === "monthly") first.setDate(first.getDate() + 30);
      }
    }

    return BigInt(Math.floor(first.getTime() / 1000));
  }

  async function onApprove() {
    if (!isConfigured) return;
    setLastError("");
    // approve max uint256
    const max = (1n << 256n) - 1n;
    try {
      writeContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [RECURRING_PAYMENTS_ADDRESS, max],
      });
    } catch (e) {
      setLastError(humanizeWagmiError(e));
    }
  }

  async function onApproveExact(amount: bigint) {
    if (!isConfigured) return;
    setLastError("");
    try {
      writeContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [RECURRING_PAYMENTS_ADDRESS, amount],
      });
    } catch (e) {
      setLastError(humanizeWagmiError(e));
    }
  }

  async function onCreateSchedule() {
    if (!publicClient || !address) return;
    if (!isConfigured) return;
    setLastError("");

    if (!name || recipients.length === 0) {
      alert("Please enter a name and add recipients");
      return;
    }

    const recs = recipients.map((r) => r.address as Address);
    const amts = recipients.map((r) => parseUnits(r.amount, 6));

    const interval = BigInt(intervalSecondsFromFrequency(frequency));
    const firstRun = computeFirstRunUnix();

    setStatus("Creating schedule...");

    writeContract({
      address: RECURRING_PAYMENTS_ADDRESS,
      abi: RECURRING_ABI,
      functionName: "createSchedule",
      args: [USDC_ADDRESS, name, recs, amts, interval, firstRun],
    });

    // We don't get the scheduleId easily without parsing logs; store name after next reload if it appears.
    // Best-effort: set name for the next id (count+1) after confirmation.
    try {
      const count = (await publicClient.readContract({
        address: RECURRING_PAYMENTS_ADDRESS,
        abi: RECURRING_ABI,
        functionName: "scheduleCount",
      })) as bigint;
      setLocalScheduleName(count + 1n, name);
    } catch {
      // ignore
    }

    setShowCreateForm(false);
    setName("");
    setRecipients([]);
  }

  function onToggleActive(scheduleId: bigint, active: boolean) {
    setLastError("");
    writeContract({
      address: RECURRING_PAYMENTS_ADDRESS,
      abi: RECURRING_ABI,
      functionName: "toggleActive",
      args: [scheduleId, active],
    });
  }

  function onDelete(scheduleId: bigint) {
    if (!confirm("Delete this schedule?")) return;
    setLastError("");
    writeContract({
      address: RECURRING_PAYMENTS_ADDRESS,
      abi: RECURRING_ABI,
      functionName: "deleteSchedule",
      args: [scheduleId],
    });
  }

  function onExecute(scheduleId: bigint) {
    setLastError("");
    try {
      writeContract({
        address: RECURRING_PAYMENTS_ADDRESS,
        abi: RECURRING_ABI,
        functionName: "execute",
        args: [scheduleId],
      });
    } catch (e) {
      setLastError(humanizeWagmiError(e));
    }
  }

  const needsApproval = !hasSufficientAllowance;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Recurring Payments</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-gradient-to-r from-[#ff7582] to-[#725a7a] hover:opacity-90 rounded-lg font-medium transition-opacity"
            disabled={!isConfigured || isBusy}
          >
            {showCreateForm ? "Cancel" : "New Schedule"}
          </button>
        </div>
      </div>

      {!isConfigured && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-sm text-yellow-300">
            RecurringPayments contract not configured.
          </p>
        </div>
      )}

      {status && (
        <div className="text-sm text-gray-400">{status}</div>
      )}

      {lastError && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-300">{lastError}</p>
        </div>
      )}

      {showCreateForm && (
        <div className="p-6 bg-white/5 border border-white/10 rounded-lg space-y-4">
          <h3 className="text-lg font-medium">Create Schedule</h3>

          <div>
            <label className="block text-sm font-medium mb-2">Schedule Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/15 rounded-lg focus:border-[#ff7582] focus:outline-none placeholder:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as any)}
              className="w-full px-4 py-2 bg-white/10 border border-white/15 rounded-lg focus:border-[#ff7582] focus:outline-none"
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/15 rounded-lg focus:border-[#ff7582] focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Recipients</label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mb-3">
              <div className="md:col-span-6">
                <input
                  type="text"
                  placeholder="Recipient address (0x...)"
                  value={newRecipientAddress}
                  onChange={(e) => setNewRecipientAddress(e.target.value)}
                  className="w-full px-4 py-2 bg-white/10 border border-white/15 rounded-lg focus:border-[#ff7582] focus:outline-none font-mono text-sm placeholder:text-gray-500"
                />
              </div>
              <div className="md:col-span-3">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Amount (USDC)"
                  value={newRecipientAmount}
                  onChange={(e) => setNewRecipientAmount(e.target.value)}
                  className="w-full px-4 py-2 bg-white/10 border border-white/15 rounded-lg focus:border-[#ff7582] focus:outline-none placeholder:text-gray-500"
                />
              </div>
              <div className="md:col-span-2">
                <input
                  type="text"
                  placeholder="Label (optional)"
                  value={newRecipientLabel}
                  onChange={(e) => setNewRecipientLabel(e.target.value)}
                  className="w-full px-4 py-2 bg-white/10 border border-white/15 rounded-lg focus:border-[#ff7582] focus:outline-none placeholder:text-gray-500"
                />
              </div>
              <div className="md:col-span-1">
                <button
                  type="button"
                  onClick={addRecipientInline}
                  disabled={!newRecipientAddress.trim() || !newRecipientAmount.trim() || isBusy}
                  className="w-full h-full px-3 py-2 bg-white/10 hover:bg-white/15 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
            </div>

            {recipients.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No recipients added yet</p>
            ) : (
              <div className="space-y-2">
                {recipients.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div>
                      <p className="font-mono text-sm">{formatAddress(r.address as Address)}</p>
                      {r.label && <p className="text-xs text-gray-400">{r.label}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-medium">{r.amount} USDC</p>
                      <button
                        type="button"
                        onClick={() => removeRecipient(r.id)}
                        disabled={isBusy}
                        className="text-xs text-red-300 hover:text-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Remove recipient"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                <div className="text-sm text-gray-400 text-right pt-2">
                  Total per run: {formatUSDC(totalPerRun)} USDC
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onApproveExact(totalPerRun)}
              disabled={!isConfigured || isBusy || totalPerRun === 0n}
              className="flex-1 py-3 bg-white/10 hover:bg-gray-200/20 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Approve exactly the total per run amount"
            >
              {isBusy ? "Confirming..." : `Approve (${formatUSDC(totalPerRun)} USDC)`}
            </button>
            <button
              onClick={onCreateSchedule}
              disabled={!isConfigured || isBusy || !name || recipients.length === 0}
              className="flex-1 py-3 bg-gradient-to-r from-[#ff7582] to-[#725a7a] hover:opacity-90 rounded-lg font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBusy ? "Confirming..." : "Create"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Your Schedules</h3>

        {scheduledPayments.length === 0 ? (
          <div className="p-12 bg-white/5 border border-white/10 rounded-lg text-center">
            <img src="/chain-icons/browser.svg" alt="Browser" className="h-12 w-12 mx-auto mb-4 opacity-80" />
            <p className="text-gray-400">No schedules yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {scheduledPayments.map((s) => {
              const total = s.amounts.reduce((acc, x) => acc + x, 0n);
              const nextRunDate = new Date(Number(s.nextRun) * 1000);
              const canExecute = s.active && nowSec >= Number(s.nextRun);
              const secondsLeft = Math.max(0, Number(s.nextRun) - nowSec);
              return (
                <div
                  key={s.id.toString()}
                  className="p-4 bg-white/5 border border-white/10 rounded-lg hover:border-[#ff7582]/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{s.name}</h4>
                        {s.active ? (
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
                        <p>Payer: <span className="font-mono">{formatAddress(s.payer)}</span></p>
                        <p>Token: <span className="font-mono">{formatAddress(s.token)}</span></p>
                        <p>Interval: {formatDuration(Number(s.intervalSeconds))}</p>
                        <p>Next run: {nextRunDate.toLocaleString()}</p>
                        <p>Recipients: {s.recipients.length}</p>
                        <p>Total per run: {formatUSDC(total)} USDC</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 min-w-[160px]">
                      <button
                        onClick={() => onExecute(s.id)}
                        disabled={!isConfigured || isBusy || !canExecute}
                        className="w-full py-2 bg-gradient-to-r from-[#ff7582] to-[#725a7a] hover:opacity-90 rounded-lg font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {canExecute ? "Execute" : secondsLeft > 0 ? `Execute in ${formatDuration(secondsLeft)}` : "Execute"}
                      </button>

                      <div className="flex gap-2">
                        <button
                          onClick={() => onToggleActive(s.id, !s.active)}
                          disabled={!isConfigured || isBusy}
                          className="flex-1 py-2 bg-white/10 hover:bg-white/15 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {s.active ? "Pause" : "Resume"}
                        </button>
                        <button
                          onClick={() => onDelete(s.id)}
                          disabled={!isConfigured || isBusy}
                          className="flex-1 py-2 bg-white/10 hover:bg-white/15 rounded-lg font-medium transition-colors text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
