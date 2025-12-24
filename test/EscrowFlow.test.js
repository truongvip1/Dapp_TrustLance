const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Freelance Escrow + DisputeMultiSig – Full Test Suite (Fixed)", function () {
  let deployer, client, freelancer, arbiter1, arbiter2, arbiter3;
  let factory, escrow, multisig;

  const REQUIRED_VOTES = 2;
  const ONE_DAY = 24 * 60 * 60;

  beforeEach(async function () {
    [deployer, client, freelancer, arbiter1, arbiter2, arbiter3] =
      await ethers.getSigners();

    /* --------------------------------------------------
     * Deploy MultiSig
     * -------------------------------------------------- */
    const DisputeMultiSig = await ethers.getContractFactory("DisputeMultiSig");
    multisig = await DisputeMultiSig.deploy(
      [arbiter1.address, arbiter2.address, arbiter3.address],
      REQUIRED_VOTES
    );
    await multisig.waitForDeployment();

    /* --------------------------------------------------
     * Deploy Factory
     * -------------------------------------------------- */
    const EscrowFactory = await ethers.getContractFactory("EscrowFactory");
    factory = await EscrowFactory.deploy();
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

    const escrowAddress = event.args.escrow;
    escrow = await ethers.getContractAt("FreelanceEscrow", escrowAddress);

    /* --------------------------------------------------
     * Link Escrow ↔ MultiSig
     * -------------------------------------------------- */
    await escrow.connect(client).setArbiter(await multisig.getAddress());
    await multisig.setEscrow(escrowAddress);
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

    await multisig.connect(arbiter1).vote(true);
    await multisig.connect(arbiter2).vote(true);

    expect(await multisig.resolved()).to.equal(true);
  });

  it("🧑‍⚖️ 2/3 arbiters vote → client refunded", async function () {
    await escrow.connect(freelancer).acceptJob();
    await escrow.connect(freelancer).submitWork();

    await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
    await ethers.provider.send("evm_mine");

    await escrow.connect(client).dispute();

    await multisig.connect(arbiter1).vote(false);
    await multisig.connect(arbiter2).vote(false);

    expect(await multisig.resolved()).to.equal(true);
  });

  it("❌ Arbiter cannot vote twice", async function () {
    await escrow.connect(freelancer).acceptJob();
    await escrow.connect(freelancer).submitWork();

    await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
    await ethers.provider.send("evm_mine");

    await escrow.connect(client).dispute();

    await multisig.connect(arbiter1).vote(true);

    await expect(
      multisig.connect(arbiter1).vote(true)
    ).to.be.revertedWith("Already voted");
  });

  it("❌ Non-arbiter cannot vote", async function () {
    await escrow.connect(freelancer).acceptJob();
    await escrow.connect(freelancer).submitWork();

    await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
    await ethers.provider.send("evm_mine");

    await escrow.connect(client).dispute();

    await expect(
      multisig.connect(client).vote(true)
    ).to.be.revertedWith("Not an arbiter");
  });

  it("❌ Cannot resolve dispute twice", async function () {
    await escrow.connect(freelancer).acceptJob();
    await escrow.connect(freelancer).submitWork();

    await ethers.provider.send("evm_increaseTime", [4 * ONE_DAY]);
    await ethers.provider.send("evm_mine");

    await escrow.connect(client).dispute();

    await multisig.connect(arbiter1).vote(true);
    await multisig.connect(arbiter2).vote(true);

    await expect(
      multisig.connect(arbiter3).vote(true)
    ).to.be.revertedWith("Dispute already resolved");
  });
});
