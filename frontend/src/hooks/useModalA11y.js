import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Dialog accessibility: closes on Escape, traps Tab focus inside the dialog,
 * moves focus to the first focusable element on open, restores it on close.
 * Returns a ref for the dialog container element.
 */
const useModalA11y = (open, onClose) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const dialog = ref.current;
    if (!dialog) return undefined;

    const previouslyFocused = document.activeElement;
    const focusables = dialog.querySelectorAll(FOCUSABLE);
    if (focusables.length > 0) focusables[0].focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = Array.from(dialog.querySelectorAll(FOCUSABLE))
        .filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    };
  }, [open, onClose]);

  return ref;
};

export default useModalA11y;
