"use client";

import { useEffect, useId, useRef } from "react";
import { Button, type ButtonVariant } from "./button";

interface ModalProps {
  open: boolean;
  title: string;
  children?: React.ReactNode;
  // Impede fechar (Esc ou toque fora) enquanto uma ação está em andamento.
  locked?: boolean;
  onClose: () => void;
}

// Janela modal sobre o <dialog> do navegador: foco preso, Esc para fechar e
// fundo inerte de graça. No celular sobe do rodapé, ao alcance do polegar.
export function Modal({
  open,
  title,
  children,
  locked = false,
  onClose,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => {
        if (locked) event.preventDefault();
      }}
      onClick={(event) => {
        // Toque fora do conteúdo (no fundo) fecha.
        if (event.target === ref.current && !locked) onClose();
      }}
      className="bg-surface text-fg shadow-float backdrop:bg-ink-950/75 open:animate-rise fixed inset-x-0 top-auto bottom-0 m-0 max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-xl backdrop:backdrop-blur-sm sm:inset-0 sm:m-auto sm:h-fit sm:max-w-sm sm:rounded-xl"
    >
      <div className="pb-safe flex flex-col gap-4 p-5">
        <h2 id={titleId} className="display text-xl">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: Extract<ButtonVariant, "primary" | "danger">;
  // A ação está em andamento: bloqueia os botões e o fechamento.
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

// Confirmação antes de uma ação que não dá para desfazer com um toque.
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Voltar",
  tone = "primary",
  pending = false,
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} title={title} locked={pending} onClose={onClose}>
      {children && <div className="text-soft text-sm">{children}</div>}
      {error && (
        <p
          role="alert"
          className="bg-loss/15 text-loss rounded-md px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          {cancelLabel}
        </Button>
        <Button variant={tone} onClick={onConfirm} loading={pending}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
