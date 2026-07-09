import React from 'react';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingLabel?: string;
  label: string;
}

export default function LoadingButton({
  loading,
  loadingLabel,
  label,
  disabled,
  ...props
}: Readonly<LoadingButtonProps>) {
  return (
    <button {...props} disabled={disabled || loading} aria-busy={loading}>
      {/*
        The spinner is decorative — it duplicates what the label already says, so it is aria-hidden
        rather than a role="status" live region that would announce the same state twice.

        aria-busy carries the state instead. It is needed because `disabled` drops the button out of
        the tab order and moves focus to <body>, so the label swap to loadingLabel is NOT reliably
        announced on its own.
      */}
      {loading ? (
        <>
          <span className="spinner" aria-hidden="true" data-testid="spinner" />
          {loadingLabel ?? label}
        </>
      ) : (
        label
      )}
    </button>
  );
}
