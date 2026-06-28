import { Capacitor } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';

interface CopyToClipboardOptions {
  sourceElement?: HTMLInputElement | HTMLTextAreaElement | null;
}

function copyFromInputElement(element: HTMLInputElement | HTMLTextAreaElement): boolean {
  if (!element.value) {
    return false;
  }

  element.focus();
  element.select();

  if (typeof element.setSelectionRange === 'function') {
    element.setSelectionRange(0, element.value.length);
  }

  let copied = false;

  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }

  window.getSelection()?.removeAllRanges();
  return copied;
}

function copyFromHiddenTextarea(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.width = '1px';
  textarea.style.height = '1px';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let copied = false;

  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }

  document.body.removeChild(textarea);
  return copied;
}

export async function copyToClipboard(
  text: string,
  options: CopyToClipboardOptions = {}
): Promise<void> {
  if (!text) {
    throw new Error('Nothing to copy');
  }

  if (Capacitor.isNativePlatform()) {
    await Clipboard.write({ string: text });
    return;
  }

  // Selecting a visible field is the most reliable approach inside <dialog> modals.
  if (options.sourceElement && copyFromInputElement(options.sourceElement)) {
    return;
  }

  if (copyFromHiddenTextarea(text)) {
    return;
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  throw new Error('Copy failed');
}
