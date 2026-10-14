import { API_BASE, getAuthToken } from "./api";

// Streams one Artha answer from POST /api/copilot/chat (server-sent events).
// axios can't read a response as it arrives, so this uses fetch with the same
// cookie and bearer token. Calls onEvent for each event; resolves when the
// stream ends; rejects with { status, message } when the server refuses.
export async function streamArtha(body, onEvent, signal) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/copilot/chat`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    let message = "Artha couldn't answer right now. Please try again.";
    try { const j = await res.json(); if (j?.message) message = j.message; } catch { /* not JSON */ }
    throw Object.assign(new Error(message), { status: res.status, message });
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut;
    while ((cut = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, cut); buffer = buffer.slice(cut + 2);
      if (!chunk.startsWith("data: ")) continue;
      try { onEvent(JSON.parse(chunk.slice(6))); } catch { /* ignore a malformed event */ }
    }
  }
}
