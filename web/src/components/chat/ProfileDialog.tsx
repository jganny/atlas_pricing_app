"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui";
import { toast } from "@/components/Toast";
import { Avatar } from "./Avatar";
import { useTeamChat } from "./ChatProvider";
import { MAX_STATUS_CHARS, STATUS_PRESETS, cleanStatus, photoFromFile } from "@/lib/chat/profile";

/** "My profile": a small photo and a one-line status. Work use only — that is all there is. */
export function ProfileDialog({ onClose }: { onClose: () => void }) {
  const chat = useTeamChat();
  const me = chat.me;
  const mine = me ? chat.profiles[me.login] : undefined;
  const [status, setStatus] = useState(mine?.status ?? "");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  if (!me) return null;

  async function run(job: () => Promise<void>, done: string) {
    setBusy(true);
    try {
      await job();
      toast(done, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save that. Try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-label="My profile" data-testid="profile-dialog">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-[var(--color-atlas-navy)]">My profile</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <Avatar name={me.name} seed={me.login} size={72} />
          <div className="space-y-1.5">
            <p className="text-sm font-semibold">{me.name}</p>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              data-testid="profile-photo-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void run(async () => chat.saveProfile({ photo: await photoFromFile(file) }), "Photo saved.");
              }}
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => fileInput.current?.click()}>
                <Camera className="mr-1 h-3.5 w-3.5" /> {mine?.photo ? "Change photo" : "Add photo"}
              </Button>
              {mine?.photo ? (
                <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void run(() => chat.saveProfile({ photo: "" }), "Photo removed.")}>
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="chat-status" className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Status
          </label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {STATUS_PRESETS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${status === s ? "border-sky-400 bg-sky-50" : "border-slate-200 hover:bg-slate-50"}`}
              >
                {s}
              </button>
            ))}
          </div>
          <input
            id="chat-status"
            value={status}
            maxLength={MAX_STATUS_CHARS}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="Or write your own (work only)"
            data-testid="profile-status"
            className="mt-2 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={busy || !mine?.status} onClick={() => { setStatus(""); void run(() => chat.saveProfile({ status: "" }), "Status cleared."); }}>
              Clear status
            </Button>
            <Button type="button" size="sm" disabled={busy || cleanStatus(status) === (mine?.status ?? "")} onClick={() => void run(() => chat.saveProfile({ status: cleanStatus(status) }), "Status saved.")} data-testid="profile-save">
              Save status
            </Button>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-[var(--color-text-muted)]">Colleagues see your photo and status in chats and in People.</p>
      </div>
    </div>
  );
}
