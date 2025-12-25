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
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-800">📋 Job Detail</h2>
      </div>

      <div className="p-6 space-y-5">
        {/* STATUS */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${s.color}`}>
            {s.label}
          </span>

          {deadlinePassed && job.status < 4 && (
            <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-medium animate-pulse">
              ⏰ Deadline Passed
            </span>
          )}
        </div>

        {/* INFO */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-200">
            <span className="text-gray-500 font-medium">👤 Client</span>
            <span className="font-mono text-sm bg-white px-3 py-1 rounded-lg border">
              {short(job.client)}
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-200">
            <span className="text-gray-500 font-medium">💼 Freelancer</span>
            <span className="font-mono text-sm bg-white px-3 py-1 rounded-lg border">
              {job.freelancer === ethers.ZeroAddress
                ? <span className="text-gray-400 italic">Not accepted</span>
                : short(job.freelancer)}
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-200">
            <span className="text-gray-500 font-medium">💰 Amount</span>
            <span className="text-lg font-bold text-emerald-600">
              {ethers.formatEther(job.amount)} ETH
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-200">
            <span className="text-gray-500 font-medium">📅 Deadline</span>
            <span className="text-sm font-medium text-gray-700">
              {new Date(job.deadline * 1000).toLocaleString()}
            </span>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="text-gray-400 text-sm">⛓ Chain time</span>
            <span className="text-xs text-gray-400">
              {chainNow
                ? new Date(chainNow * 1000).toLocaleString()
                : "Loading..."}
            </span>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="space-y-3">
          {isOpen && (
            <button
              disabled={loading}
              className="btn-primary w-full py-3"
              onClick={() =>
                handle("ACCEPT_JOB", () => escrow.acceptJob())
              }
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Processing...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  ✋ Accept Job
                </span>
              )}
            </button>
          )}

          {isFreelancer && job.status === 1 && (
            <button
              disabled={loading}
              className="btn-success w-full py-3"
              onClick={() =>
                handle("SUBMIT_WORK", () => escrow.submitWork())
              }
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Submitting...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  📤 Submit Work
                </span>
              )}
            </button>
          )}

          {isClient && isSubmitted && (
            <div className="space-y-3">
              {/* Thông báo hướng dẫn */}
              <div className={`p-3 rounded-lg text-sm border ${
                deadlinePassed 
                  ? 'bg-amber-50 border-amber-200 text-amber-800' 
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}>
                {deadlinePassed ? (
                  <>
                    <p className="font-medium">⏰ Freelancer đã submit trễ deadline</p>
                    <p className="text-amber-600 mt-1">
                      Bạn có thể chấp nhận thanh toán hoặc mở tranh chấp để trọng tài xử lý.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">📤 Freelancer đã nộp công việc</p>
                    <p className="text-blue-600 mt-1">
                      Kiểm tra kết quả và chấp nhận thanh toán hoặc mở tranh chấp nếu không đạt yêu cầu.
                    </p>
                  </>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                {/* Nút Approve - luôn hiển thị khi work đã submit */}
                <button
                  disabled={loading}
                  className="btn-success flex-1 py-3"
                  onClick={() =>
                    handle("APPROVE", () => escrow.approveWork())
                  }
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Processing...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      ✅ Approve & Release
                    </span>
                  )}
                </button>

                {/* Nút Dispute - luôn hiển thị khi work đã submit */}
                <button
                  disabled={loading}
                  className="btn-danger flex-1 py-3"
                  onClick={() =>
                    handle("DISPUTE", () => escrow.dispute())
                  }
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Processing...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      ⚠️ Open Dispute
                    </span>
                  )}
                </button>
              </div>
            </div>
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
    </div>
  );
}
