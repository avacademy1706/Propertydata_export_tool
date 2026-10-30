"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Paperclip, Send, CheckCircle2, Sparkles, Video as VideoIcon, Image as ImageIcon } from "lucide-react";
import { api } from "@/app/lib/api.ts";
import { Spinner, useToast } from "@/app/components/ui.tsx";
import type { ProcessResult } from "@/app/lib/types.ts";

interface Attachment {
  file: File;
  previewUrl: string;
  isImage: boolean;
}

interface ConversationItem {
  id: number;
  text: string;
  attachments: Attachment[];
  time: string;
  result?: ProcessResult;
  mediaResult?: Array<{ id: string; mediaType: string; url: string }>;
  state: "processing" | "done" | "error";
  error?: string;
}

const MAX_MB = 50;

export function WhatsAppAssistant({ onProcessed, onViewAll, onClose }: {
  onProcessed: () => void;
  onViewAll: (tab: "buyers" | "sellers") => void;
  onClose?: () => void;
}) {
  const [text, setText] = useState("");
  const [hint, setHint] = useState<"auto" | "buyer" | "seller">("auto");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [items]);

  useEffect(() => {
    return () => attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const next: Attachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_MB * 1024 * 1024) {
        toast("warning", `${file.name} is larger than ${MAX_MB} MB and was skipped.`);
        continue;
      }
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (!isImage && !isVideo && file.type !== "application/pdf") {
        toast("warning", `${file.name} is not a supported image, video, or PDF.`);
        continue;
      }
      next.push({ file, previewUrl: URL.createObjectURL(file), isImage });
    }
    setAttachments((a) => [...a, ...next]);
  }

  function removeAttachment(idx: number) {
    setAttachments((a) => {
      URL.revokeObjectURL(a[idx].previewUrl);
      return a.filter((_, i) => i !== idx);
    });
  }

  async function send() {
    if (!text.trim() && attachments.length === 0) {
      toast("warning", "Type a message or attach a photo/video first.");
      return;
    }
    const itemId = Date.now();
    const snapshotText = text;
    const snapshotAttachments = attachments;
    const item: ConversationItem = {
      id: itemId,
      text: snapshotText || "(media only)",
      attachments: snapshotAttachments,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      state: "processing",
    };
    setItems((prev) => [...prev, item]);
    setText("");
    setAttachments([]);
    setBusy(true);

    try {
      const result = await api.processMessage(snapshotText || "[media message]", hint);
      let mediaResult: Array<{ id: string; mediaType: string; url: string }> | undefined;

      if (snapshotAttachments.length > 0) {
        const firstBuyer = result.createdRecords.find((r) => r.type === "buyer")?.id;
        const firstSeller = result.createdRecords.find((r) => r.type === "seller")?.id;
        const uploaded = await api.uploadMedia(
          snapshotAttachments.map((a) => a.file),
          { buyerId: firstBuyer, sellerId: firstSeller },
        );
        mediaResult = uploaded.media;
      }

      setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, state: "done", result, mediaResult } : it)));
      onProcessed();

      if (result.duplicate) toast("info", result.message);
      else if (result.status === "NEEDS_REVIEW" || result.detectedType === "unknown") toast("warning", result.message);
      else toast("success", result.message);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Processing failed.";
      setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, state: "error", error: msg } : it)));
      toast("error", msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="flex h-full w-full flex-col border-l" style={{ background: "var(--surface)", borderColor: "var(--border-strong)" }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3.5" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full text-white" style={{ background: "var(--whatsapp)" }}>
            <MessageCircle size={20} />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-tight">WhatsApp Assistant</h2>
            <p className="text-xs" style={{ color: "var(--muted)" }}>Send or paste messages to extract property data</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close assistant" className="rounded-md p-2 hover:bg-[var(--surface-muted)]" style={{ color: "var(--muted)" }}>
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="scroll-area flex-1 space-y-4 overflow-y-auto p-4">
        <div className="rounded-xl p-3" style={{ background: "var(--whatsapp-soft)" }}>
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--whatsapp)" }}>
            <CheckCircle2 size={16} /> Ready to process
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            Send WhatsApp messages or paste text, images, or videos. I&apos;ll extract and organize the property data for you.
          </p>
        </div>

        {items.map((it) => (
          <ConversationBlock key={it.id} item={it} onViewAll={onViewAll} />
        ))}
      </div>

      {/* Composer */}
      <div className="border-t p-3" style={{ borderColor: "var(--border)" }}>
        <div role="group" aria-label="Classification hint" className="mb-2 inline-flex overflow-hidden rounded-md border text-xs" style={{ borderColor: "var(--border-strong)" }}>
          {(["auto", "buyer", "seller"] as const).map((h) => (
            <button key={h} onClick={() => setHint(h)} aria-pressed={hint === h} className="px-2.5 py-1 capitalize" style={{ background: hint === h ? "var(--accent)" : "var(--surface)", color: hint === h ? "#fff" : "var(--muted)" }}>
              {h === "auto" ? "Auto" : h}
            </button>
          ))}
        </div>

        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <div key={i} className="relative">
                {a.isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.previewUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg" style={{ background: "var(--surface-muted)", color: "var(--muted)" }}>
                    <VideoIcon size={18} />
                  </div>
                )}
                <button onClick={() => removeAttachment(i)} aria-label={`Remove ${a.file.name}`} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ background: "var(--danger)" }}>
                  <X size={12} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 rounded-xl border p-2" style={{ borderColor: "var(--border-strong)", background: "var(--surface-muted)" }}>
          <input ref={fileRef} type="file" accept="image/*,video/*,application/pdf" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); if (fileRef.current) fileRef.current.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} aria-label="Attach photos or videos" className="rounded-lg p-2 hover:bg-[var(--surface)]" style={{ color: "var(--muted)" }} title="Attach photos or videos">
            <Paperclip size={18} aria-hidden="true" />
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }}
            rows={1}
            aria-label="Message to process"
            placeholder="Type or paste message here..."
            className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none"
            style={{ color: "var(--foreground)" }}
          />
          <button onClick={() => void send()} disabled={busy} aria-label="Send message" className="flex h-9 w-9 items-center justify-center rounded-lg text-white disabled:opacity-50" style={{ background: "var(--accent)" }} title="Send (Ctrl/Cmd+Enter)">
            {busy ? <Spinner /> : <Send size={16} aria-hidden="true" />}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[11px]" style={{ color: "var(--muted-soft)" }}>
          You can also send images, videos or forward WhatsApp messages.
        </p>
      </div>
    </aside>
  );
}

function ConversationBlock({ item, onViewAll }: { item: ConversationItem; onViewAll: (tab: "buyers" | "sellers") => void }) {
  return (
    <div className="space-y-2 animate-slide-in">
      {/* Message bubble */}
      <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-sm border p-3" style={{ background: "var(--surface-muted)", borderColor: "var(--border)" }}>
        {item.text && <p className="whitespace-pre-wrap text-sm">{item.text}</p>}
        {item.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {item.attachments.map((a, i) =>
              a.isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={a.previewUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
              ) : (
                <div key={i} className="flex h-16 w-16 items-center justify-center rounded-lg" style={{ background: "var(--surface)", color: "var(--muted)" }}>
                  <VideoIcon size={18} />
                </div>
              ),
            )}
          </div>
        )}
        <div className="mt-1 text-right text-[10px]" style={{ color: "var(--muted-soft)" }}>{item.time}</div>
      </div>

      {/* Processing / result card */}
      {item.state === "processing" && (
        <div className="rounded-xl border p-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--accent)" }}>
            <Sparkles size={15} /> Processing message...
          </div>
          <div className="mt-2"><Spinner label="Extracting property details" /></div>
        </div>
      )}

      {item.state === "error" && (
        <div className="rounded-xl border p-3 text-sm" style={{ background: "var(--danger-soft)", color: "var(--danger)", borderColor: "var(--danger)" }}>
          {item.error}
        </div>
      )}

      {item.state === "done" && item.result && (
        <ResultCard result={item.result} mediaResult={item.mediaResult} onViewAll={onViewAll} />
      )}
    </div>
  );
}

function ResultCard({ result, mediaResult, onViewAll }: {
  result: ProcessResult;
  mediaResult?: Array<{ id: string; mediaType: string; url: string }>;
  onViewAll: (tab: "buyers" | "sellers") => void;
}) {
  const buyerCount = result.createdRecords.filter((r) => r.type === "buyer").length;
  const sellerCount = result.createdRecords.filter((r) => r.type === "seller").length;
  const total = result.createdRecords.length;

  // A duplicate was already processed earlier — don't show extraction steps or a
  // misleading "confidence 0%".
  if (result.duplicate) {
    return (
      <div className="rounded-xl border p-3 text-xs" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 font-medium" style={{ color: "var(--info)" }}>
          <CheckCircle2 size={14} aria-hidden="true" /> Already in your records
        </div>
        <p className="mt-1" style={{ color: "var(--muted)" }}>
          This message was processed earlier, so nothing new was added.
        </p>
      </div>
    );
  }

  const steps: Array<{ ok: boolean; label: string }> = [
    { ok: true, label: result.duplicate ? "Detected as duplicate" : `Found ${total} property record${total === 1 ? "" : "s"}` },
    { ok: result.detectedType !== "unknown", label: `Classified as ${result.detectedType}` },
    { ok: !result.needsReview, label: result.needsReview ? "Some details need review" : "Extracted key details" },
    { ok: total > 0, label: total > 0 ? "Added to database" : "Saved for review" },
  ];

  return (
    <div className="space-y-2">
      <div className="rounded-xl border p-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2 py-0.5 text-xs">
            <CheckCircle2 size={14} style={{ color: s.ok ? "var(--success)" : "var(--warning)" }} />
            <span style={{ color: "var(--muted)" }}>{s.label}</span>
          </div>
        ))}
        <div className="mt-1 text-[10px]" style={{ color: "var(--muted-soft)" }}>
          confidence {Math.round(result.confidence * 100)}%
        </div>
      </div>

      {total > 0 && (
        <div className="rounded-xl border p-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">
              {total} record{total === 1 ? "" : "s"} added
            </span>
            {(buyerCount > 0 || sellerCount > 0) && (
              <button onClick={() => onViewAll(sellerCount >= buyerCount ? "sellers" : "buyers")} className="text-xs font-medium" style={{ color: "var(--accent)" }}>
                View All
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-xs" style={{ color: "var(--muted)" }}>
            {buyerCount > 0 && <span>{buyerCount} buyer{buyerCount === 1 ? "" : "s"}</span>}
            {sellerCount > 0 && <span>{sellerCount} seller{sellerCount === 1 ? "" : "s"}</span>}
          </div>
          {mediaResult && mediaResult.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {mediaResult.map((m) =>
                m.mediaType === "IMAGE" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={m.id} src={`${m.url}?thumbnail=1`} alt="" className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div key={m.id} className="flex h-12 w-12 items-center justify-center rounded-lg" style={{ background: "var(--surface-muted)", color: "var(--muted)" }}>
                    {m.mediaType === "VIDEO" ? <VideoIcon size={16} /> : <ImageIcon size={16} />}
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
