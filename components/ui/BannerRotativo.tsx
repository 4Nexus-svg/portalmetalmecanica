"use client";
import { useState, useEffect } from "react";

type Ad = {
  id: number;
  image_url: string | null;
  link: string | null;
  name: string | null;
  duracao?: number | null;
};

interface Props {
  ads: Ad[];
  className?: string;
}

export function BannerRotativo({ ads, className = "" }: Props) {
  const [index, setIndex] = useState(() =>
    ads.length > 0 ? Math.floor(Math.random() * ads.length) : 0
  );
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (ads.length <= 1) return;
    const duracao = (ads[index]?.duracao ?? 5) * 1000;
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % ads.length);
        setVisible(true);
      }, 400);
    }, duracao);
    return () => clearTimeout(timer);
  }, [ads, index]);

  if (!ads.length) return null;
  const ad = ads[index];
  if (!ad?.image_url) return null;

  const isVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(ad.image_url);

  const mediaClass = `w-full h-auto block transition-opacity duration-400 ${visible ? "opacity-100" : "opacity-0"}`;

  const media = isVideo ? (
    <video
      src={ad.image_url}
      autoPlay
      loop
      muted
      playsInline
      className={mediaClass}
    />
  ) : (
    <img
      src={ad.image_url}
      alt={ad.name ?? "Publicidade"}
      className={mediaClass}
      unselectable="on"
    />
  );

  return (
    <div className={`${className}`}>
      <p className="text-[10px] text-gray-400 text-right mb-0.5 pr-1 uppercase tracking-wider">Publicidade</p>
      {ad.link ? (
        <a href={ad.link} target="_blank" rel="noopener noreferrer sponsored nofollow">
          {media}
        </a>
      ) : media}
    </div>
  );
}
