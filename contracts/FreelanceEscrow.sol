// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FreelanceEscrow {
    /* --------------------------------------------------
     * STORAGE
     * -------------------------------------------------- */
    address public factory;

    address payable public client;
    address payable public freelancer;

    uint256 public amount;
    uint256 public deadline;

    address public arbiter;

    enum Status {
        Created,
        Accepted,
        Submitted,
        Released,
        Refunded,
        Disputed
    }

    Status public status;

    /* --------------------------------------------------
     * MODIFIERS
     * -------------------------------------------------- */
    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    modifier onlyClient() {
        require(msg.sender == client, "Not client");
        _;
    }

    modifier onlyArbiter() {
        require(msg.sender == arbiter, "Not arbiter");
        _;
    }

    /* --------------------------------------------------
     * CONSTRUCTOR
     * -------------------------------------------------- */
    constructor() {
        factory = msg.sender;
    }

    /* --------------------------------------------------
     * INITIALIZATION (CALLED BY FACTORY)
     * -------------------------------------------------- */
    function init(
        address _client,
        uint256 _deadline
    ) external payable onlyFactory {
        require(client == address(0), "Already initialized");
        require(_deadline > block.timestamp, "Invalid deadline");
        require(msg.value > 0, "Amount must be > 0");

        client = payable(_client);
        amount = msg.value;
        deadline = _deadline;
        status = Status.Created;
    }

    /* --------------------------------------------------
     * SETUP
     * -------------------------------------------------- */
    function setArbiter(address _arbiter) external onlyClient {
        require(arbiter == address(0), "Arbiter already set");
        arbiter = _arbiter;
    }

    /* --------------------------------------------------
     * FREELANCER FLOW
     * -------------------------------------------------- */
    function acceptJob() external {
        require(status == Status.Created, "Not open");
        require(freelancer == address(0), "Already accepted");

        freelancer = payable(msg.sender);
        status = Status.Accepted;
    }

    function submitWork() external {
        require(msg.sender == freelancer, "Not freelancer");
        require(status == Status.Accepted, "Invalid state");

        status = Status.Submitted;
    }

    /* --------------------------------------------------
     * CLIENT FLOW
     * -------------------------------------------------- */
    function approveWork() external onlyClient {
        require(status == Status.Submitted, "Not submitted");

        status = Status.Released;
        _payFreelancer();
    }

    function autoRelease() external onlyClient {
        require(status == Status.Submitted, "Invalid state");
        require(block.timestamp > deadline, "Deadline not reached");

        status = Status.Released;
        _payFreelancer();
    }

    function refundIfNoFreelancer() external onlyClient {
        require(status == Status.Created, "Already accepted");

        status = Status.Refunded;
        _refundClient();
    }

    function dispute() external onlyClient {
        require(
            status == Status.Accepted || status == Status.Submitted,
            "Invalid state"
        );
        require(block.timestamp > deadline, "Deadline not reached");

        status = Status.Disputed;
    }

    /* --------------------------------------------------
     * DISPUTE RESOLUTION (MULTISIG)
     * -------------------------------------------------- */
    function resolveDispute(bool payFreelancer) external onlyArbiter {
        require(status == Status.Disputed, "No dispute");

        if (payFreelancer) {
            status = Status.Released;
            _payFreelancer();
        } else {
            status = Status.Refunded;
            _refundClient();
        }
    }

    /* --------------------------------------------------
     * INTERNAL PAYMENTS
     * -------------------------------------------------- */
    function _payFreelancer() internal {
        (bool ok,) = freelancer.call{value: amount}("");
        require(ok, "Transfer failed");
    }

    function _refundClient() internal {
        (bool ok,) = client.call{value: amount}("");
        require(ok, "Transfer failed");
    }
}
