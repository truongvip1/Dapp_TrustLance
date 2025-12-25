import { useArbitration } from "../hooks/useArbitration";

export default function ArbiterPanel({
  multisig,
  escrowAddr,
  address, // current wallet address
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
  } = useArbitration(multisig, escrowAddr, address);

  return (
    <div className="border p-4 rounded-xl mt-4 bg-yellow-50 space-y-3">
      <h3 className="font-bold text-lg flex items-center gap-2">
        ⚖️ Arbiter Voting
      </h3>

      {/* RESOLVED */}
      {resolved && (
        <div className="p-2 bg-green-100 text-green-800 rounded">
          ✅ Dispute resolved
        </div>
      )}

      {/* VOTE PROGRESS */}
      <div className="text-sm space-y-1">
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

      {/* ACTION BUTTONS */}
      {!resolved && (
        <div className="flex gap-3 pt-2">
          <button
            className="btn-success flex-1"
            disabled={loading || hasVoted}
            onClick={() => vote(true)}
          >
            {hasVoted ? "Voted" : "Pay Freelancer"}
          </button>

          <button
            className="btn-danger flex-1"
            disabled={loading || hasVoted}
            onClick={() => vote(false)}
          >
            {hasVoted ? "Voted" : "Refund Client"}
          </button>
        </div>
      )}

      {/* INFO */}
      {hasVoted && !resolved && (
        <p className="text-sm text-gray-600">
          🗳️ You have already voted on this dispute
        </p>
      )}

      {loading && (
        <p className="text-sm text-blue-600">
          ⏳ Submitting vote...
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600">
          ❌ {error}
        </p>
      )}
    </div>
  );
}
