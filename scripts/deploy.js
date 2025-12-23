// import { ethers } from "hardhat";

async function main() {
  const [deployer, arbiter1, arbiter2, arbiter3] =
    await ethers.getSigners();

  console.log("🚀 Deploying with:", deployer.address);

  /* --------------------------------------------------
   * 1. Deploy DisputeMultiSig
   * -------------------------------------------------- */
  const arbiters = [
    arbiter1.address,
    arbiter2.address,
    arbiter3.address,
  ];
  const required = 2;

  const DisputeMultiSig = await ethers.getContractFactory("DisputeMultiSig");
  const multiSig = await DisputeMultiSig.deploy(arbiters, required);
  await multiSig.waitForDeployment();

  console.log("✅ MultiSig deployed:", await multiSig.getAddress());

  /* --------------------------------------------------
   * 2. Deploy EscrowFactory
   * -------------------------------------------------- */
  const EscrowFactory = await ethers.getContractFactory("EscrowFactory");
  const factory = await EscrowFactory.deploy();
  await factory.waitForDeployment();

  console.log("✅ EscrowFactory deployed:", await factory.getAddress());

  /* --------------------------------------------------
   * 3. (OPTIONAL) Create a demo job
   * -------------------------------------------------- */
  const deadline =
    Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const amount = ethers.parseEther("0.1");

  const tx = await factory.createJob(deadline, { value: amount });
  const receipt = await tx.wait();

  // Lấy escrow address từ event
  const event = receipt.logs.find(
    (l) => l.fragment?.name === "JobCreated"
  );

  const escrowAddress = event.args.escrow;

  console.log("📄 Demo Job created:", escrowAddress);

  /* --------------------------------------------------
   * 4. Set arbiter for demo job
   * -------------------------------------------------- */
  const escrow = await ethers.getContractAt(
    "FreelanceEscrow",
    escrowAddress
  );

  await escrow.setArbiter(await multiSig.getAddress());
  console.log("🧑‍⚖️ Arbiter set for demo job");

  console.log("\n🎉 DEPLOY COMPLETED");
  console.log("Factory :", await factory.getAddress());
  console.log("MultiSig:", await multiSig.getAddress());
  console.log("DemoJob :", escrowAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
