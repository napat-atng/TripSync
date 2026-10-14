# เอกสาร WePlanGo

เอกสารใน `docs/` เป็นแนวทางสำหรับสร้าง MVP ของ WePlanGo ตามข้อตกลงล่าสุด: ใช้กับกลุ่มเพื่อนขนาดเล็ก, เริ่มด้วยบริการระดับฟรี, เข้าสู่ระบบด้วย Google และแชร์ลิงก์ผ่านแชตที่ใช้อยู่

| เอกสาร | ใช้เพื่อ |
| --- | --- |
| [STRUCTURE.md](STRUCTURE.md) | เข้าใจขอบเขต สถาปัตยกรรม กติกาหลัก และข้อมูลของระบบ |
| [BUILD_PLAN.md](BUILD_PLAN.md) | ลงมือสร้างตามลำดับ พร้อมเกณฑ์ตรวจรับแต่ละช่วง |
| [features/README.md](features/README.md) | ค้นหาสเปกพฤติกรรมของแต่ละฟีเจอร์ |
| [TEST_REPORT.md](TEST_REPORT.md) | ผลทดสอบและหลักฐานตรวจรับ MVP |

`WEPLANGO_APP_STRUCTURE.md` ที่รากโปรเจกต์เป็นร่างแนวคิดแรก หากรายละเอียดขัดกัน ให้ยึดเอกสารใน `docs/` ซึ่งรวมข้อสรุปหลังทบทวนมุมผู้ใช้และระบบแล้ว

## ทดสอบฐานข้อมูลในเครื่อง

เมื่อ Docker พร้อม ให้รันจากราก repository:

```powershell
npx.cmd supabase@latest start
npx.cmd supabase@latest db reset --local
npx.cmd supabase@latest test db --local
```

`db reset --local` สร้างฐานข้อมูลทดลองใหม่ตาม `supabase/migrations/` และล้างข้อมูล local เดิม ชุดทดสอบใน `supabase/tests/` ใช้ pgTAP พร้อม SQL assertions ตรวจสิทธิ์และกติกา ทุกไฟล์สร้างข้อมูลทดสอบใน transaction และ rollback เมื่อจบ

การทดสอบนี้ใช้ผู้ใช้จำลองในฐานข้อมูล ส่วนการตรวจ Google login และเส้นทางบนเว็บต้องทดสอบเพิ่มด้วยสองบัญชีจริงตาม `BUILD_PLAN.md`
