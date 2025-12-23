import { STATUS } from "../utils/status";
import { ethers } from "ethers";

export default function JobCard({ job, onSelect }) {
  const s = STATUS[job.status];

  return (
    <div className="border rounded-lg p-4 shadow hover:shadow-md">
      <div className="flex justify-between">
        <span className={`px-2 py-1 text-sm rounded ${s.color}`}>
          {s.label}
        </span>
        <span className="font-semibold">
          {ethers.formatEther(job.amount)} ETH
        </span>
      </div>

      <p className="text-sm mt-2 text-gray-600">
        Job: {job.address.slice(0, 10)}...
      </p>

      <p className="text-sm">
        Deadline:{" "}
        {new Date(job.deadline * 1000).toLocaleString()}
      </p>

      <button
        className="mt-3 w-full bg-black text-white py-1 rounded"
        onClick={() => onSelect(job.address)}
      >
        View Detail
      </button>
    </div>
  );
}
