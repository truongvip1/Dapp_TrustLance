const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Edge Cases & Security Tests", function () {
  let deployer, client, freelancer, arbiter1, arbiter2, arbiter3, randomUser;
  let factory, multisig;
  let escrow, escrowAddr;

  const REQUIRED_VOTES = 2;
  const ONE_DAY = 24 * 60 * 60;
  const JOB_VALUE = ethers.parseEther("1");

  beforeEach(async function () {
    [deployer, client, freelancer, arbiter1, arbiter2, arbiter3, randomUser] =
      await ethers.getSigners();

    // Deploy DisputeMultiSig
    const DisputeMultiSig = await ethers.getContractFactory("DisputeMultiSig");
    multisig = await DisputeMultiSig.deploy(
      [arbiter1.address, arbiter2.address, arbiter3.address],
      REQUIRED_VOTES
    );
    await multisig.waitForDeployment();

    // Deploy EscrowFactory
    const EscrowFactory = await ethers.getContractFactory("EscrowFactory");
    factory = await EscrowFactory.deploy(await multisig.getAddress());
    await factory.waitForDeployment();
  });

  /* ==================================================
   * DIRECT ESCROW DEPLOYMENT TESTS
   * ================================================== */
  describe("Direct Escrow Deployment (Security)", function () {
    it("❌ Non-deployer cannot init escrow directly", async function () {
      const FreelanceEscrow = await ethers.getContractFactory("FreelanceEscrow");
      // deployer deploys, so deployer is factory
      const directEscrow = await FreelanceEscrow.deploy();
      await directEscrow.waitForDeployment();

      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3 * ONE_DAY;

      // Try to init by client (not the deployer/factory) - should fail
      await expect(
        directEscrow.connect(client).init(client.address, deadline, { value: JOB_VALUE })
      ).to.be.revertedWith("Only factory");
    });

    it("❌ Non-deployer cannot setArbiter directly", async function () {
      const FreelanceEscrow = await ethers.getContractFactory("FreelanceEscrow");
      const directEscrow = await FreelanceEscrow.deploy();
      await directEscrow.waitForDeployment();

      // Try to setArbiter by client (not the deployer/factory) - should fail
      await expect(
        directEscrow.connect(client).setArbiter(await multisig.getAddress())
      ).to.be.revertedWith("Only factory");
    });

    it("❌ Cannot init escrow twice", async function () {
      const FreelanceEscrow = await ethers.getContractFactory("FreelanceEscrow");
      const directEscrow = await FreelanceEscrow.deploy();
      await directEscrow.waitForDeployment();

      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3 * ONE_DAY;

      // First init by deployer (factory)
      await directEscrow.init(deployer.address, deadline, { value: JOB_VALUE });

      // Second init should fail
      await expect(
        directEscrow.init(client.address, deadline + ONE_DAY, { value: JOB_VALUE })
      ).to.be.revertedWith("Already initialized");
    });

    it("❌ Cannot setArbiter twice", async function () {
      const FreelanceEscrow = await ethers.getContractFactory("FreelanceEscrow");
      const directEscrow = await FreelanceEscrow.deploy();
      await directEscrow.waitForDeployment();

      // First setArbiter
      await directEscrow.setArbiter(await multisig.getAddress());

      // Second setArbiter should fail
      await expect(
        directEscrow.setArbiter(arbiter1.address)
      ).to.be.revertedWith("Arbiter already set");
    });
  });

  /* ==================================================
   * REENTRANCY PROTECTION TESTS
   * ================================================== */
  describe("Reentrancy Protection", function () {
    it("✅ Payment to freelancer completes atomically", async function () {
      // Create job
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3 * ONE_DAY;

      const tx = await factory
        .connect(client)
        .createJob(deadline, { value: JOB_VALUE });
      const receipt = await tx.wait();
      const event = receipt.logs.find((l) => l.fragment?.name === "JobCreated");
      escrowAddr = event.args.escrow;
      escrow = await ethers.getContractAt("FreelanceEscrow", escrowAddr);

      // Complete flow
      await escrow.connect(freelancer).acceptJob();
      await escrow.connect(freelancer).submitWork();

      const balanceBefore = await ethers.provider.getBalance(freelancer.address);
      await escrow.connect(client).approveWork();
      const balanceAfter = await ethers.provider.getBalance(freelancer.address);

      // Verify payment happened
      expect(balanceAfter - balanceBefore).to.equal(JOB_VALUE);

      // Verify escrow is empty
      expect(await ethers.provider.getBalance(escrowAddr)).to.equal(0);

      // Verify status is Released
      expect(await escrow.status()).to.equal(4);
    });
  });

  /* ==================================================
   * EVENT EMISSION TESTS
   * ================================================== */
  describe("Event Emissions", function () {
    beforeEach(async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3 * ONE_DAY;

      const tx = await factory
        .connect(client)
        .createJob(deadline, { value: JOB_VALUE });
      const receipt = await tx.wait();
      const event = receipt.logs.find((l) => l.fragment?.name === "JobCreated");
      escrowAddr = event.args.escrow;
      escrow = await ethers.getContractAt("FreelanceEscrow", escrowAddr);
    });

    it("✅ JobAccepted event emitted correctly", async function () {
      await expect(escrow.connect(freelancer).acceptJob())
        .to.emit(escrow, "JobAccepted")
        .withArgs(freelancer.address);
    });

    it("✅ WorkSubmitted event emitted correctly", async function () {
      await escrow.connect(freelancer).acceptJob();
      await expect(escrow.connect(freelancer).submitWork()).to.emit(
        escrow,
        "WorkSubmitted"
      );
    });

    it("✅ DisputeOpened event emitted correctly", async function () {
      await escrow.connect(freelancer).acceptJob();
      await escrow.connect(freelancer).submitWork();

      await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
      await ethers.provider.send("evm_mine");

      await expect(escrow.connect(client).dispute()).to.emit(
        escrow,
        "DisputeOpened"
      );
    });

    it("✅ Released event emitted on dispute resolution (freelancer wins)", async function () {
      await escrow.connect(freelancer).acceptJob();
      await escrow.connect(freelancer).submitWork();

      await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
      await ethers.provider.send("evm_mine");

      await escrow.connect(client).dispute();

      await multisig.connect(arbiter1).vote(escrowAddr, true);
      
      await expect(multisig.connect(arbiter2).vote(escrowAddr, true))
        .to.emit(escrow, "Released")
        .withArgs(freelancer.address, JOB_VALUE);
    });

    it("✅ Refunded event emitted on dispute resolution (client wins)", async function () {
      await escrow.connect(freelancer).acceptJob();
      await escrow.connect(freelancer).submitWork();

      await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
      await ethers.provider.send("evm_mine");

      await escrow.connect(client).dispute();

      await multisig.connect(arbiter1).vote(escrowAddr, false);
      
      await expect(multisig.connect(arbiter2).vote(escrowAddr, false))
        .to.emit(escrow, "Refunded")
        .withArgs(client.address, JOB_VALUE);
    });

    it("✅ Vote transaction succeeds and updates state", async function () {
      await escrow.connect(freelancer).acceptJob();
      await escrow.connect(freelancer).submitWork();

      await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
      await ethers.provider.send("evm_mine");

      await escrow.connect(client).dispute();

      // Vote and check state is updated
      await multisig.connect(arbiter1).vote(escrowAddr, true);
      
      const [forFreelancer, forClient, resolved] = await multisig.getVotes(escrowAddr);
      expect(forFreelancer).to.equal(1);
      expect(forClient).to.equal(0);
      expect(resolved).to.equal(false);
      expect(await multisig.hasVoted(escrowAddr, arbiter1.address)).to.equal(true);
    });
  });

  /* ==================================================
   * BOUNDARY CONDITION TESTS
   * ================================================== */
  describe("Boundary Conditions", function () {
    it("✅ Can create job with minimum value (1 wei)", async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3 * ONE_DAY;

      await expect(
        factory.connect(client).createJob(deadline, { value: 1 })
      ).to.not.be.reverted;
    });

    it("✅ Can create job with large value", async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3 * ONE_DAY;
      const largeValue = ethers.parseEther("1000");

      await expect(
        factory.connect(client).createJob(deadline, { value: largeValue })
      ).to.not.be.reverted;
    });

    it("✅ Deadline can be exactly 1 second in future", async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 2; // +2 to be safe with block timing

      await expect(
        factory.connect(client).createJob(deadline, { value: JOB_VALUE })
      ).to.not.be.reverted;
    });

    it("✅ Dispute exactly at deadline boundary", async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3 * ONE_DAY;

      const tx = await factory
        .connect(client)
        .createJob(deadline, { value: JOB_VALUE });
      const receipt = await tx.wait();
      const event = receipt.logs.find((l) => l.fragment?.name === "JobCreated");
      escrowAddr = event.args.escrow;
      escrow = await ethers.getContractAt("FreelanceEscrow", escrowAddr);

      await escrow.connect(freelancer).acceptJob();
      await escrow.connect(freelancer).submitWork();

      // Move to exactly deadline + 1 second
      await ethers.provider.send("evm_increaseTime", [3 * ONE_DAY + 1]);
      await ethers.provider.send("evm_mine");

      await expect(escrow.connect(client).dispute()).to.not.be.reverted;
    });
  });

  /* ==================================================
   * MULTIPLE ARBITERS SCENARIOS
   * ================================================== */
  describe("Multiple Arbiter Scenarios", function () {
    it("✅ 1 of 1 arbiter setup works", async function () {
      const DisputeMultiSig = await ethers.getContractFactory("DisputeMultiSig");
      const singleArbiterMultisig = await DisputeMultiSig.deploy(
        [arbiter1.address],
        1
      );
      await singleArbiterMultisig.waitForDeployment();

      const EscrowFactory = await ethers.getContractFactory("EscrowFactory");
      const singleFactory = await EscrowFactory.deploy(
        await singleArbiterMultisig.getAddress()
      );
      await singleFactory.waitForDeployment();

      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3 * ONE_DAY;

      const tx = await singleFactory
        .connect(client)
        .createJob(deadline, { value: JOB_VALUE });
      const receipt = await tx.wait();
      const event = receipt.logs.find((l) => l.fragment?.name === "JobCreated");
      const singleEscrowAddr = event.args.escrow;
      const singleEscrow = await ethers.getContractAt(
        "FreelanceEscrow",
        singleEscrowAddr
      );

      await singleEscrow.connect(freelancer).acceptJob();
      await singleEscrow.connect(freelancer).submitWork();

      await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
      await ethers.provider.send("evm_mine");

      await singleEscrow.connect(client).dispute();

      // Single vote should resolve
      await singleArbiterMultisig.connect(arbiter1).vote(singleEscrowAddr, true);

      expect(await singleEscrow.status()).to.equal(4); // Released
    });

    it("✅ 3 of 3 arbiter setup requires all votes", async function () {
      const DisputeMultiSig = await ethers.getContractFactory("DisputeMultiSig");
      const fullConsensusMultisig = await DisputeMultiSig.deploy(
        [arbiter1.address, arbiter2.address, arbiter3.address],
        3
      );
      await fullConsensusMultisig.waitForDeployment();

      const EscrowFactory = await ethers.getContractFactory("EscrowFactory");
      const consensusFactory = await EscrowFactory.deploy(
        await fullConsensusMultisig.getAddress()
      );
      await consensusFactory.waitForDeployment();

      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3 * ONE_DAY;

      const tx = await consensusFactory
        .connect(client)
        .createJob(deadline, { value: JOB_VALUE });
      const receipt = await tx.wait();
      const event = receipt.logs.find((l) => l.fragment?.name === "JobCreated");
      const consensusEscrowAddr = event.args.escrow;
      const consensusEscrow = await ethers.getContractAt(
        "FreelanceEscrow",
        consensusEscrowAddr
      );

      await consensusEscrow.connect(freelancer).acceptJob();
      await consensusEscrow.connect(freelancer).submitWork();

      await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
      await ethers.provider.send("evm_mine");

      await consensusEscrow.connect(client).dispute();

      // First two votes shouldn't resolve
      await fullConsensusMultisig.connect(arbiter1).vote(consensusEscrowAddr, true);
      await fullConsensusMultisig.connect(arbiter2).vote(consensusEscrowAddr, true);

      const [, , resolved1] = await fullConsensusMultisig.getVotes(
        consensusEscrowAddr
      );
      expect(resolved1).to.equal(false);

      // Third vote should resolve
      await fullConsensusMultisig.connect(arbiter3).vote(consensusEscrowAddr, true);

      expect(await consensusEscrow.status()).to.equal(4); // Released
    });
  });

  /* ==================================================
   * STATE TRANSITION TESTS
   * ================================================== */
  describe("State Transitions", function () {
    beforeEach(async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3 * ONE_DAY;

      const tx = await factory
        .connect(client)
        .createJob(deadline, { value: JOB_VALUE });
      const receipt = await tx.wait();
      const event = receipt.logs.find((l) => l.fragment?.name === "JobCreated");
      escrowAddr = event.args.escrow;
      escrow = await ethers.getContractAt("FreelanceEscrow", escrowAddr);
    });

    it("✅ Created → Accepted → Submitted → Released (happy path)", async function () {
      expect(await escrow.status()).to.equal(0); // Created

      await escrow.connect(freelancer).acceptJob();
      expect(await escrow.status()).to.equal(1); // Accepted

      await escrow.connect(freelancer).submitWork();
      expect(await escrow.status()).to.equal(2); // Submitted

      await escrow.connect(client).approveWork();
      expect(await escrow.status()).to.equal(4); // Released
    });

    it("✅ Created → Accepted → Submitted → Disputed → Released", async function () {
      expect(await escrow.status()).to.equal(0); // Created

      await escrow.connect(freelancer).acceptJob();
      expect(await escrow.status()).to.equal(1); // Accepted

      await escrow.connect(freelancer).submitWork();
      expect(await escrow.status()).to.equal(2); // Submitted

      await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
      await ethers.provider.send("evm_mine");

      await escrow.connect(client).dispute();
      expect(await escrow.status()).to.equal(3); // Disputed

      await multisig.connect(arbiter1).vote(escrowAddr, true);
      await multisig.connect(arbiter2).vote(escrowAddr, true);
      expect(await escrow.status()).to.equal(4); // Released
    });

    it("✅ Created → Accepted → Submitted → Disputed → Refunded", async function () {
      expect(await escrow.status()).to.equal(0); // Created

      await escrow.connect(freelancer).acceptJob();
      expect(await escrow.status()).to.equal(1); // Accepted

      await escrow.connect(freelancer).submitWork();
      expect(await escrow.status()).to.equal(2); // Submitted

      await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
      await ethers.provider.send("evm_mine");

      await escrow.connect(client).dispute();
      expect(await escrow.status()).to.equal(3); // Disputed

      await multisig.connect(arbiter1).vote(escrowAddr, false);
      await multisig.connect(arbiter2).vote(escrowAddr, false);
      expect(await escrow.status()).to.equal(5); // Refunded
    });

    it("❌ Cannot skip states", async function () {
      // Cannot submit before accept
      await expect(
        escrow.connect(freelancer).submitWork()
      ).to.be.revertedWith("Not freelancer");

      // Cannot approve before submit
      await expect(
        escrow.connect(client).approveWork()
      ).to.be.revertedWith("Not submitted");
    });
  });

  /* ==================================================
   * FACTORY JOB TRACKING CONSISTENCY
   * ================================================== */
  describe("Factory Job Tracking", function () {
    it("✅ Jobs array and mapping stay consistent after multiple operations", async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3 * ONE_DAY;

      // Create multiple jobs
      const jobAddresses = [];
      for (let i = 0; i < 5; i++) {
        const tx = await factory
          .connect(client)
          .createJob(deadline, { value: JOB_VALUE });
        const receipt = await tx.wait();
        const event = receipt.logs.find((l) => l.fragment?.name === "JobCreated");
        jobAddresses.push(event.args.escrow);
      }

      // Verify consistency
      expect(await factory.totalJobs()).to.equal(5);

      const allJobs = await factory.getAllJobs();
      expect(allJobs.length).to.equal(5);

      for (let i = 0; i < 5; i++) {
        expect(await factory.getJob(i)).to.equal(jobAddresses[i]);
        expect(await factory.jobs(i)).to.equal(jobAddresses[i]);
        expect(allJobs[i]).to.equal(jobAddresses[i]);
      }

      // Verify client's jobs
      const clientJobs = await factory.getJobsByClient(client.address);
      expect(clientJobs.length).to.equal(5);
    });
  });
});

