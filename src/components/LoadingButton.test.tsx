import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import LoadingButton from './LoadingButton'

describe('LoadingButton', () => {
  it('renders button label', () => {
    render(<LoadingButton label="Save" />)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('shows loading label when loading', () => {
    render(<LoadingButton label="Save" loading loadingLabel="Saving..." />)
    expect(screen.getByText('Saving...')).toBeInTheDocument()
  })

  it('disables button when loading', () => {
    render(<LoadingButton label="Save" loading />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('button is enabled when not loading', () => {
    render(<LoadingButton label="Save" />)
    expect(screen.getByRole('button')).toBeEnabled()
  })
})
