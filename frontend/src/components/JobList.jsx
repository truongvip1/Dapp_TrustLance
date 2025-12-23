import JobCard from "./JobCard";

export default function JobList({ jobs, onSelect }) {
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
