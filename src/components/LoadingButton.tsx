import React from 'react';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingLabel?: string;
  label: string;
}

export default function LoadingButton({ loading, loadingLabel, label, disabled, ...props }: Readonly<LoadingButtonProps>) {
  return (
    <button {...props} disabled={disabled || loading}>
      {/*
        The spinner is decorative: the button is disabled and its label already changes to
        loadingLabel, so a screen reader announces the state without it. Giving it role="status"
        would announce the same thing twice; aria-hidden keeps it visual-only.
      */}
      {loading ? <><span className="spinner" aria-hidden="true" data-testid="spinner" />{loadingLabel ?? label}</> : label}
    </button>
  );
}
