import { useArbitration } from "../hooks/useArbitration";

export default function ArbiterPanel({
  multisig,
  address,
}) {
  const {
    vote,
    loading,
    error,
    hasVoted,
    resolved,
    votesForFreelancer,
    votesForClient,
    required,
  } = useArbitration(multisig, address);

  return (
    <div className="border p-4 rounded mt-4 bg-yellow-50">
      <h3 className="font-bold text-lg mb-2">
        ⚖️ Arbiter Voting
      </h3>

      {/* STATUS */}
      {resolved && (
        <div className="p-2 bg-green-100 text-green-800 rounded mb-2">
          ✅ Dispute resolved
        </div>
      )}

      {/* VOTE PROGRESS */}
      <div className="text-sm mb-3">
        <p>
          Pay Freelancer:{" "}
          <b>
            {votesForFreelancer}/{required}
          </b>
        </p>
        <p>
          Refund Client:{" "}
          <b>
            {votesForClient}/{required}
          </b>
        </p>
      </div>

      {/* ACTIONS */}
      {!resolved && (
        <div className="flex gap-3">
          <button
            className="btn-success"
            disabled={loading || hasVoted}
            onClick={() => vote(true)}
          >
            {hasVoted ? "Voted" : "Pay Freelancer"}
          </button>

          <button
            className="btn-danger"
            disabled={loading || hasVoted}
            onClick={() => vote(false)}
          >
            {hasVoted ? "Voted" : "Refund Client"}
          </button>
        </div>
      )}

      {/* INFO */}
      {hasVoted && !resolved && (
        <p className="text-sm mt-2 text-gray-600">
          🗳️ You have already voted
        </p>
      )}

      {error && (
        <p className="text-red-600 text-sm mt-2">
          ❌ {error}
        </p>
      )}
    </div>
  );
}
