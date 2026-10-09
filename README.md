# TripSync

วางแผนเที่ยวร่วมกันผ่านเว็บบนมือถือและคอมพิวเตอร์ พร้อมติดตั้งเป็น PWA
Frontend ใช้ React, TypeScript, Vite, Mantine, Anuphan และ React Router
Backend บน cloud ใช้ Supabase โครงการเดิม; ระหว่างพัฒนาใช้ Supabase ใน Docker

## เริ่มพัฒนาบนเครื่อง

ต้องมี Node.js 20.19+ หรือ 22.12+ และ Docker Desktop Linux engine
เวอร์ชันที่ทดสอบจริง: Node.js 24.15.0 และ Supabase CLI 2.120.0

```powershell
npm.cmd ci
npm.cmd run db:start
npm.cmd run dev
```

เปิด <http://localhost:5173> ตั้ง Google development client ตาม
[คู่มือ local development](docs/LOCAL_DEVELOPMENT.md) และใส่ Google credentials
ใน `.env` ที่ไม่ติดตามโดย Git ส่วน frontend ตั้งค่าใน `.env.local`:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=ค่าจากคำสั่ง-supabase-status
```

ใช้ `npx.cmd supabase status` เพื่อดู local publishable key ห้ามใส่ service-role,
Google secret, AI key หรือ VAPID private key ในตัวแปรที่ขึ้นต้นด้วย `VITE_`
อย่าคัดลอก `.env.example` ทับ `.env` ที่ตั้งค่าไว้แล้ว

## โครงสร้าง

- `src/app`: providers, routes, shell, theme และการควบคุม PWA
- `src/features`: auth, trips และ profile; แยกหน้าจอ hooks services validation
- `src/shared`: UI ที่ใช้ร่วมกัน utilities และ typed Supabase client
- `supabase/migrations`: migration เดิมและ schema ใหม่ `tripsync`
- `supabase/tests`: pgTAP tests ของ RPC และ RLS
- `supabase/functions`: Edge Functions; จะปรับให้ใช้ workflow ใหม่ในขั้นตอนถัดไป
- `legacy/expo`: โค้ดเก่าสำหรับอ้างอิง ไม่อยู่ใน build และไม่รองรับการรัน

ค้นหาฟีเจอร์ตามชื่อโฟลเดอร์ใน `src/features` หน้าจอไม่เรียกฐานข้อมูลโดยตรง
ข้อมูล server ใช้ TanStack Query และ Realtime invalidate ส่วนฟอร์มใช้ state ในหน้า

## คำสั่งตรวจสอบ

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run db:test
npm.cmd run db:types
npm.cmd run build
npm.cmd run preview
```

`npm run db:reset` ล้างข้อมูล local และรัน migration ใหม่ ไม่แตะ cloud
Generated types อยู่ใน `src/shared/database.types.ts` ให้สร้างใหม่หลังแก้ schema
การทดสอบจริงกับ Google และมือถือยังต้องทำเพิ่มเติมจาก unit/SQL/browser tests

## การเผยแพร่

เป้าหมายคือ Cloudflare Pages Direct Upload ของ TripSync แยกจาก PORA โดย upload
`dist/` หลังผ่านขั้นตอน preview และ cutover ใน [PLAN.md](PLAN.md)
`public/_redirects` รองรับ React Router deep links; service worker cache เฉพาะ
app shell และ assets, ไม่ cache API ส่วนตัว การอัปเดตต้องรอผู้ใช้พร้อมและบันทึกฟอร์ม

schema ใหม่แยกใน `tripsync` เพื่อไม่เปลี่ยนทรัพยากรอื่นหรือบัญชี Supabase Auth
ก่อนใช้บน cloud ต้องเปิดเผย schema นี้ใน Data API, ตั้ง OAuth origins, สำรองข้อมูล,
และหยุดการเขียนจากแอปเก่าตามแผน ยังไม่มีการ deploy หรือ migration บน cloud

## สถานะ

ขั้นตอน 1–2 เสร็จแล้ว รวม Google login จริงบน local
ดูผลตรวจที่ [docs/STEP_2_VERIFICATION.md](docs/STEP_2_VERIFICATION.md)
ขั้นตอน 3–8 ยังไม่เสร็จ จึงยังไม่พร้อมเปิด production
