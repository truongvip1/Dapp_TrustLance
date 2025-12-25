const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DisputeMultiSig - Comprehensive Tests", function () {
  let deployer, client, freelancer, arbiter1, arbiter2, arbiter3, arbiter4, randomUser;
  let factory, multisig;
  let escrow, escrowAddr;

  const REQUIRED_VOTES = 2;
  const ONE_DAY = 24 * 60 * 60;
  const JOB_VALUE = ethers.parseEther("1");

  beforeEach(async function () {
    [deployer, client, freelancer, arbiter1, arbiter2, arbiter3, arbiter4, randomUser] =
      await ethers.getSigners();
  });

  /* ==================================================
   * DEPLOYMENT TESTS
   * ================================================== */
  describe("Deployment", function () {
    it("✅ Deploys with correct arbiters", async function () {
      const DisputeMultiSig = await ethers.getContractFactory("DisputeMultiSig");
      const multisig = await DisputeMultiSig.deploy(
        [arbiter1.address, arbiter2.address, arbiter3.address],
        REQUIRED_VOTES
      );
      await multisig.waitForDeployment();

      expect(await multisig.arbiters(0)).to.equal(arbiter1.address);
      expect(await multisig.arbiters(1)).to.equal(arbiter2.address);
      expect(await multisig.arbiters(2)).to.equal(arbiter3.address);
    });

    it("✅ Deploys with correct required votes", async function () {
      const DisputeMultiSig = await ethers.getContractFactory("DisputeMultiSig");
      const multisig = await DisputeMultiSig.deploy(
        [arbiter1.address, arbiter2.address, arbiter3.address],
        REQUIRED_VOTES
      );
      await multisig.waitForDeployment();

      expect(await multisig.required()).to.equal(REQUIRED_VOTES);
    });

    it("✅ isArbiter returns true for arbiters", async function () {
      const DisputeMultiSig = await ethers.getContractFactory("DisputeMultiSig");
      const multisig = await DisputeMultiSig.deploy(
        [arbiter1.address, arbiter2.address, arbiter3.address],
        REQUIRED_VOTES
      );
      await multisig.waitForDeployment();

      expect(await multisig.isArbiter(arbiter1.address)).to.equal(true);
      expect(await multisig.isArbiter(arbiter2.address)).to.equal(true);
      expect(await multisig.isArbiter(arbiter3.address)).to.equal(true);
      expect(await multisig.isArbiter(randomUser.address)).to.equal(false);
    });

    it("❌ Cannot deploy with empty arbiters array", async function () {
      const DisputeMultiSig = await ethers.getContractFactory("DisputeMultiSig");
      await expect(
        DisputeMultiSig.deploy([], 1)
      ).to.be.revertedWith("No arbiters");
    });

    it("❌ Cannot deploy with zero required votes", async function () {
      const DisputeMultiSig = await ethers.getContractFactory("DisputeMultiSig");
      await expect(
        DisputeMultiSig.deploy(
          [arbiter1.address, arbiter2.address],
          0
        )
      ).to.be.revertedWith("Invalid required");
    });

    it("❌ Cannot deploy with required > arbiters count", async function () {
      const DisputeMultiSig = await ethers.getContractFactory("DisputeMultiSig");
      await expect(
        DisputeMultiSig.deploy(
          [arbiter1.address, arbiter2.address],
          3
        )
      ).to.be.revertedWith("Invalid required");
    });

    it("❌ Cannot deploy with duplicate arbiters", async function () {
      const DisputeMultiSig = await ethers.getContractFactory("DisputeMultiSig");
      await expect(
        DisputeMultiSig.deploy(
          [arbiter1.address, arbiter1.address, arbiter2.address],
          2
        )
      ).to.be.revertedWith("Duplicate arbiter");
    });

    it("❌ Cannot deploy with zero address arbiter", async function () {
      const DisputeMultiSig = await ethers.getContractFactory("DisputeMultiSig");
      await expect(
        DisputeMultiSig.deploy(
          [arbiter1.address, ethers.ZeroAddress, arbiter2.address],
          2
        )
      ).to.be.revertedWith("Zero arbiter");
    });

    it("✅ Can deploy with different required ratios", async function () {
      const DisputeMultiSig = await ethers.getContractFactory("DisputeMultiSig");

      // 1 of 1
      let multisig = await DisputeMultiSig.deploy([arbiter1.address], 1);
      await multisig.waitForDeployment();
      expect(await multisig.required()).to.equal(1);

      // 2 of 2
      multisig = await DisputeMultiSig.deploy(
        [arbiter1.address, arbiter2.address],
        2
      );
      await multisig.waitForDeployment();
      expect(await multisig.required()).to.equal(2);

      // 3 of 5
      multisig = await DisputeMultiSig.deploy(
        [
          arbiter1.address,
          arbiter2.address,
          arbiter3.address,
          arbiter4.address,
          randomUser.address,
        ],
        3
      );
      await multisig.waitForDeployment();
      expect(await multisig.required()).to.equal(3);
    });
  });

  /* ==================================================
   * VOTING TESTS
   * ================================================== */
  describe("Voting", function () {
    beforeEach(async function () {
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

      // Create Escrow Job
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3 * ONE_DAY;

      const tx = await factory
        .connect(client)
        .createJob(deadline, { value: JOB_VALUE });
      const receipt = await tx.wait();
      const event = receipt.logs.find((l) => l.fragment?.name === "JobCreated");
      escrowAddr = event.args.escrow;

      escrow = await ethers.getContractAt("FreelanceEscrow", escrowAddr);

      // Setup dispute
      await escrow.connect(freelancer).acceptJob();
      await escrow.connect(freelancer).submitWork();

      await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
      await ethers.provider.send("evm_mine");

      await escrow.connect(client).dispute();
    });

    it("✅ Arbiter can vote for freelancer", async function () {
      await expect(multisig.connect(arbiter1).vote(escrowAddr, true)).to.not.be
        .reverted;

      const [forFreelancer, forClient, resolved] = await multisig.getVotes(
        escrowAddr
      );
      expect(forFreelancer).to.equal(1);
      expect(forClient).to.equal(0);
      expect(resolved).to.equal(false);
    });

    it("✅ Arbiter can vote for client", async function () {
      await expect(multisig.connect(arbiter1).vote(escrowAddr, false)).to.not.be
        .reverted;

      const [forFreelancer, forClient, resolved] = await multisig.getVotes(
        escrowAddr
      );
      expect(forFreelancer).to.equal(0);
      expect(forClient).to.equal(1);
      expect(resolved).to.equal(false);
    });

    it("❌ Non-arbiter cannot vote", async function () {
      await expect(
        multisig.connect(randomUser).vote(escrowAddr, true)
      ).to.be.revertedWith("Not an arbiter");
    });

    it("❌ Arbiter cannot vote twice on same escrow", async function () {
      await multisig.connect(arbiter1).vote(escrowAddr, true);

      await expect(
        multisig.connect(arbiter1).vote(escrowAddr, true)
      ).to.be.revertedWith("Already voted");
    });

    it("✅ hasVoted returns correct value", async function () {
      expect(await multisig.hasVoted(escrowAddr, arbiter1.address)).to.equal(
        false
      );

      await multisig.connect(arbiter1).vote(escrowAddr, true);

      expect(await multisig.hasVoted(escrowAddr, arbiter1.address)).to.equal(
        true
      );
      expect(await multisig.hasVoted(escrowAddr, arbiter2.address)).to.equal(
        false
      );
    });

    it("✅ Multiple arbiters can vote", async function () {
      await multisig.connect(arbiter1).vote(escrowAddr, true);
      await multisig.connect(arbiter2).vote(escrowAddr, false);

      const [forFreelancer, forClient, resolved] = await multisig.getVotes(
        escrowAddr
      );
      expect(forFreelancer).to.equal(1);
      expect(forClient).to.equal(1);
      expect(resolved).to.equal(false);
    });
  });

  /* ==================================================
   * RESOLUTION TESTS
   * ================================================== */
  describe("Resolution", function () {
    beforeEach(async function () {
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

      // Create Escrow Job
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3 * ONE_DAY;

      const tx = await factory
        .connect(client)
        .createJob(deadline, { value: JOB_VALUE });
      const receipt = await tx.wait();
      const event = receipt.logs.find((l) => l.fragment?.name === "JobCreated");
      escrowAddr = event.args.escrow;

      escrow = await ethers.getContractAt("FreelanceEscrow", escrowAddr);

      // Setup dispute
      await escrow.connect(freelancer).acceptJob();
      await escrow.connect(freelancer).submitWork();

      await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
      await ethers.provider.send("evm_mine");

      await escrow.connect(client).dispute();
    });

    it("✅ Dispute resolves when required votes for freelancer reached", async function () {
      await multisig.connect(arbiter1).vote(escrowAddr, true);
      await multisig.connect(arbiter2).vote(escrowAddr, true);

      const [forFreelancer, forClient, resolved] = await multisig.getVotes(
        escrowAddr
      );
      expect(forFreelancer).to.equal(2);
      expect(forClient).to.equal(0);
      expect(resolved).to.equal(true);

      expect(await escrow.status()).to.equal(4); // Released
    });

    it("✅ Dispute resolves when required votes for client reached", async function () {
      await multisig.connect(arbiter1).vote(escrowAddr, false);
      await multisig.connect(arbiter2).vote(escrowAddr, false);

      const [forFreelancer, forClient, resolved] = await multisig.getVotes(
        escrowAddr
      );
      expect(forFreelancer).to.equal(0);
      expect(forClient).to.equal(2);
      expect(resolved).to.equal(true);

      expect(await escrow.status()).to.equal(5); // Refunded
    });

    it("❌ Cannot vote after dispute is resolved", async function () {
      await multisig.connect(arbiter1).vote(escrowAddr, true);
      await multisig.connect(arbiter2).vote(escrowAddr, true);

      await expect(
        multisig.connect(arbiter3).vote(escrowAddr, true)
      ).to.be.revertedWith("Dispute already resolved");
    });

    it("✅ Single vote doesn't resolve dispute", async function () {
      await multisig.connect(arbiter1).vote(escrowAddr, true);

      const [, , resolved] = await multisig.getVotes(escrowAddr);
      expect(resolved).to.equal(false);
    });

    it("✅ Tie doesn't resolve dispute (1-1)", async function () {
      await multisig.connect(arbiter1).vote(escrowAddr, true);
      await multisig.connect(arbiter2).vote(escrowAddr, false);

      const [, , resolved] = await multisig.getVotes(escrowAddr);
      expect(resolved).to.equal(false);
    });

    it("✅ Third vote breaks tie and resolves", async function () {
      await multisig.connect(arbiter1).vote(escrowAddr, true);
      await multisig.connect(arbiter2).vote(escrowAddr, false);
      await multisig.connect(arbiter3).vote(escrowAddr, true);

      const [forFreelancer, forClient, resolved] = await multisig.getVotes(
        escrowAddr
      );
      expect(forFreelancer).to.equal(2);
      expect(forClient).to.equal(1);
      expect(resolved).to.equal(true);
    });
  });

  /* ==================================================
   * MULTI-ESCROW TESTS
   * ================================================== */
  describe("Multi-Escrow Voting", function () {
    let escrowAddr2;

    beforeEach(async function () {
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

      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3 * ONE_DAY;

      // Create first escrow
      let tx = await factory
        .connect(client)
        .createJob(deadline, { value: JOB_VALUE });
      let receipt = await tx.wait();
      let event = receipt.logs.find((l) => l.fragment?.name === "JobCreated");
      escrowAddr = event.args.escrow;
      escrow = await ethers.getContractAt("FreelanceEscrow", escrowAddr);

      // Create second escrow
      tx = await factory
        .connect(client)
        .createJob(deadline, { value: JOB_VALUE });
      receipt = await tx.wait();
      event = receipt.logs.find((l) => l.fragment?.name === "JobCreated");
      escrowAddr2 = event.args.escrow;
      const escrow2 = await ethers.getContractAt(
        "FreelanceEscrow",
        escrowAddr2
      );

      // Setup dispute for both
      await escrow.connect(freelancer).acceptJob();
      await escrow.connect(freelancer).submitWork();
      await escrow2.connect(freelancer).acceptJob();
      await escrow2.connect(freelancer).submitWork();

      await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
      await ethers.provider.send("evm_mine");

      await escrow.connect(client).dispute();
      await escrow2.connect(client).dispute();
    });

    it("✅ Same arbiter can vote on different escrows", async function () {
      await expect(multisig.connect(arbiter1).vote(escrowAddr, true)).to.not.be
        .reverted;
      await expect(multisig.connect(arbiter1).vote(escrowAddr2, false)).to.not
        .be.reverted;
    });

    it("✅ Votes are tracked separately per escrow", async function () {
      await multisig.connect(arbiter1).vote(escrowAddr, true);
      await multisig.connect(arbiter2).vote(escrowAddr, true);

      await multisig.connect(arbiter1).vote(escrowAddr2, false);

      const [forFreelancer1, forClient1, resolved1] = await multisig.getVotes(
        escrowAddr
      );
      expect(forFreelancer1).to.equal(2);
      expect(forClient1).to.equal(0);
      expect(resolved1).to.equal(true);

      const [forFreelancer2, forClient2, resolved2] = await multisig.getVotes(
        escrowAddr2
      );
      expect(forFreelancer2).to.equal(0);
      expect(forClient2).to.equal(1);
      expect(resolved2).to.equal(false);
    });

    it("✅ hasVoted is tracked separately per escrow", async function () {
      await multisig.connect(arbiter1).vote(escrowAddr, true);

      expect(await multisig.hasVoted(escrowAddr, arbiter1.address)).to.equal(
        true
      );
      expect(await multisig.hasVoted(escrowAddr2, arbiter1.address)).to.equal(
        false
      );
    });
  });
});

