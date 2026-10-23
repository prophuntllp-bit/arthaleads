import { FileText } from "lucide-react";

// What a WhatsApp message carries besides text: a photo, video, voice note or
// document, shown in the chat bubble (WhatsApp page and the lead's WhatsApp
// tab). Customer files are saved on arrival since 22 Oct 2026; before that only
// "[Image]" was kept, so those older ones say plainly that the file is missing
// instead of leaving an empty bubble.

const LABEL = { image: "Image", video: "Video", audio: "Voice note", document: "Document", sticker: "Sticker" };
const MISSING = {
  image: "📷 Photo (not saved). Ask them to send it again.",
  video: "🎬 Video (not saved). Ask them to send it again.",
  audio: "🎤 Voice note (not saved). Ask them to send it again.",
  document: "📄 Document (not saved). Ask them to send it again.",
};

// The text to show under the media: the caption, without the "[Image]" tag
// the server stores in front of it. Plain text messages are unchanged.
export function messageText(msg) {
  const body = String(msg?.body || "");
  const label = LABEL[msg?.mediaType];
  if (!label) return body;
  return body.replace(new RegExp(`^\\[${label}\\]\\s*`), "").trim();
}

export default function WaMessageMedia({ msg }) {
  const type = msg?.mediaType;
  const url = msg?.mediaUrl;
  if (!type || type === "text" || type === "sticker") return null;
  if (!url) {
    return MISSING[type] ? <p className="mb-1 text-[12px] italic opacity-70">{MISSING[type]}</p> : null;
  }
  if (type === "image") {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img src={url} alt={messageText(msg) || "Photo"} className="rounded-xl mb-1.5 max-w-full max-h-64 object-cover" loading="lazy" />
      </a>
    );
  }
  if (type === "video") {
    return <video src={url} controls preload="metadata" playsInline className="rounded-xl mb-1.5 max-w-full max-h-64 bg-black" />;
  }
  if (type === "audio") {
    return (
      <>
        <audio src={url} controls preload="metadata" className="mb-1.5 w-60 max-w-full" />
        {/* What was said, written out on arrival (backend utils/transcribe.js). */}
        {msg.transcript && <p className="mb-1 max-w-60 text-[12px] italic opacity-80">&ldquo;{msg.transcript}&rdquo;</p>}
      </>
    );
  }
  if (type === "document") {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-xl px-2.5 py-2 mb-1.5 transition hover:opacity-80"
        style={{ background: "rgba(0,0,0,0.05)" }}>
        <FileText className="w-6 h-6 shrink-0" style={{ color: "#ef4444" }} />
        <span className="text-xs font-semibold truncate">{messageText(msg) || "Document"}</span>
      </a>
    );
  }
  return null;
}
