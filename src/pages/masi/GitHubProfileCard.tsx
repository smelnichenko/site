import type { GitHubProfile } from '../../services/api';

/** A page's address as it reads: no scheme, no "www.", no trailing slash. */
function pageLabel(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

/** A linked account's provider in words: LINKEDIN → LinkedIn, the rest as GitHub names them. */
function providerLabel(provider: string | undefined): string {
  switch (provider) {
    case 'LINKEDIN':
      return 'LinkedIn';
    case 'TWITTER':
      return 'X';
    case 'MASTODON':
      return 'Mastodon';
    default:
      return provider ? provider.charAt(0) + provider.slice(1).toLowerCase() : 'link';
  }
}

/** One GitHub person: where they are, what they say, what they write and maintain, who they are with. */
export default function GitHubProfileCard({
  login,
  profile,
}: Readonly<{
  login: string;
  profile: GitHubProfile;
}>) {
  const repos = [...(profile.repositories?.nodes ?? [])].sort(
    (a, b) => (b.stargazerCount ?? 0) - (a.stargazerCount ?? 0),
  );
  const byLanguage = new Map<string, number>();
  for (const r of repos) {
    const lang = r.primaryLanguage?.name;
    if (lang) byLanguage.set(lang, (byLanguage.get(lang) ?? 0) + 1);
  }
  const languages = [...byLanguage.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const counts = [
    profile.followers?.totalCount != null && `${profile.followers.totalCount} followers`,
    profile.following?.totalCount != null && `${profile.following.totalCount} following`,
    profile.repositories?.totalCount != null && `${profile.repositories.totalCount} repositories`,
    profile.contributionsCollection?.contributionCalendar?.totalContributions != null &&
      `${profile.contributionsCollection.contributionCalendar.totalContributions} contributions in the last year`,
  ].filter(Boolean);
  const readme = profile.readme?.object?.text;
  return (
    <div className="card" data-testid="person-github">
      <div className="card-header">
        <span className="card-title">
          GitHub:{' '}
          <a href={`https://github.com/${login}`} target="_blank" rel="noopener noreferrer">
            {login}
          </a>
        </span>
        {profile.isHireable && <span className="status-badge success">open to hire</span>}
      </div>
      {profile.status?.message && <div className="muted">{profile.status.message}</div>}
      <dl className="masi-send-fields">
        {profile.location && (
          <>
            <dt>Location</dt>
            <dd>{profile.location}</dd>
          </>
        )}
        {profile.websiteUrl && (
          <>
            <dt>Website</dt>
            <dd>
              <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer">
                {pageLabel(profile.websiteUrl)}
              </a>
            </dd>
          </>
        )}
        {(profile.socialAccounts?.nodes ?? []).length > 0 && (
          <>
            <dt>Accounts</dt>
            <dd>
              {(profile.socialAccounts?.nodes ?? []).map((a) => (
                <a
                  key={a.url}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginRight: 8 }}
                >
                  {providerLabel(a.provider)}
                </a>
              ))}
            </dd>
          </>
        )}
        {(profile.organizations?.nodes ?? []).length > 0 && (
          <>
            <dt>Organisations</dt>
            <dd>
              {(profile.organizations?.nodes ?? []).map((o) => (
                <a
                  key={o.login}
                  href={`https://github.com/${o.login}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginRight: 8 }}
                >
                  {o.name ?? o.login}
                </a>
              ))}
            </dd>
          </>
        )}
        {languages.length > 0 && (
          <>
            <dt>Languages</dt>
            <dd data-testid="github-languages">
              {languages.map(([l, n]) => `${l} ${n}`).join(', ')}
            </dd>
          </>
        )}
      </dl>
      {counts.length > 0 && <div className="muted">{counts.join(' · ')}</div>}
      {repos.length > 0 && (
        <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
          {repos.slice(0, 8).map((r) => (
            <li key={r.url ?? r.name}>
              <a href={r.url} target="_blank" rel="noopener noreferrer">
                {r.name}
              </a>
              {r.primaryLanguage?.name && (
                <span className="muted"> · {r.primaryLanguage.name}</span>
              )}
              {(r.stargazerCount ?? 0) > 0 && (
                <span className="muted"> · ★ {r.stargazerCount}</span>
              )}
              {r.description && <div className="muted">{r.description}</div>}
            </li>
          ))}
        </ul>
      )}
      {readme && (
        <details>
          <summary>Profile README</summary>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{readme}</pre>
        </details>
      )}
    </div>
  );
}
