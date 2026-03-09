import React from 'react';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingLabel?: string;
  label: string;
}

export default function LoadingButton({ loading, loadingLabel, label, disabled, ...props }: Readonly<LoadingButtonProps>) {
  return (
    <button {...props} disabled={disabled || loading}>
      {loading ? <><span className="spinner" />{loadingLabel ?? label}</> : label}
    </button>
  );
}
