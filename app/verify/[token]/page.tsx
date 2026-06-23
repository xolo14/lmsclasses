"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppLogo } from "@/components/brand/AppLogo";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

type VerifyData = {
  found: boolean;
  isRevoked?: boolean;
  studentName?: string;
  courseName?: string;
  orgName?: string | null;
  certificateNumber?: string;
  issuedAt?: string;
  revokedAt?: string | null;
  certificateId?: string;
};

export default function VerifyCertificatePage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<VerifyData | null>(null);

  useEffect(() => {
    fetch(`/api/certificates/verify/${token}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ found: false }));
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="mb-8">
        <AppLogo size="md" />
      </div>
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-8 shadow-xl">
        {!data && <p className="text-center text-slate-400">Verifying...</p>}
        {data && !data.found && (
          <>
            <p className="text-xl font-semibold text-red-400">Certificate not found</p>
            <p className="mt-2 text-sm text-slate-400">The verification link may be invalid or expired.</p>
          </>
        )}
        {data?.found && data.isRevoked && (
          <>
            <p className="text-xl font-semibold text-amber-400">This certificate has been revoked</p>
            {data.revokedAt && (
              <p className="mt-2 text-sm text-slate-400">Revoked on {formatDateTime(data.revokedAt)}</p>
            )}
            <p className="mt-4 text-sm text-slate-400">For queries: info@lmsclasses.com</p>
          </>
        )}
        {data?.found && !data.isRevoked && (
          <>
            <p className="text-xl font-semibold text-emerald-400">This certificate is authentic</p>
            <dl className="mt-6 space-y-2 text-sm">
              <div><dt className="text-slate-500">Student</dt><dd className="font-medium">{data.studentName}</dd></div>
              <div><dt className="text-slate-500">Course</dt><dd>{data.courseName}</dd></div>
              <div><dt className="text-slate-500">Issued</dt><dd>{data.issuedAt ? formatDateTime(data.issuedAt) : "—"}</dd></div>
              <div><dt className="text-slate-500">Certificate No</dt><dd className="font-mono text-cyan-400">{data.certificateNumber}</dd></div>
              {data.orgName && (
                <div><dt className="text-slate-500">Issued by</dt><dd>{data.orgName}</dd></div>
              )}
            </dl>
            {data.certificateId && (
              <Button className="mt-6 w-full" asChild>
                <a href={`/api/certificates/verify/${token}/download`}>Download PDF</a>
              </Button>
            )}
          </>
        )}
      </div>
      <p className="mt-8 text-sm text-slate-500">
        <Link href="/" className="hover:text-cyan-400">← LMS Classes</Link>
      </p>
    </div>
  );
}
