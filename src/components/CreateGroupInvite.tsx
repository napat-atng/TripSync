"use client";

import { useActionState, useState } from "react";
import { createGroupInvite, type InviteActionState } from "@/features/access/invite-actions";

const initialState: InviteActionState = { path: null, error: null };

export function CreateGroupInvite({ groupId }: { groupId: string }) {
  const [state, formAction, pending] = useActionState(createGroupInvite, initialState);
  const [copied, setCopied] = useState(false);

  async function copyLink(): Promise<void> {
    if (!state.path) return;
    await navigator.clipboard.writeText(`${window.location.origin}${state.path}`);
    setCopied(true);
  }

  return (
    <section className="invite-panel">
      <h2>ชวนเพื่อนเข้ากลุ่ม</h2>
      <p>ลิงก์ใช้ได้ 7 วัน เปิดลิงก์แล้วเพื่อนจะเห็นชื่อกลุ่มก่อนยืนยันเข้าร่วม</p>
      <form action={formAction}>
        <input type="hidden" name="groupId" value={groupId} />
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "กำลังสร้าง..." : "สร้างลิงก์เชิญ"}
        </button>
      </form>
      {state.path && (
        <div className="invite-result">
          <code>{state.path}</code>
          <button className="text-button" type="button" onClick={copyLink}>
            {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์เต็ม"}
          </button>
        </div>
      )}
      {state.error && <p className="form-note" role="alert">{state.error}</p>}
    </section>
  );
}
