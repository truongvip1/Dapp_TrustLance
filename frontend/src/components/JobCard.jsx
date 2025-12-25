import { STATUS } from "../utils/status";
import { ethers } from "ethers";

export default function JobCard({ job, onSelect }) {
  const s = STATUS[job.status];

  // Local-time based (OK for list view)
  const deadlinePassed =
    Date.now() / 1000 > Number(job.deadline);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3 hover:shadow-md transition-shadow duration-200">
      {/* Header row */}
      <div className="flex justify-between items-start">
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${s.color}`}>
            {s.label}
          </span>

          {deadlinePassed && job.status < 4 && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
              ⏰ Overdue
            </span>
          )}
        </div>

        <span className="font-bold text-emerald-600">
          {ethers.formatEther(job.amount)} ETH
        </span>
      </div>

      {/* Job address */}
      <p className="text-xs text-gray-400 font-mono">
        📋 {job.address.slice(0, 8)}...{job.address.slice(-6)}
      </p>

      {/* Deadline */}
      <p className="text-xs text-gray-600 flex items-center gap-1">
        <span>📅</span>
        {new Date(job.deadline * 1000).toLocaleDateString()}{" "}
        <span className="text-gray-400">
          {new Date(job.deadline * 1000).toLocaleTimeString()}
        </span>
      </p>

      {/* Button */}
      <button
        onClick={() => onSelect(job.address)}
        className="w-full mt-1 bg-gray-900 hover:bg-gray-800 text-white py-2 rounded-lg text-sm font-medium transition-colors duration-200"
      >
        View Detail →
      </button>
    </div>
  );
}
