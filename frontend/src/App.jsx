import { useEffect, useState } from "react";
import { connectWallet } from "./lib/ethereum";
import { getFactory, getEscrow } from "./lib/contracts";

import CreateJob from "./components/CreateJob";
import JobList from "./components/JobList";
import JobDetail from "./components/JobDetail";

function App() {
  const [signer, setSigner] = useState(null);
  const [address, setAddress] = useState(null);

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
   * LOAD JOB LIST FROM FACTORY
   * ---------------------------------- */
  async function loadJobs() {
    if (!signer) return;

    const factory = getFactory(signer);
    const jobAddresses = await factory.getAllJobs();

    const result = [];

    for (const addr of jobAddresses) {
      const e = getEscrow(addr, signer);

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
    const job = jobs.find((j) => j.address === jobAddress);
    const escrow = getEscrow(jobAddress, signer);

    setSelectedJob(job);
    setEscrow(escrow);
  }

  /* ----------------------------------
   * REFRESH SINGLE JOB
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

    loadJobs(); // sync list
  }

  useEffect(() => {
    loadJobs();
  }, [signer]);

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

        {/* MAIN CONTENT */}
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
