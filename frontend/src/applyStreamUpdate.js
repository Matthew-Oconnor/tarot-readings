import * as ReactDOM from 'react-dom';

function isBackgroundedDocument() {
  if (typeof document === 'undefined') {
    return false;
  }

  if (document.visibilityState && document.visibilityState !== 'visible') {
    return true;
  }

  if (typeof document.hasFocus === 'function' && !document.hasFocus()) {
    return true;
  }

  return false;
}

export function applyStreamUpdate(setText, text, flush = ReactDOM.flushSync) {
  if (isBackgroundedDocument()) {
    flush(() => {
      setText(text);
    });
    return;
  }

  setText(text);
}

export { isBackgroundedDocument };
