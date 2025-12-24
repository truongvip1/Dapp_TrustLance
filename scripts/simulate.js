const hre = require("hardhat");
const { ethers } = hre;
const deployment = require("../deployments/localhost.json");

async function main() {
  const [client, freelancer, arbiter1, arbiter2, arbiter3] =
    await ethers.getSigners();

  console.log("=== ACTORS ===");
  console.log("Client     :", client.address);
  console.log("Freelancer :", freelancer.address);
  console.log("Arbiter 1  :", arbiter1.address);
  console.log("Arbiter 2  :", arbiter2.address);
  console.log("Arbiter 3  :", arbiter3.address);

  const escrow = await ethers.getContractAt(
    "FreelanceEscrow",
    deployment.escrow
  );

  const multisig = await ethers.getContractAt(
    "DisputeMultiSig",
    deployment.multisig
  );

  /* --------------------------------------------------
   * 1. Freelancer accepts job
   * -------------------------------------------------- */
  console.log("\n1️⃣ Freelancer accepts job");
  await (await escrow.connect(freelancer).acceptJob()).wait();
  console.log("✅ Job accepted");

  /* --------------------------------------------------
   * 2. Freelancer submits work
   * -------------------------------------------------- */
  console.log("\n2️⃣ Freelancer submits work");
  await (await escrow.connect(freelancer).submitWork()).wait();
  console.log("✅ Work submitted");

  /* --------------------------------------------------
   * 3. Fast-forward time (pass deadline)
   * -------------------------------------------------- */
  console.log("\n⏩ Fast-forward time past deadline");
  await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
  await ethers.provider.send("evm_mine");

  /* --------------------------------------------------
   * 4. Client opens dispute
   * -------------------------------------------------- */
  console.log("\n3️⃣ Client opens dispute");
  await (await escrow.connect(client).dispute()).wait();
  console.log("⚠️ Dispute opened");

  /* --------------------------------------------------
   * 5. Arbiters vote (2/3 → PAY freelancer)
   * -------------------------------------------------- */
  console.log("\n4️⃣ Arbiters vote");

  await (await multisig.connect(arbiter1).vote(true)).wait();
  console.log("🗳️ Arbiter1 voted PAY freelancer");

  await (await multisig.connect(arbiter2).vote(true)).wait();
  console.log("🗳️ Arbiter2 voted PAY freelancer");

  /* --------------------------------------------------
   * 6. Final balance check
   * -------------------------------------------------- */
  const balance = await ethers.provider.getBalance(freelancer.address);

  console.log(
    "\n💰 Freelancer final balance:",
    ethers.formatEther(balance),
    "ETH"
  );

  console.log("\n🎉 FULL ESCROW → DISPUTE FLOW COMPLETED");
}

main().catch((error) => {
  console.error("\n❌ Simulation failed");
  console.error(error);
  process.exit(1);
});
