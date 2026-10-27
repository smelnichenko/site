import { useEffect, useState } from 'react';

/** One picture to show enlarged. */
export interface ViewerPicture {
  url: string;
  alt: string;
}

/**
 * A full-screen picture viewer: the large picture, left/right when there are several, the
 * backdrop click and Escape close it. The page behind stays inert while it is open.
 */
export default function PictureLightbox({
  pictures,
  index,
  onClose,
}: Readonly<{
  pictures: ViewerPicture[];
  index: number;
  onClose: () => void;
}>) {
  const [current, setCurrent] = useState(Math.max(0, Math.min(index, pictures.length - 1)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        setCurrent((i) => (i - 1 + pictures.length) % pictures.length);
      } else if (e.key === 'ArrowRight') {
        setCurrent((i) => (i + 1) % pictures.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pictures.length]);

  const picture = pictures[current];
  if (!picture) {
    return null;
  }
  return (
    <dialog open className="picture-lightbox" aria-modal="true" aria-label={picture.alt}>
      {/* the backdrop: a click beside the picture closes it - a button, so a keyboard reaches it too */}
      <button
        type="button"
        className="picture-lightbox-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <img src={picture.url} alt={picture.alt} />
      {pictures.length > 1 && (
        <>
          <button
            type="button"
            className="picture-lightbox-arrow left"
            aria-label="Previous picture"
            onClick={(e) => {
              e.stopPropagation();
              setCurrent((i) => (i - 1 + pictures.length) % pictures.length);
            }}
          >
            ‹
          </button>
          <button
            type="button"
            className="picture-lightbox-arrow right"
            aria-label="Next picture"
            onClick={(e) => {
              e.stopPropagation();
              setCurrent((i) => (i + 1) % pictures.length);
            }}
          >
            ›
          </button>
          <div className="picture-lightbox-count">
            {current + 1} / {pictures.length}
          </div>
        </>
      )}
    </dialog>
  );
}
