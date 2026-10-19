import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#172c28", borderRadius: 38 }}>
      <svg width="118" height="118" viewBox="0 0 100 100" fill="none" aria-label="Money Manager">
        <path d="M23 35V29C23 23.5 27.5 19 33 19H70C75.5 19 80 23.5 80 29V35" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round"/>
        <rect x="14" y="31" width="72" height="54" rx="12" fill="#FFFFFF"/>
        <path d="M14 47H86" stroke="#DCEBE5" strokeWidth="4"/>
        <rect x="55" y="53" width="31" height="22" rx="7" fill="#16856B"/>
        <circle cx="64" cy="64" r="2.8" fill="#FFFFFF"/>
      </svg>
    </div>,
    { width: 192, height: 192 },
  );
}
