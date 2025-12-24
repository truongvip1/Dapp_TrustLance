const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

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
  const multisig = await DisputeMultiSig.deploy(arbiters, required);
  await multisig.waitForDeployment();

  const multisigAddress = await multisig.getAddress();
  console.log("✅ MultiSig deployed:", multisigAddress);

  /* --------------------------------------------------
   * 2. Deploy EscrowFactory
   * -------------------------------------------------- */
  const EscrowFactory = await ethers.getContractFactory("EscrowFactory");
  const factory = await EscrowFactory.deploy();
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  console.log("✅ EscrowFactory deployed:", factoryAddress);

  /* --------------------------------------------------
   * 3. Create demo escrow job
   * -------------------------------------------------- */
  const deadline =
    Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // +7 days
  const amount = ethers.parseEther("100");

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
   * 4. Set arbiter (multisig) for escrow
   * -------------------------------------------------- */
  const escrow = await ethers.getContractAt(
    "FreelanceEscrow",
    escrowAddress
  );

  await (await escrow.setArbiter(multisigAddress)).wait();
  console.log("🧑‍⚖️ Arbiter set for demo job");

  /* --------------------------------------------------
   * 5. 🔥 LINK ESCROW → MULTISIG (FIX QUAN TRỌNG)
   * -------------------------------------------------- */
  await (await multisig.setEscrow(escrowAddress)).wait();
  console.log("🔗 Escrow linked to MultiSig");

  /* --------------------------------------------------
   * 6. Safety check (optional but recommended)
   * -------------------------------------------------- */
  const code = await ethers.provider.getCode(multisigAddress);
  if (code === "0x") {
    throw new Error("MultiSig is not a contract");
  }

  /* --------------------------------------------------
   * 7. Save deployment info
   * -------------------------------------------------- */
  const deployment = {
    factory: factoryAddress,
    multisig: multisigAddress,
    escrow: escrowAddress,
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
  console.error(error);
  process.exitCode = 1;
});
