// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/* ---------------------------------------------
 * Interface Escrow
 * -------------------------------------------*/
interface IFreelanceEscrow {
    function resolveDispute(bool payFreelancer) external;
}

/* ---------------------------------------------
 * DisputeMultiSig – Multi Escrow
 * -------------------------------------------*/
contract DisputeMultiSig {
    address[] public arbiters;
    mapping(address => bool) public isArbiter;

    uint256 public required;

    struct VoteState {
        uint256 votesForFreelancer;
        uint256 votesForClient;
        bool resolved;
        mapping(address => bool) hasVoted;
    }

    /// escrow => VoteState
    mapping(address => VoteState) private disputes;

    /* ---------------------------------------------
     * Events
     * -------------------------------------------*/
    event Voted(address indexed escrow, address indexed arbiter, bool payFreelancer);
    event Resolved(address indexed escrow, bool payFreelancer);

    modifier onlyArbiter() {
        require(isArbiter[msg.sender], "Not an arbiter");
        _;
    }

    constructor(address[] memory _arbiters, uint256 _required) {
        require(_arbiters.length > 0, "No arbiters");
        require(_required > 0 && _required <= _arbiters.length, "Invalid required");

        for (uint256 i = 0; i < _arbiters.length; i++) {
            address a = _arbiters[i];
            require(a != address(0), "Zero arbiter");
            require(!isArbiter[a], "Duplicate arbiter");

            arbiters.push(a);
            isArbiter[a] = true;
        }

        required = _required;
    }

    /* ---------------------------------------------
     * Vote on specific escrow
     * -------------------------------------------*/
    function vote(address escrow, bool payFreelancer) external {
        require(isArbiter[msg.sender], "Not an arbiter");

        VoteState storage v = disputes[escrow];

        require(!v.resolved, "Dispute already resolved");
        require(!v.hasVoted[msg.sender], "Already voted");

        v.hasVoted[msg.sender] = true;

        if (payFreelancer) {
            v.votesForFreelancer++;
        } else {
            v.votesForClient++;
        }

        emit Voted(escrow, msg.sender, payFreelancer);

        if (v.votesForFreelancer >= required) {
            v.resolved = true;
            IFreelanceEscrow(escrow).resolveDispute(true);
            emit Resolved(escrow, true);
        } 
        else if (v.votesForClient >= required) {
            v.resolved = true;
            IFreelanceEscrow(escrow).resolveDispute(false);
            emit Resolved(escrow, false);
        }
    }


    /* ---------------------------------------------
     * View helper for test / frontend
     * -------------------------------------------*/
    function getVotes(address escrow)
        external
        view
        returns (
            uint256 forFreelancer,
            uint256 forClient,
            bool resolved
        )
    {
        VoteState storage v = disputes[escrow];
        return (v.votesForFreelancer, v.votesForClient, v.resolved);
    }

    function hasVoted(address escrow, address arbiter)
        external
        view
        returns (bool)
    {
        return disputes[escrow].hasVoted[arbiter];
    }

    /// @notice Get all arbiters (for frontend)
    function getArbiters() external view returns (address[] memory) {
        return arbiters;
    }
}
