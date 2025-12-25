// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FreelanceEscrow {
    /* =====================================================
                            STORAGE
       =====================================================*/

    address public factory;

    address payable public client;
    address payable public freelancer;

    uint256 public amount;
    uint256 public deadline;

    /// @notice DisputeMultiSig contract
    address public arbiter;

    enum Status {
        Created,
        Accepted,
        Submitted,
        Disputed,
        Released,
        Refunded
    }

    Status public status;

    /* =====================================================
                            EVENTS
       =====================================================*/

    event JobAccepted(address indexed freelancer);
    event WorkSubmitted();
    event DisputeOpened();
    event Released(address indexed freelancer, uint256 amount);
    event Refunded(address indexed client, uint256 amount);

    /* =====================================================
                            MODIFIERS
       =====================================================*/

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    modifier onlyClient() {
        require(msg.sender == client, "Not client");
        _;
    }

    modifier onlyFreelancer() {
        require(msg.sender == freelancer, "Not freelancer");
        _;
    }

    modifier onlyArbiter() {
        require(msg.sender == arbiter, "Not arbiter");
        _;
    }

    /* =====================================================
                            CONSTRUCTOR
       =====================================================*/

    constructor() {
        factory = msg.sender;
    }

    /* =====================================================
                        INITIALIZATION
       =====================================================*/

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

    /* =====================================================
                            SETUP
       =====================================================*/

    /// @notice Factory gắn DisputeMultiSig
    function setArbiter(address _arbiter) external onlyFactory {
        require(arbiter == address(0), "Arbiter already set");
        require(_arbiter != address(0), "Invalid arbiter");

        arbiter = _arbiter;
    }

    /* =====================================================
                        FREELANCER FLOW
       =====================================================*/

    function acceptJob() external {
        require(status == Status.Created, "Not open");
        require(freelancer == address(0), "Already accepted");

        freelancer = payable(msg.sender);
        status = Status.Accepted;

        emit JobAccepted(msg.sender);
    }

    function submitWork() external onlyFreelancer {
        require(status == Status.Accepted, "Invalid state");

        status = Status.Submitted;
        emit WorkSubmitted();
    }

    /* =====================================================
                        CLIENT FLOW
       =====================================================*/

    function approveWork() external onlyClient {
    require(status == Status.Submitted, "Not submitted");
    require(block.timestamp <= deadline, "Deadline passed");

    status = Status.Released;
    _payFreelancer();
    }


    /// @notice Client mở dispute sau deadline
    function dispute() external onlyClient {
        require(status == Status.Submitted, "Not submitted");
        require(block.timestamp > deadline, "Deadline not reached");

        status = Status.Disputed;
        emit DisputeOpened();
    }

    /* =====================================================
                    DISPUTE RESOLUTION
       =====================================================*/

    /// @notice Called by DisputeMultiSig
    function resolveDispute(bool payFreelancer) external onlyArbiter {
        require(status == Status.Disputed, "No dispute");

        if (payFreelancer) {
            status = Status.Released;
            _payFreelancer();
            emit Released(freelancer, amount);
        } else {
            status = Status.Refunded;
            _refundClient();
            emit Refunded(client, amount);
        }
    }

    /* =====================================================
                        INTERNAL PAYMENTS
       =====================================================*/

    function _payFreelancer() internal {
        (bool ok,) = freelancer.call{value: amount}("");
        require(ok, "Transfer failed");
    }

    function _refundClient() internal {
        (bool ok,) = client.call{value: amount}("");
        require(ok, "Transfer failed");
    }
}
