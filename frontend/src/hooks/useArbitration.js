import { useEffect, useState } from "react";

export function useArbitration(multisig, address) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [hasVoted, setHasVoted] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [votesForFreelancer, setVotesForFreelancer] = useState(0);
  const [votesForClient, setVotesForClient] = useState(0);
  const [required, setRequired] = useState(0);

  async function refresh() {
    if (!multisig) return;

    try {
      const [
        _hasVoted,
        _resolved,
        _votesForFreelancer,
        _votesForClient,
        _required,
      ] = await Promise.all([
        multisig.hasVoted(address),
        multisig.resolved(),
        multisig.votesForFreelancer(),
        multisig.votesForClient(),
        multisig.required(),
      ]);

      setHasVoted(_hasVoted);
      setResolved(_resolved);
      setVotesForFreelancer(Number(_votesForFreelancer));
      setVotesForClient(Number(_votesForClient));
      setRequired(Number(_required));
    } catch (e) {
      console.error(e);
    }
  }

  async function vote(payFreelancer) {
    if (!multisig) return;

    try {
      setLoading(true);
      setError(null);

      const tx = await multisig.vote(payFreelancer);
      await tx.wait();

      await refresh();
    } catch (err) {
      setError(err.reason || err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [multisig, address]);

  return {
    vote,
    loading,
    error,
    hasVoted,
    resolved,
    votesForFreelancer,
    votesForClient,
    required,
    refresh,
  };
}
