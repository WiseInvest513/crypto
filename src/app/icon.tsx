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
        borderRadius: "8px 8px 18px 8px",
        background: "#13231d",
        color: "#72e6ad",
        fontSize: 19,
        fontWeight: 800,
      }}
    >
      W
    </div>,
    size,
  );
}
