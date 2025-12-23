// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./FreelanceEscrow.sol";

contract EscrowFactory {
    /// @notice Danh sách tất cả job (escrow address)
    address[] public jobs;

    /// @notice Mapping client => list job của client
    mapping(address => address[]) public jobsByClient;

    /// @notice Event để frontend index job
    event JobCreated(
        address indexed escrow,
        address indexed client,
        uint256 amount,
        uint256 deadline,
        uint256 timestamp
    );

    /**
     * @notice Client tạo job mới
     * @param deadline timestamp deadline
     */
    function createJob(uint256 deadline) external payable returns (address) {
        require(msg.value > 0, "Amount must be > 0");
        require(deadline > block.timestamp, "Invalid deadline");

        // Deploy escrow instance
        FreelanceEscrow escrow = new FreelanceEscrow();

        // Init escrow (factory là msg.sender của constructor)
        escrow.init{value: msg.value}(
            msg.sender,
            deadline
        );

        address escrowAddr = address(escrow);

        jobs.push(escrowAddr);
        jobsByClient[msg.sender].push(escrowAddr);

        emit JobCreated(
            escrowAddr,
            msg.sender,
            msg.value,
            deadline,
            block.timestamp
        );

        return escrowAddr;
    }

    /// @notice Tổng số job
    function totalJobs() external view returns (uint256) {
        return jobs.length;
    }

    /// @notice Lấy job theo index
    function getJob(uint256 index) external view returns (address) {
        require(index < jobs.length, "Index out of bounds");
        return jobs[index];
    }

    /// @notice Lấy toàn bộ job
    function getAllJobs() external view returns (address[] memory) {
        return jobs;
    }

    /// @notice Lấy job của 1 client
    function getJobsByClient(address client)
        external
        view
        returns (address[] memory)
    {
        return jobsByClient[client];
    }
}
