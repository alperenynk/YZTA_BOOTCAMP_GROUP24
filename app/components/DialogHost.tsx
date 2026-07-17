"use client";

import { useEffect, useRef, useState } from "react";

interface DialogOpts {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  input?: { placeholder?: string; required?: boolean };
}

type DialogResult = string | boolean | null;

let openDialog: ((opts: DialogOpts) => Promise<DialogResult>) | null = null;

/** Marka diliyle onay kutusu — tarayıcı confirm()'inin yerini alır. */
export function askConfirm(opts: Omit<DialogOpts, "input">): Promise<boolean> {
  if (!openDialog) return Promise.resolve(false);
  return openDialog(opts).then((r) => r === true);
}

/** Marka diliyle metin girişi — tarayıcı prompt()'unun yerini alır (iptal → null). */
export function askInput(
  opts: Omit<DialogOpts, "input"> & { placeholder?: string; required?: boolean }
): Promise<string | null> {
  if (!openDialog) return Promise.resolve(null);
  const { placeholder, required, ...rest } = opts;
  return openDialog({ ...rest, input: { placeholder, required } }).then((r) =>
    typeof r === "string" ? r : null
  );
}

export default function DialogHost() {
  const [opts, setOpts] = useState<DialogOpts | null>(null);
  const [value, setValue] = useState("");
  const resolverRef = useRef<((r: DialogResult) => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    openDialog = (o) =>
      new Promise<DialogResult>((resolve) => {
        resolverRef.current = resolve;
        setValue("");
        setOpts(o);
      });
    return () => {
      openDialog = null;
    };
  }, []);

  useEffect(() => {
    if (opts?.input) inputRef.current?.focus();
  }, [opts]);

  function close(result: DialogResult) {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOpts(null);
  }

  if (!opts) return null;

  const confirmDisabled = Boolean(opts.input?.required && !value.trim());

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={() => close(opts.input ? null : false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={opts.title}
        className="toast-enter w-full max-w-sm rounded-3xl border border-dusk-700/60 bg-dusk-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-semibold text-dusk-100">
          {opts.title}
        </h2>
        {opts.message && (
          <p className="mt-1.5 text-sm text-dusk-200">{opts.message}</p>
        )}

        {opts.input && (
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !confirmDisabled) close(value.trim());
              if (e.key === "Escape") close(null);
            }}
            placeholder={opts.input.placeholder}
            className="mt-4 w-full rounded-xl border border-dusk-700 bg-dusk-950 p-3 text-sm text-dusk-100 placeholder:text-dusk-300 focus:border-amber-glow focus:outline-none"
          />
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={() => close(opts.input ? null : false)}
            className="rounded-full border border-dusk-700 px-4 py-1.5 font-mono text-xs text-dusk-200 hover:border-dusk-600"
          >
            {opts.cancelLabel ?? "vazgeç"}
          </button>
          <button
            onClick={() => close(opts.input ? value.trim() : true)}
            disabled={confirmDisabled}
            className={`rounded-full px-4 py-1.5 font-mono text-xs font-medium disabled:opacity-40 ${
              opts.danger
                ? "bg-red-500 text-white hover:opacity-85"
                : "btn-primary"
            }`}
          >
            {opts.confirmLabel ?? "tamam"}
          </button>
        </div>
      </div>
    </div>
  );
}
