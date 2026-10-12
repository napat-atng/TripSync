import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { safeNextPath } from "@/features/access/safe-next-path";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="page">
      <div className="card">
        <div className="brand">TripSync</div>
        <h1>นัดเที่ยวกับเพื่อนให้ง่ายขึ้น</h1>
        <p>
          ชวนเพื่อน เลือกแผน โหวต และสรุปทริปในที่เดียว
          ตอนนี้เรากำลังสร้างระบบตามแผน MVP
        </p>
        <GoogleSignInButton nextPath={safeNextPath(next)} />
        <div className="status">กำลังพัฒนา</div>
      </div>
    </main>
  );
}
