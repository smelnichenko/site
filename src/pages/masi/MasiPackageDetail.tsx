import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchMasiPackage, MasiPackage } from '../../services/api';
import MasiNav from '../../components/MasiNav';
import PackagePanel from './PackagePanel';
import { errorMessage } from './format';

/** A package on its own page (the queue links here); the job is one click away. */
export default function MasiPackageDetail() {
  const { id } = useParams();
  const [pkg, setPkg] = useState<MasiPackage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchMasiPackage(Number(id), controller.signal)
      .then(setPkg)
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(e, 'Failed to load the package'));
      });
    return () => controller.abort();
  }, [id]);

  return (
    <div className="masi">
      <MasiNav />
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {!pkg && !error && <div className="loading">Loading package...</div>}
      {pkg && (
        <>
          <div className="muted">
            <Link to={`/masi/jobs/${pkg.jobId}`}>{pkg.jobTitle ?? `job ${pkg.jobId}`}</Link>
            {pkg.companyName ? ` · ${pkg.companyName}` : ''}
          </div>
          <PackagePanel pkg={pkg} onChanged={setPkg} />
        </>
      )}
    </div>
  );
}
