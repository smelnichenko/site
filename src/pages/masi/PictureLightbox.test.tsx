import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PictureLightbox from './PictureLightbox';

const pictures = [
  { url: 'https://example.org/a.jpg', alt: 'Mari, from LinkedIn' },
  { url: 'https://example.org/b.jpg', alt: 'Mari, from GitHub' },
];

describe('PictureLightbox', () => {
  it('closes from the backdrop - a button a keyboard reaches too', async () => {
    const onClose = vi.fn();
    render(<PictureLightbox pictures={pictures} index={0} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open when the picture itself is clicked', async () => {
    const onClose = vi.fn();
    render(<PictureLightbox pictures={pictures} index={0} onClose={onClose} />);
    await userEvent.click(screen.getByRole('img', { name: 'Mari, from LinkedIn' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape and moves with the arrows', async () => {
    const onClose = vi.fn();
    render(<PictureLightbox pictures={pictures} index={0} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Next picture' }));
    expect(screen.getByRole('img', { name: 'Mari, from GitHub' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
