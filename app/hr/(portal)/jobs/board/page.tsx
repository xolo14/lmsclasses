"use client";

import { JobListingsBoard } from "@/components/jobs/JobListingsBoard";

export default function HrJobBoardPage() {
  return (
    <JobListingsBoard
      title="All Job Listings"
      description="Super Admin listings for this month. Your own posts stay on Live Job Postings."
    />
  );
}
