import { STATUS } from "../utils/status";
import { ethers } from "ethers";

export default function JobCard({ job, onSelect }) {
  const s = STATUS[job.status];

  // Local-time based (OK for list view)
  const deadlinePassed =
    Date.now() / 1000 > Number(job.deadline);

  return (
    <div className="bg-white rounded-xl shadow p-4 space-y-2">
      <div className="flex justify-between items-center">
        <div className="flex gap-2 items-center">
          <span className={`px-2 py-1 text-xs rounded ${s.color}`}>
            {s.label}
          </span>

          {deadlinePassed && job.status < 3 && (
            <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-700">
              Overdue
            </span>
          )}
        </div>

        <span className="font-semibold">
          {ethers.formatEther(job.amount)} ETH
        </span>
      </div>

      <p className="text-xs text-gray-500 break-all">
        Job: {job.address.slice(0, 10)}...
      </p>

      <p className="text-xs text-gray-600">
        Deadline:{" "}
        {new Date(job.deadline * 1000).toLocaleString()}
      </p>

      <button
        onClick={() => onSelect(job.address)}
        className="w-full mt-2 bg-black text-white py-1.5 rounded"
      >
        View Detail
      </button>
    </div>
  );
}
