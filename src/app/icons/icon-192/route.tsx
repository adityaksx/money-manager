import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#123b32", borderRadius: 38 }}>
      <svg width="118" height="118" viewBox="0 0 100 100" fill="none" aria-label="RupeeTrail">
        <rect x="14" y="10" width="72" height="80" rx="20" fill="#FFFFFF"/><text x="19" y="59" fontSize="42" fontWeight="700" fontFamily="Arial" fill="#123b32">₹</text><path d="M17 72C32 63 43 73 58 68C67 65 74 64 83 55" stroke="#16856B" strokeWidth="5" strokeLinecap="round"/><circle cx="83" cy="55" r="4" fill="#87E4BD"/>
      </svg>
    </div>,
    { width: 192, height: 192 },
  );
}
