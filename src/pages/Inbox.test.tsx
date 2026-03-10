import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Inbox from './Inbox'

vi.mock('../services/api', () => ({
  fetchInboxEmails: vi.fn(),
  fetchEmailAttachments: vi.fn(),
  getAttachmentDownloadUrl: vi.fn((emailId: number, attId: number) => `/api/inbox/emails/${emailId}/attachments/${attId}`),
}))

const api = await import('../services/api')

beforeEach(() => {
  vi.mocked(api.fetchInboxEmails).mockReset()
  vi.mocked(api.fetchEmailAttachments).mockReset()
})

const mockEmail = {
  id: 1, resendEmailId: 'abc', fromAddress: 'John Doe <john@test.com>',
  toAddresses: 'me@test.com', subject: 'Hello World',
  bodyHtml: '<p>Hi</p>', bodyText: 'Hi',
  receivedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
}

describe('Inbox', () => {
  it('shows loading state', () => {
    vi.mocked(api.fetchInboxEmails).mockReturnValue(new Promise(() => {}))
    render(<Inbox />)
    expect(screen.getByText('Loading inbox...')).toBeInTheDocument()
  })

  it('shows empty state when no emails', async () => {
    vi.mocked(api.fetchInboxEmails).mockResolvedValue({
      content: [], pageable: { pageNumber: 0, pageSize: 20 },
      totalElements: 0, totalPages: 0, last: true, first: true,
    })
    render(<Inbox />)
    await waitFor(() => {
      expect(screen.getByText('No emails received yet.')).toBeInTheDocument()
    })
  })

  it('renders email list', async () => {
    vi.mocked(api.fetchInboxEmails).mockResolvedValue({
      content: [mockEmail], pageable: { pageNumber: 0, pageSize: 20 },
      totalElements: 1, totalPages: 1, last: true, first: true,
    })
    render(<Inbox />)
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Hello World')).toBeInTheDocument()
    })
  })

  it('expands email on click', async () => {
    vi.mocked(api.fetchInboxEmails).mockResolvedValue({
      content: [mockEmail], pageable: { pageNumber: 0, pageSize: 20 },
      totalElements: 1, totalPages: 1, last: true, first: true,
    })
    vi.mocked(api.fetchEmailAttachments).mockResolvedValue([])

    const user = userEvent.setup()
    render(<Inbox />)
    await waitFor(() => screen.getByText('Hello World'))

    await user.click(screen.getByText('Hello World'))
    await waitFor(() => {
      expect(screen.getByText(/john@test.com/)).toBeInTheDocument()
      expect(screen.getByText(/me@test.com/)).toBeInTheDocument()
    })
  })

  it('shows email count', async () => {
    vi.mocked(api.fetchInboxEmails).mockResolvedValue({
      content: [mockEmail], pageable: { pageNumber: 0, pageSize: 20 },
      totalElements: 1, totalPages: 1, last: true, first: true,
    })
    render(<Inbox />)
    await waitFor(() => {
      expect(screen.getByText('1 email')).toBeInTheDocument()
    })
  })

  it('shows attachments', async () => {
    vi.mocked(api.fetchInboxEmails).mockResolvedValue({
      content: [mockEmail], pageable: { pageNumber: 0, pageSize: 20 },
      totalElements: 1, totalPages: 1, last: true, first: true,
    })
    vi.mocked(api.fetchEmailAttachments).mockResolvedValue([
      { id: 10, emailId: 1, filename: 'doc.pdf', contentType: 'application/pdf', sizeBytes: 1024, createdAt: '2026-01-01T00:00:00Z' },
    ])

    const user = userEvent.setup()
    render(<Inbox />)
    await waitFor(() => screen.getByText('Hello World'))
    await user.click(screen.getByText('Hello World'))

    await waitFor(() => {
      expect(screen.getByText('doc.pdf')).toBeInTheDocument()
      expect(screen.getByText('(1.0 KB)')).toBeInTheDocument()
    })
  })
})
