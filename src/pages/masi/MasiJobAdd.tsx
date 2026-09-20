import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addMasiJobManually, MasiManualJob } from '../../services/api';
import MasiNav from '../../components/MasiNav';
import LoadingButton from '../../components/LoadingButton';
import { endOfDayIn, errorMessage, MASI_ZONE } from './format';

/** Something other than white space: `required` alone lets a field of spaces through, and the server gets "". */
const NOT_BLANK = '.*\\S.*';

/**
 * A posting from a board masi never contacts (LinkedIn and the like), pasted in by hand. Its URL is stored and never
 * fetched, so nothing will ever see it disappear: it closes by its deadline.
 */
export default function MasiJobAdd() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [until, setUntil] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  // a refusal is shown above the fields and takes the focus: a submit with Enter from the top of a long form
  // must not answer somewhere below the fold
  useEffect(() => {
    if (error) {
      alertRef.current?.focus();
      alertRef.current?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [error]);

  async function submit() {
    const posting: MasiManualJob = {
      url: url.trim(),
      company: company.trim(),
      title: title.trim(),
    };
    if (location.trim()) posting.location = location.trim();
    if (description.trim()) posting.description = description.trim();
    const expiresAt = until ? endOfDayIn(until) : null;
    if (expiresAt) posting.expiresAt = expiresAt;
    setBusy(true);
    setError(null);
    try {
      const job = await addMasiJobManually(posting);
      await navigate(`/masi/jobs/${job.id}`);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to add the job'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="masi">
      <MasiNav />
      <div className="card">
        <div className="card-header">
          <span className="card-title">Add a job by hand</span>
          <Link to="/masi/jobs">back to jobs</Link>
        </div>
        <p className="masi-intro">
          For postings on boards masi does not read (LinkedIn, Glassdoor, Facebook). The link is
          stored and never fetched, so nothing can tell when the posting is taken down: it stays
          open through the day you give ({MASI_ZONE.split('/')[1]} time), or for masi&rsquo;s
          default lifetime for a pasted posting when you give none. If a board already shows the
          same role at the same company, this becomes another listing of that job.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {error && (
            <div className="error" role="alert" tabIndex={-1} ref={alertRef}>
              {error}
            </div>
          )}
          <div className="form-group">
            <label htmlFor="add-url">
              Posting URL <span className="required">*</span>
            </label>
            <input
              id="add-url"
              placeholder="https://www.linkedin.com/jobs/view/…"
              title="the full link, starting with https://"
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="add-company">
              Company <span className="required">*</span>
            </label>
            <input
              id="add-company"
              placeholder="as the posting spells it"
              title="the company's name, not only spaces"
              required
              pattern={NOT_BLANK}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="add-title">
              Title <span className="required">*</span>
            </label>
            <input
              id="add-title"
              placeholder="as the posting spells it"
              title="the job title, not only spaces"
              required
              pattern={NOT_BLANK}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="add-location">Location (optional)</label>
            <input
              id="add-location"
              placeholder="city, or remote"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="add-until">Open until (optional)</label>
            <input
              id="add-until"
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="add-description">Description (optional)</label>
            <textarea
              id="add-description"
              rows={10}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <LoadingButton
            type="submit"
            className="status-badge add"
            loading={busy}
            label="Add job"
          />
        </form>
      </div>
    </div>
  );
}
