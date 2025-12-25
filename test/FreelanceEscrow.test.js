const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FreelanceEscrow - Comprehensive Tests", function () {
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
  });

  /* ==================================================
   * INITIAL STATE TESTS
   * ================================================== */
  describe("Initial State", function () {
    it("Should have correct initial status as Created", async function () {
      expect(await escrow.status()).to.equal(0); // Status.Created = 0
    });

    it("Should have correct client address", async function () {
      expect(await escrow.client()).to.equal(client.address);
    });

    it("Should have correct amount", async function () {
      expect(await escrow.amount()).to.equal(JOB_VALUE);
    });

    it("Should have correct arbiter address (DisputeMultiSig)", async function () {
      expect(await escrow.arbiter()).to.equal(await multisig.getAddress());
    });

    it("Should have freelancer as zero address initially", async function () {
      expect(await escrow.freelancer()).to.equal(ethers.ZeroAddress);
    });

    it("Should have factory address set correctly", async function () {
      expect(await escrow.factory()).to.equal(await factory.getAddress());
    });
  });

  /* ==================================================
   * ACCEPT JOB TESTS
   * ================================================== */
  describe("Accept Job", function () {
    it("✅ Any user can accept job", async function () {
      await expect(escrow.connect(freelancer).acceptJob())
        .to.emit(escrow, "JobAccepted")
        .withArgs(freelancer.address);

      expect(await escrow.freelancer()).to.equal(freelancer.address);
      expect(await escrow.status()).to.equal(1); // Status.Accepted = 1
    });

    it("✅ Client can also accept their own job", async function () {
      await expect(escrow.connect(client).acceptJob())
        .to.emit(escrow, "JobAccepted")
        .withArgs(client.address);
    });

    it("❌ Cannot accept job twice by same user", async function () {
      await escrow.connect(freelancer).acceptJob();
      await expect(escrow.connect(freelancer).acceptJob()).to.be.revertedWith(
        "Not open"
      );
    });

    it("❌ Cannot accept job twice by different user", async function () {
      await escrow.connect(freelancer).acceptJob();
      await expect(escrow.connect(randomUser).acceptJob()).to.be.revertedWith(
        "Not open"
      );
    });
  });

  /* ==================================================
   * SUBMIT WORK TESTS
   * ================================================== */
  describe("Submit Work", function () {
    beforeEach(async function () {
      await escrow.connect(freelancer).acceptJob();
    });

    it("✅ Freelancer can submit work", async function () {
      await expect(escrow.connect(freelancer).submitWork())
        .to.emit(escrow, "WorkSubmitted");

      expect(await escrow.status()).to.equal(2); // Status.Submitted = 2
    });

    it("❌ Only freelancer can submit work", async function () {
      await expect(
        escrow.connect(client).submitWork()
      ).to.be.revertedWith("Not freelancer");
    });

    it("❌ Random user cannot submit work", async function () {
      await expect(
        escrow.connect(randomUser).submitWork()
      ).to.be.revertedWith("Not freelancer");
    });

    it("❌ Cannot submit work twice", async function () {
      await escrow.connect(freelancer).submitWork();
      await expect(
        escrow.connect(freelancer).submitWork()
      ).to.be.revertedWith("Invalid state");
    });
  });

  /* ==================================================
   * APPROVE WORK TESTS
   * ================================================== */
  describe("Approve Work", function () {
    beforeEach(async function () {
      await escrow.connect(freelancer).acceptJob();
      await escrow.connect(freelancer).submitWork();
    });

    it("✅ Client can approve work before deadline", async function () {
      const freelancerBalanceBefore = await ethers.provider.getBalance(
        freelancer.address
      );

      await escrow.connect(client).approveWork();

      expect(await escrow.status()).to.equal(4); // Status.Released = 4

      const freelancerBalanceAfter = await ethers.provider.getBalance(
        freelancer.address
      );
      expect(freelancerBalanceAfter - freelancerBalanceBefore).to.equal(
        JOB_VALUE
      );
    });

    it("❌ Only client can approve work", async function () {
      await expect(
        escrow.connect(freelancer).approveWork()
      ).to.be.revertedWith("Not client");
    });

    it("❌ Cannot approve work after deadline", async function () {
      await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
      await ethers.provider.send("evm_mine");

      await expect(
        escrow.connect(client).approveWork()
      ).to.be.revertedWith("Deadline passed");
    });

    it("❌ Random user cannot approve work", async function () {
      await expect(
        escrow.connect(randomUser).approveWork()
      ).to.be.revertedWith("Not client");
    });

    it("❌ Cannot approve work before submission", async function () {
      // Create new escrow for this test
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3 * ONE_DAY;

      const tx = await factory
        .connect(client)
        .createJob(deadline, { value: JOB_VALUE });
      const receipt = await tx.wait();
      const event = receipt.logs.find((l) => l.fragment?.name === "JobCreated");
      const newEscrowAddr = event.args.escrow;
      const newEscrow = await ethers.getContractAt(
        "FreelanceEscrow",
        newEscrowAddr
      );

      await newEscrow.connect(freelancer).acceptJob();

      await expect(
        newEscrow.connect(client).approveWork()
      ).to.be.revertedWith("Not submitted");
    });
  });

  /* ==================================================
   * DISPUTE TESTS
   * ================================================== */
  describe("Dispute", function () {
    beforeEach(async function () {
      await escrow.connect(freelancer).acceptJob();
    });

    it("❌ Cannot dispute before work is submitted", async function () {
      await expect(escrow.connect(client).dispute()).to.be.revertedWith(
        "Not submitted"
      );
    });

    it("❌ Cannot dispute before deadline (after submission)", async function () {
      await escrow.connect(freelancer).submitWork();
      await expect(escrow.connect(client).dispute()).to.be.revertedWith(
        "Deadline not reached"
      );
    });

    it("✅ Client can dispute after deadline", async function () {
      await escrow.connect(freelancer).submitWork();
      
      await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
      await ethers.provider.send("evm_mine");

      await expect(escrow.connect(client).dispute())
        .to.emit(escrow, "DisputeOpened");

      expect(await escrow.status()).to.equal(3); // Status.Disputed = 3
    });

    it("❌ Only client can open dispute", async function () {
      await escrow.connect(freelancer).submitWork();

      await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
      await ethers.provider.send("evm_mine");

      await expect(
        escrow.connect(freelancer).dispute()
      ).to.be.revertedWith("Not client");
    });

    it("❌ Cannot dispute twice", async function () {
      await escrow.connect(freelancer).submitWork();

      await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
      await ethers.provider.send("evm_mine");

      await escrow.connect(client).dispute();

      await expect(escrow.connect(client).dispute()).to.be.revertedWith(
        "Not submitted"
      );
    });
  });

  /* ==================================================
   * RESOLVE DISPUTE TESTS
   * ================================================== */
  describe("Resolve Dispute", function () {
    beforeEach(async function () {
      await escrow.connect(freelancer).acceptJob();
      await escrow.connect(freelancer).submitWork();

      await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
      await ethers.provider.send("evm_mine");

      await escrow.connect(client).dispute();
    });

    it("✅ Arbiter votes pay freelancer → freelancer receives funds", async function () {
      const freelancerBalanceBefore = await ethers.provider.getBalance(
        freelancer.address
      );

      await multisig.connect(arbiter1).vote(escrowAddr, true);
      await multisig.connect(arbiter2).vote(escrowAddr, true);

      expect(await escrow.status()).to.equal(4); // Status.Released = 4

      const freelancerBalanceAfter = await ethers.provider.getBalance(
        freelancer.address
      );
      expect(freelancerBalanceAfter - freelancerBalanceBefore).to.equal(
        JOB_VALUE
      );
    });

    it("✅ Arbiter votes refund client → client receives funds", async function () {
      const clientBalanceBefore = await ethers.provider.getBalance(
        client.address
      );

      await multisig.connect(arbiter1).vote(escrowAddr, false);
      await multisig.connect(arbiter2).vote(escrowAddr, false);

      expect(await escrow.status()).to.equal(5); // Status.Refunded = 5

      const clientBalanceAfter = await ethers.provider.getBalance(
        client.address
      );
      expect(clientBalanceAfter - clientBalanceBefore).to.equal(JOB_VALUE);
    });

    it("❌ Only arbiter can resolve dispute", async function () {
      await expect(
        escrow.connect(client).resolveDispute(true)
      ).to.be.revertedWith("Not arbiter");
    });

    it("❌ Cannot resolve dispute if no dispute exists", async function () {
      // Create new escrow for this test
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3 * ONE_DAY;

      const tx = await factory
        .connect(client)
        .createJob(deadline, { value: JOB_VALUE });
      const receipt = await tx.wait();
      const event = receipt.logs.find((l) => l.fragment?.name === "JobCreated");
      const newEscrowAddr = event.args.escrow;
      const newEscrow = await ethers.getContractAt(
        "FreelanceEscrow",
        newEscrowAddr
      );

      await newEscrow.connect(freelancer).acceptJob();
      await newEscrow.connect(freelancer).submitWork();

      // Move time past deadline
      await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
      await ethers.provider.send("evm_mine");

      // First vote goes through (doesn't reach required threshold)
      await multisig.connect(arbiter1).vote(newEscrowAddr, true);

      // Second vote should revert because it tries to call resolveDispute
      // on escrow in Submitted state (not Disputed)
      await expect(
        multisig.connect(arbiter2).vote(newEscrowAddr, true)
      ).to.be.revertedWith("No dispute");
    });
  });

  /* ==================================================
   * BALANCE & PAYMENT TESTS
   * ================================================== */
  describe("Balance & Payment", function () {
    it("✅ Escrow contract holds the correct amount", async function () {
      const balance = await ethers.provider.getBalance(escrowAddr);
      expect(balance).to.equal(JOB_VALUE);
    });

    it("✅ Balance becomes 0 after freelancer payment", async function () {
      await escrow.connect(freelancer).acceptJob();
      await escrow.connect(freelancer).submitWork();
      await escrow.connect(client).approveWork();

      const balance = await ethers.provider.getBalance(escrowAddr);
      expect(balance).to.equal(0);
    });

    it("✅ Balance becomes 0 after client refund", async function () {
      await escrow.connect(freelancer).acceptJob();
      await escrow.connect(freelancer).submitWork();

      await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
      await ethers.provider.send("evm_mine");

      await escrow.connect(client).dispute();

      await multisig.connect(arbiter1).vote(escrowAddr, false);
      await multisig.connect(arbiter2).vote(escrowAddr, false);

      const balance = await ethers.provider.getBalance(escrowAddr);
      expect(balance).to.equal(0);
    });
  });
});

