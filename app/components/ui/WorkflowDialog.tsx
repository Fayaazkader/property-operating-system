'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

/** Native modal semantics: keyboard focus containment, inert background, Escape
 * and focus restoration. Shared by workflow reviews; financial commands may lock
 * dismissal while their committed result is being resolved.
 */
export default function WorkflowDialog({title,busy=false,onClose,children}:{title:string;busy?:boolean;onClose:()=>void;children:ReactNode}) {
 const dialog=useRef<HTMLDialogElement>(null);const titleId=useId();
 useEffect(()=>{const node=dialog.current;const previous=document.activeElement;node?.showModal();
  return()=>{node?.close();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();};},[]);
 return <dialog ref={dialog} aria-labelledby={titleId} aria-busy={busy}
  onCancel={event=>{event.preventDefault();if(!busy)onClose();}}
  onClick={event=>{if(event.target===dialog.current&&!busy){const rect=dialog.current.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)onClose();}}}
  className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(48rem,calc(100vw-2rem))] overflow-auto rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-0 text-[var(--text-primary)] shadow-xl backdrop:bg-black/60">
  <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[var(--border-default)] bg-[var(--bg-secondary)] px-5 py-4">
   <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
   <button type="button" disabled={busy} onClick={onClose} aria-label={`Close ${title}`} className="af-control shrink-0">Close</button>
  </header>
  <div className="p-5">{children}</div>
 </dialog>;
}
