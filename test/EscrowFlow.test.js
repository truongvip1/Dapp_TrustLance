const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Freelance Escrow + DisputeMultiSig – Multi-Escrow Test Suite", function () {
  let deployer, client, freelancer, arbiter1, arbiter2, arbiter3;
  let factory, multisig;
  let escrow, escrowAddr;

  const REQUIRED_VOTES = 2;
  const ONE_DAY = 24 * 60 * 60;

  beforeEach(async function () {
    [deployer, client, freelancer, arbiter1, arbiter2, arbiter3] =
      await ethers.getSigners();

    /* --------------------------------------------------
     * Deploy DisputeMultiSig
     * -------------------------------------------------- */
    const DisputeMultiSig = await ethers.getContractFactory("DisputeMultiSig");
    multisig = await DisputeMultiSig.deploy(
      [arbiter1.address, arbiter2.address, arbiter3.address],
      REQUIRED_VOTES
    );
    await multisig.waitForDeployment();

    /* --------------------------------------------------
     * Deploy EscrowFactory
     * -------------------------------------------------- */
    const EscrowFactory = await ethers.getContractFactory("EscrowFactory");
    factory = await EscrowFactory.deploy(await multisig.getAddress());
    await factory.waitForDeployment();

    /* --------------------------------------------------
     * Create Escrow Job
     * -------------------------------------------------- */
    const block = await ethers.provider.getBlock("latest");
    const deadline = block.timestamp + 3 * ONE_DAY;

    const tx = await factory
      .connect(client)
      .createJob(deadline, { value: ethers.parseEther("1") });

    const receipt = await tx.wait();
    const event = receipt.logs.find(
      (l) => l.fragment?.name === "JobCreated"
    );

    // ⭐ CỰC KỲ QUAN TRỌNG (ethers v6)
    escrowAddr = event.args.escrow;

    escrow = await ethers.getContractAt(
      "FreelanceEscrow",
      escrowAddr
    );
  });

  /* ==================================================
   * BASIC FLOW
   * ================================================== */
  it("✅ Any user can accept job (first-come)", async function () {
    await expect(
      escrow.connect(client).acceptJob()
    ).to.not.be.reverted;
  });

  it("❌ Cannot accept job twice", async function () {
    await escrow.connect(client).acceptJob();

    await expect(
      escrow.connect(freelancer).acceptJob()
    ).to.be.reverted;
  });

  it("✅ Freelancer accepts and submits work", async function () {
    await escrow.connect(freelancer).acceptJob();

    await expect(
      escrow.connect(freelancer).submitWork()
    ).to.not.be.reverted;
  });

  /* ==================================================
   * DISPUTE FLOW
   * ================================================== */
  it("❌ Cannot dispute before submission", async function () {
    await escrow.connect(freelancer).acceptJob();

    await expect(
      escrow.connect(client).dispute()
    ).to.be.reverted;
  });

  it("❌ Cannot dispute before deadline", async function () {
    await escrow.connect(freelancer).acceptJob();
    await escrow.connect(freelancer).submitWork();

    await expect(
      escrow.connect(client).dispute()
    ).to.be.revertedWith("Deadline not reached");
  });

  it("⚠️ Client opens dispute after deadline", async function () {
    await escrow.connect(freelancer).acceptJob();
    await escrow.connect(freelancer).submitWork();

    await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
    await ethers.provider.send("evm_mine");

    await expect(
      escrow.connect(client).dispute()
    ).to.not.be.reverted;
  });

  /* ==================================================
   * MULTISIG VOTING
   * ================================================== */
  it("🧑‍⚖️ 2/3 arbiters vote → freelancer wins", async function () {
    await escrow.connect(freelancer).acceptJob();
    await escrow.connect(freelancer).submitWork();

    await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
    await ethers.provider.send("evm_mine");

    await escrow.connect(client).dispute();

    await multisig.connect(arbiter1).vote(escrowAddr, true);
    await multisig.connect(arbiter2).vote(escrowAddr, true);

    const [, , resolved] = await multisig.getVotes(escrowAddr);
    expect(resolved).to.equal(true);
  });

  it("🧑‍⚖️ 2/3 arbiters vote → client refunded", async function () {
    await escrow.connect(freelancer).acceptJob();
    await escrow.connect(freelancer).submitWork();

    await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
    await ethers.provider.send("evm_mine");

    await escrow.connect(client).dispute();

    await multisig.connect(arbiter1).vote(escrowAddr, false);
    await multisig.connect(arbiter2).vote(escrowAddr, false);

    const [, , resolved] = await multisig.getVotes(escrowAddr);
    expect(resolved).to.equal(true);
  });

  it("❌ Arbiter cannot vote twice", async function () {
    await escrow.connect(freelancer).acceptJob();
    await escrow.connect(freelancer).submitWork();

    await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
    await ethers.provider.send("evm_mine");

    await escrow.connect(client).dispute();

    await multisig.connect(arbiter1).vote(escrowAddr, true);

    await expect(
      multisig.connect(arbiter1).vote(escrowAddr, true)
    ).to.be.revertedWith("Already voted");
  });

  it("❌ Non-arbiter cannot vote", async function () {
    await escrow.connect(freelancer).acceptJob();
    await escrow.connect(freelancer).submitWork();

    await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
    await ethers.provider.send("evm_mine");

    await escrow.connect(client).dispute();

    await expect(
      multisig.connect(client).vote(escrowAddr, true)
    ).to.be.revertedWith("Not an arbiter");
  });

  it("❌ Cannot resolve dispute twice", async function () {
    await escrow.connect(freelancer).acceptJob();
    await escrow.connect(freelancer).submitWork();

    await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
    await ethers.provider.send("evm_mine");

    await escrow.connect(client).dispute();

    await multisig.connect(arbiter1).vote(escrowAddr, true);
    await multisig.connect(arbiter2).vote(escrowAddr, true);

    await expect(
      multisig.connect(arbiter3).vote(escrowAddr, true)
    ).to.be.revertedWith("Dispute already resolved");
  });
});
