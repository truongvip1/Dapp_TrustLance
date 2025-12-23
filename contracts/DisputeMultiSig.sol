// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFreelanceEscrow {
    function resolveDispute(bool payFreelancer) external;
}

contract DisputeMultiSig {
    address[] public arbiters;
    mapping(address => bool) public isArbiter;

    uint256 public required;
    address public escrow;

    mapping(address => bool) public hasVoted;
    uint256 public votesForFreelancer;
    uint256 public votesForClient;
    bool public resolved;

    modifier onlyArbiter() {
        require(isArbiter[msg.sender], "Not arbiter");
        _;
    }

    modifier onlyEscrow() {
        require(msg.sender == escrow, "Only escrow");
        _;
    }

    constructor(address[] memory _arbiters, uint256 _required) {
        require(_arbiters.length >= _required, "Invalid required");

        for (uint i = 0; i < _arbiters.length; i++) {
            isArbiter[_arbiters[i]] = true;
        }

        arbiters = _arbiters;
        required = _required;
    }

    /// @notice Gán escrow sau khi deploy (chỉ làm 1 lần)
    function setEscrow(address _escrow) external {
        require(escrow == address(0), "Escrow already set");
        escrow = _escrow;
    }

    /// @notice Arbiter vote
    /// @param payFreelancer true = trả freelancer, false = refund client
    function vote(bool payFreelancer) external onlyArbiter {
        require(!resolved, "Already resolved");
        require(!hasVoted[msg.sender], "Already voted");

        hasVoted[msg.sender] = true;

        if (payFreelancer) {
            votesForFreelancer++;
            if (votesForFreelancer >= required) {
                resolved = true;
                IFreelanceEscrow(escrow).resolveDispute(true);
            }
        } else {
            votesForClient++;
            if (votesForClient >= required) {
                resolved = true;
                IFreelanceEscrow(escrow).resolveDispute(false);
            }
        }
    }
}
