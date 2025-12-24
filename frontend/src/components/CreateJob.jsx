import { useState } from "react";
import { getFactory } from "../lib/contracts";
import { ethers } from "ethers";

/* ----------------------------------
 * Human date → epoch (UTC)
 * ---------------------------------- */
function toTimestampUTC(
  year,
  month,
  day,
  hour,
  minute,
  second
) {
  return Math.floor(
    Date.UTC(year, month - 1, day, hour, minute, second) / 1000
  );
}

export default function CreateJob({ signer, onCreated }) {
  const [amount, setAmount] = useState("0.1");

  // time input
  const [year, setYear] = useState(2025);
  const [month, setMonth] = useState(12);
  const [day, setDay] = useState(24);
  const [hour, setHour] = useState(4);
  const [minute, setMinute] = useState(38);
  const [second, setSecond] = useState(59);

  async function create() {
    const deadline = toTimestampUTC(
      year, month, day, hour, minute, second
    );

    const now = Math.floor(Date.now() / 1000);

    if (deadline <= now) {
      alert("❌ Deadline must be in the future");
      return;
    }

    const factory = getFactory(signer);

    const tx = await factory.createJob(deadline, {
      value: ethers.parseEther(amount),
    });

    await tx.wait();
    onCreated();
  }

return (
  <div className="bg-white rounded-xl shadow p-6 space-y-5">
    <h3 className="text-lg font-semibold flex items-center gap-2">
      ➕ Create Job
    </h3>

    {/* Amount */}
    <div>
      <label className="text-sm text-gray-600">Escrow Amount (ETH)</label>
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring"
        placeholder="0.1"
      />
    </div>

    {/* Deadline */}
    <div>
      <label className="text-sm text-gray-600">Deadline (UTC)</label>

      <div className="grid grid-cols-6 gap-2 mt-1">
        <input className="input" value={year} onChange={e=>setYear(+e.target.value)} placeholder="YYYY"/>
        <input className="input" value={month} onChange={e=>setMonth(+e.target.value)} placeholder="MM"/>
        <input className="input" value={day} onChange={e=>setDay(+e.target.value)} placeholder="DD"/>
        <input className="input" value={hour} onChange={e=>setHour(+e.target.value)} placeholder="HH"/>
        <input className="input" value={minute} onChange={e=>setMinute(+e.target.value)} placeholder="MM"/>
        <input className="input" value={second} onChange={e=>setSecond(+e.target.value)} placeholder="SS"/>
      </div>

      <p className="text-xs text-gray-500 mt-1">
        UTC: {year}-{month}-{day} {hour}:{minute}:{second}
      </p>
    </div>

    {/* Submit */}
    <button
      onClick={create}
      className="w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800 transition"
    >
      Create Job
    </button>
  </div>
);

}
