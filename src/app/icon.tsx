import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "8px",
        background: "#1d1d1f",
        color: "#ffffff",
        fontSize: 19,
        fontWeight: 800,
      }}
    >
      W
    </div>,
    size,
  );
}
