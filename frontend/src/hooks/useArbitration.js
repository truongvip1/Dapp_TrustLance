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
    if (!multisig || !address) return;

    try {
      const addr = ethers.getAddress(address);

      setHasVoted(await multisig.hasVoted(escrowAddr, addr));
      setResolved(await multisig.resolved(escrowAddr));

      const [f, c, r] = await multisig.getVotes(escrowAddr);
      setVotesForFreelancer(Number(f));
      setVotesForClient(Number(c));
      setRequired(Number(r));
    } catch (e) {
      console.error(e);
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
