import JobCard from "./JobCard";

export default function JobList({ jobs = [], onSelect }) {
  if (!jobs.length) {
    return (
      <div className="text-center text-gray-500 py-10">
        📭 No jobs found
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {jobs.map((job) => (
        <JobCard
          key={job.address}
          job={job}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
