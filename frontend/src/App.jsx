import { useEffect, useState } from "react";
import { ethers } from "ethers";

import { connectWallet } from "./lib/ethereum";
import {
  getFactory,
  getEscrow,
  getMultiSig,
} from "./lib/contracts";

import CreateJob from "./components/CreateJob";
import JobList from "./components/JobList";
import JobDetail from "./components/JobDetail";

import {
  FACTORY_ADDRESS,
  MULTISIG_ADDRESS,
} from "./config";

function App() {
  /* ----------------------------------
   * WALLET / SIGNER
   * ---------------------------------- */
  const [signer, setSigner] = useState(null);
  const [address, setAddress] = useState(null);

  /* ----------------------------------
   * CONTRACT CONTEXT
   * ---------------------------------- */
  const [factory, setFactory] = useState(null);
  const [multisig, setMultisig] = useState(null);
  const [arbiters, setArbiters] = useState([]);

  /* ----------------------------------
   * JOB STATE
   * ---------------------------------- */
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [escrow, setEscrow] = useState(null);

  /* ----------------------------------
   * CONNECT WALLET
   * ---------------------------------- */
  async function connect() {
    const { signer, address } = await connectWallet();
    setSigner(signer);
    setAddress(address);
  }

  /* ----------------------------------
   * LOAD FACTORY (READ-ONLY)
   * ---------------------------------- */
  useEffect(() => {
    if (!window.ethereum) return;

    const provider = new ethers.BrowserProvider(window.ethereum);
    const f = getFactory(provider);
    setFactory(f);
  }, []);

  /* ----------------------------------
   * LOAD MULTISIG (WRITE)
   * ---------------------------------- */
  useEffect(() => {
    if (!signer) return;

    async function loadMultisig() {
      const m = getMultiSig(signer);
      setMultisig(m);

      const list = await m.getArbiters();
      setArbiters(list);
    }

    loadMultisig();
  }, [signer]);

  /* ----------------------------------
   * LOAD JOB LIST
   * ---------------------------------- */
  async function loadJobs() {
    if (!factory) return;

    const provider = factory.runner.provider;
    const jobAddresses = await factory.getAllJobs();

    const result = [];

    for (const addr of jobAddresses) {
      const e = getEscrow(addr, provider);

      const [
        client,
        freelancer,
        amount,
        deadline,
        status,
      ] = await Promise.all([
        e.client(),
        e.freelancer(),
        e.amount(),
        e.deadline(),
        e.status(),
      ]);

      result.push({
        address: addr,
        client,
        freelancer,
        amount,
        deadline: Number(deadline),
        status: Number(status),
      });
    }

    setJobs(result);
  }

  /* ----------------------------------
   * SELECT JOB
   * ---------------------------------- */
  async function selectJob(jobAddress) {
    if (!signer) return;

    const job = jobs.find(j => j.address === jobAddress);
    const e = getEscrow(jobAddress, signer);

    setSelectedJob(job);
    setEscrow(e);
  }

  /* ----------------------------------
   * REFRESH SELECTED JOB
   * ---------------------------------- */
  async function refreshSelectedJob() {
    if (!escrow || !selectedJob) return;

    const [
      freelancer,
      status,
    ] = await Promise.all([
      escrow.freelancer(),
      escrow.status(),
    ]);

    setSelectedJob({
      ...selectedJob,
      freelancer,
      status: Number(status),
    });

    loadJobs();
  }

  /* ----------------------------------
   * INITIAL LOAD
   * ---------------------------------- */
  useEffect(() => {
    loadJobs();
  }, [factory]);

  /* ----------------------------------
   * UI
   * ---------------------------------- */
  if (!signer) {
    return (
      <div className="h-screen flex items-center justify-center">
        <button
          onClick={connect}
          className="px-6 py-3 bg-black text-white rounded-lg"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <p className="text-xs text-gray-400">
        Factory: {FACTORY_ADDRESS} <br />
        MultiSig: {MULTISIG_ADDRESS}
      </p>

      <div className="max-w-6xl mx-auto space-y-6">

        {/* HEADER */}
        <header className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">
            TrustLance Marketplace
          </h1>
          <span className="text-sm text-gray-600">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        </header>

        {/* CREATE JOB */}
        <CreateJob signer={signer} onCreated={loadJobs} />

        {/* MAIN */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* JOB LIST */}
          <div className="md:col-span-1">
            <JobList jobs={jobs} onSelect={selectJob} />
          </div>

          {/* JOB DETAIL */}
          <div className="md:col-span-2">
            {selectedJob ? (
              <JobDetail
                escrow={escrow}
                multisig={multisig}
                arbiters={arbiters}
                job={selectedJob}
                address={address}
                refresh={refreshSelectedJob}
              />
            ) : (
              <div className="border rounded-lg p-6 text-gray-500">
                Select a job to view details
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;
