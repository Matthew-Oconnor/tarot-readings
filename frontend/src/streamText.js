export async function streamText(url, { body, signal, onChunk } = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    signal,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const data = await response.json();
      message = data?.message || data?.error || message;
    } catch {
      const text = await response.text();
      if (text) {
        message = text;
      }
    }

    throw new Error(message);
  }

  if (!response.body) {
    const text = await response.text();
    if (text) {
      onChunk?.(text, text);
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    const chunk = decoder.decode(value, { stream: true });
    if (!chunk) {
      continue;
    }

    fullText += chunk;
    onChunk?.(chunk, fullText);
  }

  const finalChunk = decoder.decode();
  if (finalChunk) {
    fullText += finalChunk;
    onChunk?.(finalChunk, fullText);
  }

  return fullText;
}
