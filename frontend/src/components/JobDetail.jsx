import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { STATUS } from "../utils/status";
import ArbiterPanel from "./ArbiterPanel";

function short(addr) {
  if (!addr || addr === ethers.ZeroAddress) return "—";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export default function JobDetail({
  escrow,
  multisig,
  job,
  address,
  arbiters,
  refresh,
}) {
  const s = STATUS[job.status];
  const [loading, setLoading] = useState(false);
  const [chainNow, setChainNow] = useState(0);

  /* ----------------------------------
   * POLL BLOCKCHAIN TIME
   * ---------------------------------- */
  useEffect(() => {
    if (!window.ethereum) return;

    const provider = new ethers.BrowserProvider(window.ethereum);
    let mounted = true;

    async function tick() {
      try {
        const block = await provider.getBlock("latest");
        if (mounted) setChainNow(Number(block.timestamp));
      } catch (e) {
        console.error("Load chain time failed", e);
      }
    }

    tick();
    const id = setInterval(tick, 10_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [job.address]);

  /* ---------------------------------- */
  const isClient =
    address?.toLowerCase() === job.client.toLowerCase();

  const isFreelancer =
    address?.toLowerCase() === job.freelancer.toLowerCase();

  const isArbiter = arbiters
    .map(a => a.toLowerCase())
    .includes(address?.toLowerCase());

  const isOpen =
    job.status === 0 &&
    job.freelancer === ethers.ZeroAddress;

  const isSubmitted = job.status === 2;
  const isDisputed = job.status === 3;

  const deadlinePassed =
    chainNow > 0 && chainNow > job.deadline;

  async function handle(action, fn) {
    try {
      setLoading(true);
      const tx = await fn();
      await tx.wait();
      await refresh();
    } catch (e) {
      console.error(action, e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border rounded-xl p-6 space-y-4">
      <h2 className="text-xl font-bold">Job Detail</h2>

      {/* STATUS */}
      <div className="flex gap-2 items-center">
        <span className={`px-2 py-1 rounded ${s.color}`}>
          {s.label}
        </span>

        {deadlinePassed && (
          <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
            Deadline Passed
          </span>
        )}
      </div>

      {/* INFO */}
      <div className="text-sm space-y-1">
        <p>
          <b>Client:</b>{" "}
          <span className="font-mono">{short(job.client)}</span>
        </p>

        <p>
          <b>Freelancer:</b>{" "}
          <span className="font-mono">
            {job.freelancer === ethers.ZeroAddress
              ? "Not accepted"
              : short(job.freelancer)}
          </span>
        </p>

        <p>
          <b>Amount:</b>{" "}
          {ethers.formatEther(job.amount)} ETH
        </p>

        <p>
          <b>Deadline:</b>{" "}
          {new Date(job.deadline * 1000).toLocaleString()}
        </p>

        <p className="text-xs text-gray-500">
          ⛓ Chain time:{" "}
          {chainNow
            ? new Date(chainNow * 1000).toLocaleString()
            : "Loading..."}
        </p>
      </div>

      {/* ACTIONS */}
      <div className="space-y-2">
        {isOpen && (
          <button
            disabled={loading}
            className="btn-primary"
            onClick={() =>
              handle("ACCEPT_JOB", () => escrow.acceptJob())
            }
          >
            Accept Job
          </button>
        )}

        {isFreelancer && job.status === 1 && (
          <button
            disabled={loading}
            className="btn-primary"
            onClick={() =>
              handle("SUBMIT_WORK", () => escrow.submitWork())
            }
          >
            Submit Work
          </button>
        )}

        {isClient && isSubmitted && (
          <>
            {!deadlinePassed && (
              <button
                className="bg-blue-100 px-3 py-2 rounded"
                onClick={() =>
                  handle("APPROVE", () => escrow.approveWork())
                }
              >
                Approve & Release
              </button>
            )}

            {deadlinePassed && (
              <button
                className="bg-red-100 px-3 py-2 rounded"
                onClick={() =>
                  handle("DISPUTE", () => escrow.dispute())
                }
              >
                Open Dispute
              </button>
            )}
          </>
        )}
      </div>

      {/* ARBITER */}
      {isArbiter && isDisputed && (
        <ArbiterPanel
          multisig={multisig}
          escrowAddr={job.address}
          address={address}
        />
      )}
    </div>
  );
}
