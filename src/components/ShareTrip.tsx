"use client";

import { useState } from "react";

type ShareTripProps = {
  tripId: string;
  title: string;
  status: string;
  deadline: string;
  timezone: string;
  dateLabel?: string;
  placeName?: string;
  meetingAt?: string | null;
  meetingPoint?: string | null;
};

export function ShareTrip({
  tripId, title, status, deadline, timezone, dateLabel, placeName, meetingAt, meetingPoint,
}: ShareTripProps) {
  const [result, setResult] = useState("");

  async function copyMessage() {
    const link = `${window.location.origin}/trips/${tripId}`;
    let instruction = "ช่วยเสนอวันและสถานที่สำหรับทริปนี้";
    if (status === "voting") {
      instruction = new Date(deadline).getTime() > Date.now()
        ? `ช่วยโหวตวันและสถานที่ก่อน ${new Date(deadline).toLocaleString("th-TH", { timeZone: timezone })} (${timezone})`
        : "หมดเวลาโหวตแล้ว รอผู้จัดสรุปแผน";
    } else if (status === "confirmed") {
      const meeting = meetingAt
        ? ` นัดพบ ${new Date(meetingAt).toLocaleString("th-TH", { timeZone: timezone })} (${timezone})` : "";
      instruction = `ยืนยันแผนแล้ว: ${dateLabel ?? "วันเดินทาง"} ที่ ${placeName ?? "สถานที่ที่เลือก"}${meeting}`;
      if (meetingPoint) instruction += ` จุดนัดพบ ${meetingPoint}`;
      instruction += " กรุณาตอบรับแผนล่าสุด";
    }
    try {
      await navigator.clipboard.writeText(`${title}\n${instruction}\n${link}`);
      setResult("คัดลอกข้อความและลิงก์แล้ว");
    } catch {
      setResult("คัดลอกไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  return <div className="share-trip">
    <button className="text-button" type="button" onClick={copyMessage}>คัดลอกข้อความแชร์ทริป</button>
    {result && <span role="status">{result}</span>}
  </div>;
}
