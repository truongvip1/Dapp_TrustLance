import { useEffect, useState, useCallback } from "react";
import { ethers } from "ethers";

export function useArbitration(multisig, escrowAddr, address) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [hasVoted, setHasVoted] = useState(false);
  const [resolved, setResolved] = useState(false);

  const [votesForFreelancer, setVotesForFreelancer] = useState(0);
  const [votesForClient, setVotesForClient] = useState(0);
  const [required, setRequired] = useState(0);

  const load = useCallback(async () => {
    if (!multisig || !address || !escrowAddr) return;

    try {
      const addr = ethers.getAddress(address);

      // Check if this arbiter has voted
      setHasVoted(await multisig.hasVoted(escrowAddr, addr));

      // getVotes returns: (forFreelancer, forClient, resolved)
      const [forFreelancer, forClient, isResolved] = await multisig.getVotes(escrowAddr);
      setVotesForFreelancer(Number(forFreelancer));
      setVotesForClient(Number(forClient));
      setResolved(isResolved);

      // Get required votes count
      const req = await multisig.required();
      setRequired(Number(req));
    } catch (e) {
      console.error("useArbitration load error:", e);
    }
  }, [multisig, escrowAddr, address]);

  useEffect(() => {
    load();
  }, [load]);

  async function vote(payFreelancer) {
    try {
      setLoading(true);
      setError(null);

      const tx = await multisig.vote(escrowAddr, payFreelancer);
      await tx.wait();

      // 🔥 FIX QUAN TRỌNG NHẤT
      await load();
    } catch (e) {
      setError(e.reason || e.message);
    } finally {
      setLoading(false);
    }
  }

  return {
    vote,
    loading,
    error,
    hasVoted,
    resolved,
    votesForFreelancer,
    votesForClient,
    required,
  };
}
