"use client";

import { useState } from "react";
import { savePlan } from "@/features/trips/plan-actions";

type DateChoice = { id: string; label: string; available: number; maybe: number };
type PlaceChoice = { id: string; name: string; total: number; byDate: Record<string, number> };

export function PlanForm({
  tripId, mode, dates, places, selectedDateId, selectedPlaceId,
  meetingLocal, meetingPoint,
}: {
  tripId: string;
  mode: "confirm" | "change";
  dates: DateChoice[];
  places: PlaceChoice[];
  selectedDateId?: string | null;
  selectedPlaceId?: string | null;
  meetingLocal?: string;
  meetingPoint?: string | null;
}) {
  const [dateId, setDateId] = useState(selectedDateId ?? dates[0]?.id ?? "");
  const [placeId, setPlaceId] = useState(selectedPlaceId ?? places[0]?.id ?? "");
  const date = dates.find((item) => item.id === dateId);
  const place = places.find((item) => item.id === placeId);
  const placeSupport = place?.byDate[dateId] ?? 0;

  return (
    <form action={savePlan} className="group-form">
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="mode" value={mode} />
      <label htmlFor="chosen-date">วันเดินทาง</label>
      <select id="chosen-date" name="dateId" value={dateId} onChange={(event) => setDateId(event.target.value)} required>
        {dates.map((option) => <option key={option.id} value={option.id}>
          {option.label} · ว่าง {option.available} · อาจว่าง {option.maybe}
        </option>)}
      </select>
      <label htmlFor="chosen-place">สถานที่</label>
      <select id="chosen-place" name="placeId" value={placeId} onChange={(event) => setPlaceId(event.target.value)} required>
        {places.map((option) => <option key={option.id} value={option.id}>
          {option.name} · เลือกทั้งหมด {option.total}
        </option>)}
      </select>
      <p className="support-note">คนที่ว่างในวันที่เลือกและเลือกสถานที่นี้: {placeSupport} คน</p>
      {date && date.available <= 1 && <p className="form-note">วันดังกล่าวมีคนว่างเพียง {date.available} คน โปรดตรวจแผนก่อนยืนยัน</p>}
      {place && placeSupport <= 1 && <p className="form-note">สถานที่นี้มีคนที่ว่างในวันที่เลือกสนใจเพียง {placeSupport} คน</p>}
      <label htmlFor="meeting-time">เวลานัดพบ (เวลาไทย)</label>
      <input id="meeting-time" name="meetingLocal" type="datetime-local" required defaultValue={meetingLocal} />
      <label htmlFor="meeting-point">จุดนัดพบ</label>
      <input id="meeting-point" name="meetingPoint" required maxLength={500} defaultValue={meetingPoint ?? ""} />
      <button className="primary-button" type="submit">
        {mode === "confirm" ? "ยืนยันแผน" : "บันทึกแผนใหม่และขอให้ตอบรับอีกครั้ง"}
      </button>
    </form>
  );
}
