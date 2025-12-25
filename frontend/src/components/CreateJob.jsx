import { useState } from "react";
import { getFactory } from "../lib/contracts";
import { ethers } from "ethers";

function utcToTimestamp(year, month, day, hour, minute, second = 0) {
  return Math.floor(
    Date.UTC(year, month - 1, day, hour, minute, second) / 1000
  );
}

export default function CreateJob({ signer, onCreated }) {
  const [amount, setAmount] = useState("0.1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const now = new Date();

  // ⚠️ LẤY GIÁ TRỊ UTC
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [day, setDay] = useState(now.getUTCDate());
  const [hour, setHour] = useState(now.getUTCHours() + 1);
  const [minute, setMinute] = useState(now.getUTCMinutes());
  const [second, setSecond] = useState(0);

  const deadline = utcToTimestamp(year, month, day, hour, minute, second);
  const nowUtc = Math.floor(Date.now() / 1000);

  async function create() {
    if (!signer) return alert("⚠️ Please connect wallet");

    if (deadline <= nowUtc)
      return alert("❌ Deadline must be in the future (UTC)");

    let value;
    try {
      value = ethers.parseEther(amount);
      if (value === 0n) throw new Error();
    } catch {
      return alert("❌ Invalid ETH amount");
    }

    try {
      setLoading(true);
      setError(null);

      const factory = getFactory(signer);
      const tx = await factory.createJob(deadline, { value });
      console.log("Transaction sent:", tx.hash);
      await tx.wait();

      alert("✅ Job created successfully!");
      onCreated?.();
    } catch (e) {
      console.error(e);
      const msg =
        e.reason || e.data?.message || e.message || "Transaction failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 space-y-6 max-w-md mx-auto">
      <h3 className="text-xl font-bold flex items-center gap-2">
        ⏱️ Create Job (UTC Time)
      </h3>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Escrow Amount (ETH)
        </label>
        <input
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black"
        />
      </div>

      {/* UTC Deadline */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Deadline (UTC)
        </label>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <input type="number" value={year} onChange={e => setYear(+e.target.value)} placeholder="YYYY" className="px-3 py-2 border rounded-lg text-center" />
          <input type="number" value={month} onChange={e => setMonth(+e.target.value)} placeholder="MM" className="px-3 py-2 border rounded-lg text-center" />
          <input type="number" value={day} onChange={e => setDay(+e.target.value)} placeholder="DD" className="px-3 py-2 border rounded-lg text-center" />
          <input type="number" value={hour} onChange={e => setHour(+e.target.value)} placeholder="HH" className="px-3 py-2 border rounded-lg text-center" />
          <input type="number" value={minute} onChange={e => setMinute(+e.target.value)} placeholder="MM" className="px-3 py-2 border rounded-lg text-center" />
          <input type="number" value={second} onChange={e => setSecond(+e.target.value)} placeholder="SS" className="px-3 py-2 border rounded-lg text-center" />
        </div>

        <p className="text-sm text-indigo-600 mt-2">
          On-chain UTC:{" "}
          {deadline > 0
            ? new Date(deadline * 1000).toUTCString()
            : "Invalid"}
        </p>
      </div>

      {/* Submit */}
      <button
        onClick={create}
        disabled={loading || deadline <= nowUtc}
        className="w-full bg-black text-white py-3 rounded-lg hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? "⏳ Creating..." : "Create Job & Lock ETH"}
      </button>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          ❌ {error}
        </p>
      )}
    </div>
  );
}
