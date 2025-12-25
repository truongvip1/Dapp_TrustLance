const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer, arbiter1, arbiter2, arbiter3] =
    await ethers.getSigners();

  console.log("🚀 Deploying with:", deployer.address);

  /* --------------------------------------------------
   * 1. Deploy DisputeMultiSig (multi-escrow)
   * -------------------------------------------------- */
  const arbiters = [
    arbiter1.address,
    arbiter2.address,
    arbiter3.address,
  ];
  const required = 2;

  const DisputeMultiSig = await ethers.getContractFactory("DisputeMultiSig");
  const multisig = await DisputeMultiSig.deploy(arbiters, required);
  await multisig.waitForDeployment();

  const multisigAddress = await multisig.getAddress();
  console.log("✅ DisputeMultiSig deployed:", multisigAddress);

  /* --------------------------------------------------
   * 2. Deploy EscrowFactory (PASS ARBITER)
   * -------------------------------------------------- */
  const EscrowFactory = await ethers.getContractFactory("EscrowFactory");
  const factory = await EscrowFactory.deploy(multisigAddress);
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  console.log("✅ EscrowFactory deployed:", factoryAddress);

  /* --------------------------------------------------
   * 3. (OPTIONAL) Create demo job
   * -------------------------------------------------- */
  const deadline =
    Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // +7 days
  const amount = ethers.parseEther("1");

  const tx = await factory.createJob(deadline, { value: amount });
  const receipt = await tx.wait();

  const event = receipt.logs.find(
    (l) => l.fragment?.name === "JobCreated"
  );

  if (!event) {
    throw new Error("JobCreated event not found");
  }

  const escrowAddress = event.args.escrow;
  console.log("📄 Demo Job created:", escrowAddress);

  /* --------------------------------------------------
   * 4. Save deployment info
   * -------------------------------------------------- */
  const deployment = {
    factory: factoryAddress,
    multisig: multisigAddress,
    demoEscrow: escrowAddress,
    arbiters,
    required,
  };

  const outDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  fs.writeFileSync(
    path.join(outDir, "localhost.json"),
    JSON.stringify(deployment, null, 2)
  );

  console.log("\n🎉 DEPLOY COMPLETED");
  console.log(deployment);
}

main().catch((error) => {
  console.error("❌ Deployment failed");
  console.error(error);
  process.exitCode = 1;
});
