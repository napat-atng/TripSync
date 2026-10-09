import { z } from "zod";

export const tripInput = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อทริป").max(120, "ชื่อทริปยาวไม่เกิน 120 ตัวอักษร"),
  description: z.string().trim().max(2000, "คำอธิบายยาวไม่เกิน 2,000 ตัวอักษร"),
  timezone: z.string().refine(value => {
    try { new Intl.DateTimeFormat("th-TH", { timeZone: value }); return true; } catch { return false; }
  }, "กรุณาระบุ timezone ที่ถูกต้อง เช่น Asia/Bangkok"),
  joinMode: z.enum(["open", "approval"]),
});
export type TripInput = z.infer<typeof tripInput>;
