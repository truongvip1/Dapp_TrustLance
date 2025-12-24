// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/* ---------------------------------------------
 * Interface của FreelanceEscrow
 * -------------------------------------------*/
interface IFreelanceEscrow {
    function resolveDispute(bool payFreelancer) external;
}

/* ---------------------------------------------
 * DisputeMultiSig
 * -------------------------------------------*/
contract DisputeMultiSig {
    address[] public arbiters;
    mapping(address => bool) public isArbiter;

    uint256 public required; // số phiếu cần để quyết định

    address public escrow;   // escrow đang được phân xử
    bool public resolved;

    uint256 public votesForFreelancer;
    uint256 public votesForClient;

    mapping(address => bool) public hasVoted;

    /* ---------------------------------------------
     * Events
     * -------------------------------------------*/
    event Voted(address indexed arbiter, bool payFreelancer);
    event Resolved(bool payFreelancer);

    /* ---------------------------------------------
     * Modifiers
     * -------------------------------------------*/
    modifier onlyArbiter() {
        require(isArbiter[msg.sender], "Not an arbiter");
        _;
    }

    /* ---------------------------------------------
     * Constructor
     * -------------------------------------------*/
    constructor(address[] memory _arbiters, uint256 _required) {
        require(_arbiters.length > 0, "No arbiters");
        require(
            _required > 0 && _required <= _arbiters.length,
            "Invalid required votes"
        );

        for (uint256 i = 0; i < _arbiters.length; i++) {
            address arbiter = _arbiters[i];
            require(arbiter != address(0), "Zero arbiter");
            require(!isArbiter[arbiter], "Duplicate arbiter");

            arbiters.push(arbiter);
            isArbiter[arbiter] = true;
        }

        required = _required;
    }

    /* ---------------------------------------------
     * Set escrow (BẮT BUỘC PHẢI GỌI SAU DEPLOY)
     * -------------------------------------------*/
    function setEscrow(address _escrow) external {
        require(escrow == address(0), "Escrow already set");
        require(_escrow.code.length > 0, "Escrow must be a contract");

        escrow = _escrow;
    }

    /* ---------------------------------------------
     * Vote
     * -------------------------------------------*/
    function vote(bool payFreelancer) external onlyArbiter {
        require(!resolved, "Dispute already resolved");
        require(!hasVoted[msg.sender], "Already voted");
        require(escrow != address(0), "Escrow not set");

        hasVoted[msg.sender] = true;

        if (payFreelancer) {
            votesForFreelancer++;
        } else {
            votesForClient++;
        }

        emit Voted(msg.sender, payFreelancer);

        /* -----------------------------------------
         * Resolve if reached required votes
         * ---------------------------------------*/
        if (votesForFreelancer >= required) {
            resolved = true;
            IFreelanceEscrow(escrow).resolveDispute(true);
            emit Resolved(true);
        } else if (votesForClient >= required) {
            resolved = true;
            IFreelanceEscrow(escrow).resolveDispute(false);
            emit Resolved(false);
        }
    }

    /* ---------------------------------------------
     * View helpers
     * -------------------------------------------*/
    function getArbiters() external view returns (address[] memory) {
        return arbiters;
    }
}
