"use client";

import { useState } from "react";

export function WiseAvatar({
  displayName,
  email,
  imageUrl,
  size = "medium",
}: Readonly<{
  displayName: string | null;
  email: string | null;
  imageUrl: string | null;
  size?: "compact" | "medium" | "large";
}>) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

  const fallback =
    Array.from(displayName ?? email ?? "W")[0]?.toUpperCase() ?? "W";

  return (
    <span className={`wise-avatar wise-avatar--${size}`} aria-hidden="true">
      {imageUrl && failedImageUrl !== imageUrl ? (
        // The verified Wise ID avatar may be hosted on different HTTPS hosts.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailedImageUrl(imageUrl)}
        />
      ) : (
        <span>{fallback}</span>
      )}
    </span>
  );
}
