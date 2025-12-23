const hre = require("hardhat");
const { ethers } = hre;

// 👇 ĐÚNG ADDRESS BẠN ĐÃ DEPLOY LOCAL
const ESCROW_ADDRESS   = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const MULTISIG_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

async function main() {
  const [client, freelancer, arbiter1, arbiter2, arbiter3] =
    await ethers.getSigners();

  console.log("=== ACTORS ===");
  console.log("Client     :", client.address);
  console.log("Freelancer :", freelancer.address);
  console.log("Arbiter 1  :", arbiter1.address);
  console.log("Arbiter 2  :", arbiter2.address);
  console.log("Arbiter 3  :", arbiter3.address);

  const Escrow = await ethers.getContractFactory("FreelanceEscrow");
  const escrow = Escrow.attach(ESCROW_ADDRESS);

  const MultiSig = await ethers.getContractFactory("DisputeMultiSig");
  const multisig = MultiSig.attach(MULTISIG_ADDRESS);

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
   * 3. Fast-forward time (PASS DEADLINE)
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
   * 5. Arbiters vote (2/3 → freelancer wins)
   * -------------------------------------------------- */
  console.log("\n4️⃣ Arbiters vote (pay freelancer)");

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
