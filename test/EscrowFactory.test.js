const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EscrowFactory - Comprehensive Tests", function () {
  let deployer, client1, client2, arbiter1, arbiter2, arbiter3;
  let factory, multisig;

  const REQUIRED_VOTES = 2;
  const ONE_DAY = 24 * 60 * 60;
  const JOB_VALUE = ethers.parseEther("1");
  const JOB_VALUE_2 = ethers.parseEther("2.5");

  beforeEach(async function () {
    [deployer, client1, client2, arbiter1, arbiter2, arbiter3] =
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
   * DEPLOYMENT TESTS
   * ================================================== */
  describe("Deployment", function () {
    it("✅ Factory deploys correctly with arbiter set", async function () {
      expect(await factory.arbiter()).to.equal(await multisig.getAddress());
    });

    it("❌ Cannot deploy factory with zero address arbiter", async function () {
      const EscrowFactory = await ethers.getContractFactory("EscrowFactory");
      await expect(
        EscrowFactory.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid arbiter");
    });

    it("✅ Factory starts with 0 jobs", async function () {
      expect(await factory.totalJobs()).to.equal(0);
    });
  });

  /* ==================================================
   * CREATE JOB TESTS
   * ================================================== */
  describe("Create Job", function () {
    it("✅ Client can create job with valid parameters", async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3 * ONE_DAY;

      const tx = await factory
        .connect(client1)
        .createJob(deadline, { value: JOB_VALUE });

      const receipt = await tx.wait();
      const event = receipt.logs.find((l) => l.fragment?.name === "JobCreated");

      expect(event).to.not.be.undefined;
      expect(event.args.client).to.equal(client1.address);
      expect(event.args.amount).to.equal(JOB_VALUE);
      expect(event.args.deadline).to.equal(deadline);
    });

    it("✅ Job count increases after creating job", async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3 * ONE_DAY;

      expect(await factory.totalJobs()).to.equal(0);

      await factory.connect(client1).createJob(deadline, { value: JOB_VALUE });

      expect(await factory.totalJobs()).to.equal(1);

      await factory.connect(client2).createJob(deadline, { value: JOB_VALUE_2 });

      expect(await factory.totalJobs()).to.equal(2);
    });

    it("❌ Cannot create job with past deadline", async function () {
      const block = await ethers.provider.getBlock("latest");
      const pastDeadline = block.timestamp - 1;

      await expect(
        factory.connect(client1).createJob(pastDeadline, { value: JOB_VALUE })
      ).to.be.revertedWith("Invalid deadline");
    });

    it("❌ Cannot create job with zero value", async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3 * ONE_DAY;

      await expect(
        factory.connect(client1).createJob(deadline, { value: 0 })
      ).to.be.revertedWith("Amount must be > 0");
    });

    it("✅ Created escrow has correct arbiter set", async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3 * ONE_DAY;

      const tx = await factory
        .connect(client1)
        .createJob(deadline, { value: JOB_VALUE });
      const receipt = await tx.wait();
      const event = receipt.logs.find((l) => l.fragment?.name === "JobCreated");

      const escrow = await ethers.getContractAt(
        "FreelanceEscrow",
        event.args.escrow
      );

      expect(await escrow.arbiter()).to.equal(await multisig.getAddress());
    });

    it("✅ Created escrow has correct client and amount", async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3 * ONE_DAY;

      const tx = await factory
        .connect(client1)
        .createJob(deadline, { value: JOB_VALUE_2 });
      const receipt = await tx.wait();
      const event = receipt.logs.find((l) => l.fragment?.name === "JobCreated");

      const escrow = await ethers.getContractAt(
        "FreelanceEscrow",
        event.args.escrow
      );

      expect(await escrow.client()).to.equal(client1.address);
      expect(await escrow.amount()).to.equal(JOB_VALUE_2);
    });
  });

  /* ==================================================
   * VIEW FUNCTIONS TESTS
   * ================================================== */
  describe("View Functions", function () {
    let escrowAddr1, escrowAddr2, escrowAddr3;

    beforeEach(async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3 * ONE_DAY;

      // Create 3 jobs: 2 by client1, 1 by client2
      let tx = await factory
        .connect(client1)
        .createJob(deadline, { value: JOB_VALUE });
      let receipt = await tx.wait();
      escrowAddr1 = receipt.logs.find(
        (l) => l.fragment?.name === "JobCreated"
      ).args.escrow;

      tx = await factory
        .connect(client1)
        .createJob(deadline, { value: JOB_VALUE_2 });
      receipt = await tx.wait();
      escrowAddr2 = receipt.logs.find(
        (l) => l.fragment?.name === "JobCreated"
      ).args.escrow;

      tx = await factory
        .connect(client2)
        .createJob(deadline, { value: JOB_VALUE });
      receipt = await tx.wait();
      escrowAddr3 = receipt.logs.find(
        (l) => l.fragment?.name === "JobCreated"
      ).args.escrow;
    });

    it("✅ totalJobs returns correct count", async function () {
      expect(await factory.totalJobs()).to.equal(3);
    });

    it("✅ getJob returns correct job by index", async function () {
      expect(await factory.getJob(0)).to.equal(escrowAddr1);
      expect(await factory.getJob(1)).to.equal(escrowAddr2);
      expect(await factory.getJob(2)).to.equal(escrowAddr3);
    });

    it("❌ getJob reverts for out of bounds index", async function () {
      await expect(factory.getJob(3)).to.be.revertedWith("Index out of bounds");
      await expect(factory.getJob(100)).to.be.revertedWith(
        "Index out of bounds"
      );
    });

    it("✅ getAllJobs returns correct array", async function () {
      const allJobs = await factory.getAllJobs();

      expect(allJobs.length).to.equal(3);
      expect(allJobs[0]).to.equal(escrowAddr1);
      expect(allJobs[1]).to.equal(escrowAddr2);
      expect(allJobs[2]).to.equal(escrowAddr3);
    });

    it("✅ getJobsByClient returns correct jobs for client1", async function () {
      const client1Jobs = await factory.getJobsByClient(client1.address);

      expect(client1Jobs.length).to.equal(2);
      expect(client1Jobs[0]).to.equal(escrowAddr1);
      expect(client1Jobs[1]).to.equal(escrowAddr2);
    });

    it("✅ getJobsByClient returns correct jobs for client2", async function () {
      const client2Jobs = await factory.getJobsByClient(client2.address);

      expect(client2Jobs.length).to.equal(1);
      expect(client2Jobs[0]).to.equal(escrowAddr3);
    });

    it("✅ getJobsByClient returns empty array for client with no jobs", async function () {
      const noJobs = await factory.getJobsByClient(deployer.address);
      expect(noJobs.length).to.equal(0);
    });

    it("✅ jobs mapping returns correct address", async function () {
      expect(await factory.jobs(0)).to.equal(escrowAddr1);
      expect(await factory.jobs(1)).to.equal(escrowAddr2);
      expect(await factory.jobs(2)).to.equal(escrowAddr3);
    });
  });

  /* ==================================================
   * MULTIPLE JOBS TESTS
   * ================================================== */
  describe("Multiple Jobs", function () {
    it("✅ Can create multiple jobs with different amounts", async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3 * ONE_DAY;

      const amounts = [
        ethers.parseEther("0.5"),
        ethers.parseEther("1.5"),
        ethers.parseEther("5"),
        ethers.parseEther("0.01"),
      ];

      for (let i = 0; i < amounts.length; i++) {
        await factory
          .connect(client1)
          .createJob(deadline, { value: amounts[i] });
      }

      expect(await factory.totalJobs()).to.equal(4);

      const allJobs = await factory.getAllJobs();
      for (let i = 0; i < allJobs.length; i++) {
        const escrow = await ethers.getContractAt(
          "FreelanceEscrow",
          allJobs[i]
        );
        expect(await escrow.amount()).to.equal(amounts[i]);
      }
    });

    it("✅ Jobs from different clients are tracked separately", async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3 * ONE_DAY;

      // Client1 creates 3 jobs
      for (let i = 0; i < 3; i++) {
        await factory
          .connect(client1)
          .createJob(deadline, { value: JOB_VALUE });
      }

      // Client2 creates 2 jobs
      for (let i = 0; i < 2; i++) {
        await factory
          .connect(client2)
          .createJob(deadline, { value: JOB_VALUE });
      }

      expect(await factory.totalJobs()).to.equal(5);
      expect((await factory.getJobsByClient(client1.address)).length).to.equal(
        3
      );
      expect((await factory.getJobsByClient(client2.address)).length).to.equal(
        2
      );
    });
  });
});

