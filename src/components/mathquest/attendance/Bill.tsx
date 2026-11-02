"use client";

import { useEffect, useMemo, useState } from "react";
import { parentMessage, type BillSettings, type TuitionClass, type TuitionInvoice, type TuitionSession } from "@/lib/mathQuest/tuition";
import { billFileName, renderBill, type BillInput } from "./billImage";
import { CopyMessage, type Act } from "./ui";

/** Opens the bill preview for one closed invoice. */
export function BillButton(props: { cls: TuitionClass; invoice: TuitionInvoice; sessions: TuitionSession[]; settings: BillSettings; act: Act; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`rounded-lg px-2.5 py-1 text-xs font-bold ${props.primary ? "bg-clay-500 text-white" : "border border-cream-200 bg-white"}`}
      >
        🧾 Phiếu học phí
      </button>
      {open && <BillModal {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * The bill as the parent will receive it: the very PNG that gets saved or
 * shared, plus the plain-text message and the issuer details printed on it.
 */
function BillModal({
  cls,
  invoice,
  sessions,
  settings,
  act,
  onClose,
}: {
  cls: TuitionClass;
  invoice: TuitionInvoice;
  sessions: TuitionSession[];
  settings: BillSettings;
  act: Act;
  onClose: () => void;
}) {
  const [image, setImage] = useState<{ url: string; file: File } | null>(null);
  const [failed, setFailed] = useState(false);
  const [shareable, setShareable] = useState(false);
  const [editing, setEditing] = useState(false);
  const [tutorName, setTutorName] = useState(settings.tutorName);
  const [note, setNote] = useState(settings.note);

  // Redrawn only when what's printed changes (paid toggled, details edited) —
  // the parent hands over fresh arrays on every render.
  const signature = JSON.stringify({ cls, invoice, sessions, settings });
  const input = useMemo(() => JSON.parse(signature) as BillInput, [signature]);
  useEffect(() => {
    let cancelled = false;
    let url = "";
    setImage(null);
    setFailed(false);
    renderBill(input)
      .then((blob) => {
        if (cancelled) return;
        const file = new File([blob], billFileName(input.cls, input.invoice), { type: "image/png" });
        url = URL.createObjectURL(blob);
        setImage({ url, file });
        // Phones can hand the image straight to Zalo / Messenger / Photos.
        setShareable(typeof navigator.canShare === "function" && navigator.canShare({ files: [file] }));
      })
      .catch((error) => {
        console.error("[tuition] bill image failed", error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [input]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const share = async () => {
    if (!image) return;
    try {
      await navigator.share({ files: [image.file], title: `Học phí ${invoice.title} – ${cls.name}` });
    } catch {
      // Share sheet dismissed.
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Phiếu học phí"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-cream-50 shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center gap-2 border-b border-cream-200 px-4 py-3">
          <p className="min-w-0 flex-1 truncate font-draw-display text-lg font-extrabold">
            🧾 {cls.name} · {invoice.title}
          </p>
          <button onClick={onClose} className="h-9 w-9 shrink-0 rounded-full text-xl text-ink/50 hover:bg-cream-100" aria-label="Đóng">
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- a blob: URL drawn in the browser
            <img src={image.url} alt={`Phiếu học phí ${invoice.title} của ${cls.name}`} className="w-full rounded-xl shadow-md ring-1 ring-cream-200" />
          ) : failed ? (
            <p className="py-16 text-center text-sm text-red-600">Không vẽ được phiếu, thử mở lại nhé.</p>
          ) : (
            <p className="animate-pulse py-24 text-center text-sm text-ink/50">Đang soạn phiếu…</p>
          )}

          {editing ? (
            <div className="mt-3 space-y-2 rounded-xl border border-cream-200 bg-white p-3">
              <label className="block text-sm">
                <span className="text-ink/60">Tên gia sư (in ở đầu phiếu và chỗ người lập phiếu)</span>
                <input
                  value={tutorName}
                  onChange={(event) => setTutorName(event.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="mt-1 w-full rounded-lg border border-cream-200 px-3 py-2 outline-none focus:border-clay-500"
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink/60">Ghi chú cuối phiếu (không bắt buộc)</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  placeholder={"Ví dụ: STK 0123456789 – Vietcombank – NGUYEN VAN A\nNội dung: Hoc phi thang 10 Nhat Vinh"}
                  className="mt-1 w-full rounded-lg border border-cream-200 px-3 py-2 text-sm outline-none focus:border-clay-500"
                />
              </label>
              <p className="text-xs text-ink/50">Lưu một lần, dùng cho mọi phiếu của mọi lớp.</p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (await act({ action: "save_bill_settings", tutorName, note })) setEditing(false);
                  }}
                  className="rounded-lg bg-clay-500 px-4 py-2 text-sm font-bold text-white"
                >
                  Lưu
                </button>
                <button
                  onClick={() => {
                    setTutorName(settings.tutorName);
                    setNote(settings.note);
                    setEditing(false);
                  }}
                  className="px-2 text-sm text-ink/50"
                >
                  Hủy
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="mt-3 text-sm font-semibold text-clay-600 hover:underline">
              ✎ Sửa tên gia sư / ghi chú trên phiếu
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-cream-200 bg-white px-4 py-3">
          {image && (
            <a href={image.url} download={image.file.name} className="flex-1 rounded-xl bg-clay-500 px-4 py-2.5 text-center font-bold text-white">
              ⬇️ Tải ảnh
            </a>
          )}
          {image && shareable && (
            <button onClick={share} className="flex-1 rounded-xl border-2 border-clay-500 px-4 py-2 font-bold text-clay-600">
              📤 Gửi qua Zalo…
            </button>
          )}
          <div className="flex w-full flex-wrap items-center gap-1.5">
            <CopyMessage text={parentMessage(cls, invoice.title, sessions)} />
          </div>
        </div>
      </div>
    </div>
  );
}
