import { useState } from "react";
import { getFactory } from "../lib/contracts";
import { ethers } from "ethers";

export default function CreateJob({ signer, onCreated }) {
  const [amount, setAmount] = useState("0.1");
  const [days, setDays] = useState(7);

  async function create() {
    const factory = getFactory(signer);

    const deadline =
      Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;

    const tx = await factory.createJob(deadline, {
      value: ethers.parseEther(amount),
    });

    await tx.wait();
    alert("Job created");
    onCreated();
  }

  return (
    <div>
      <h3>➕ Create Job</h3>
    <p>Value</p>
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="ETH amount"
      />
    <br />
    <p>Deadline (days)</p>
      <input
        value={days}
        onChange={(e) => setDays(e.target.value)}
        placeholder="Deadline (days)"
      />
    <br />
      <button onClick={create}>Create</button>
    </div>
  );
}
