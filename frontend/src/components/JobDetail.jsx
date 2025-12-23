import { ethers } from "ethers";
import { STATUS } from "../utils/status";

export default function JobDetail({
  escrow,
  job,
  address,
  refresh,
}) {
  const s = STATUS[job.status];
  const isClient = address === job.client;
  const isFreelancer = address === job.freelancer;
  const now = Date.now() / 1000;

  return (
    <div className="border rounded-xl p-6 space-y-4">
      <h2 className="text-xl font-bold">Job Detail</h2>

      <div className="flex gap-2">
        <span className={`px-2 py-1 rounded ${s.color}`}>
          {s.label}
        </span>
        {now > job.deadline && (
          <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
            Deadline Passed
          </span>
        )}
      </div>

      <div className="text-sm space-y-1">
        <p><b>Client:</b> {job.client}</p>
        <p><b>Freelancer:</b> {job.freelancer || "None"}</p>
        <p><b>Amount:</b> {ethers.formatEther(job.amount)} ETH</p>
        <p><b>Deadline:</b> {new Date(job.deadline * 1000).toLocaleString()}</p>
      </div>

      {/* ACTIONS */}
      <div className="space-y-2">
        {job.status === 0 && !job.freelancer && (
          <button
            className="btn-primary"
            onClick={async () => {
              await (await escrow.acceptJob()).wait();
              refresh();
            }}
          >
            Accept Job
          </button>
        )}

        {isFreelancer && job.status === 1 && (
          <button
            className="btn-primary"
            onClick={async () => {
              await (await escrow.submitWork()).wait();
              refresh();
            }}
          >
            Submit Work
          </button>
        )}

        {isClient && job.status === 2 && (
          <>
            <button
              className="btn-success"
              onClick={async () => {
                await (await escrow.approveWork()).wait();
                refresh();
              }}
            >
              Approve & Release Payment
            </button>

            {now > job.deadline && (
              <button
                className="btn-danger"
                onClick={async () => {
                  await (await escrow.dispute()).wait();
                  refresh();
                }}
              >
                Open Dispute
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
