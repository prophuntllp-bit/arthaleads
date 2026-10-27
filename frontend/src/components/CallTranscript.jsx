// CallTranscript.jsx — a call transcript as a chat: customer on the left, agent
// on the right, the same look as Vistrow Voice calls (LeadDetail). Turns come
// from utils/callTranscript.js on the server: exact speakers and times for
// stereo (Plivo) recordings, an AI split for mono ones. Older calls only have
// plain text, shown as before.
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function CallTranscript({ meta, agentName, maxHeight = 320 }) {
  const turns = Array.isArray(meta?.transcriptTurns) ? meta.transcriptTurns : [];
  if (!turns.length) {
    if (!meta?.transcript) return null;
    return (
      <div className="rounded-xl p-4 text-sm text-app leading-relaxed whitespace-pre-wrap overflow-y-auto"
        style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", maxHeight }}>
        {meta.transcript}
      </div>
    );
  }
  return (
    <div>
      <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight }}>
        {turns.map((t, i) => {
          const agent = t.speaker === "agent";
          return (
            <div key={i} className={`flex ${agent ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[82%] rounded-2xl px-3.5 py-2"
                style={{
                  background: agent ? "rgba(249,115,22,0.10)" : "var(--app-surface-low)",
                  border: `1px solid ${agent ? "rgba(249,115,22,0.22)" : "var(--app-border)"}`,
                }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5 flex items-center gap-2"
                  style={{ color: agent ? "var(--app-primary)" : "var(--app-text-soft)" }}>
                  {agent ? (agentName || "Agent") : "Customer"}
                  {Number.isFinite(t.start) && <span className="font-medium normal-case tracking-normal text-app-soft tabular-nums">{mmss(t.start)}</span>}
                </p>
                <p className="text-sm text-app whitespace-pre-wrap break-words">{t.text}</p>
              </div>
            </div>
          );
        })}
      </div>
      {meta.transcriptMethod === "ai_split" && (
        <p className="text-[11px] text-app-soft mt-2">Who said what is worked out by AI from a single-track recording, so a line can occasionally be on the wrong side.</p>
      )}
    </div>
  );
}
