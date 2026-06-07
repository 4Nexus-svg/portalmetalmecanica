"use client";

import { useEffect, useRef } from "react";

export default function Modal({
  aberto,
  titulo,
  onFechar,
  children,
}: {
  aberto: boolean;
  titulo?: string;
  onFechar?: () => void;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (aberto) {
      if (!dialog.open) dialog.showModal();
      document.body.style.overflow = "hidden";
    } else {
      if (dialog.open) dialog.close();
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [aberto]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    function onClose() { onFechar?.(); }
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, [onFechar]);

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    const rect = dialogRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clickedOutside =
      e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top  || e.clientY > rect.bottom;
    if (clickedOutside) onFechar?.();
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col p-0 m-auto backdrop:bg-black/40"
    >
      {titulo && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-xl">
          <h2 className="font-semibold text-[#1A2B4A]">{titulo}</h2>
          <button
            onClick={onFechar}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>
      )}
      <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>
    </dialog>
  );
}
