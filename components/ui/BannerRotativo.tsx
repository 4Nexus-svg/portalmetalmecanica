"use client";
import { useState, useEffect } from "react";

type Ad = {
  id: number;
  image_url: string | null;
  link: string | null;
  name: string | null;
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
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % ads.length);
        setVisible(true);
      }, 400);
    }, 5000);
    return () => clearInterval(timer);
  }, [ads.length]);

  if (!ads.length) return null;
  const ad = ads[index];
  if (!ad?.image_url) return null;

  const img = (
    <img
      src={ad.image_url}
      alt={ad.name ?? "Publicidade"}
      className={`w-full h-auto block transition-opacity duration-400 ${visible ? "opacity-100" : "opacity-0"}`}
      unselectable="on"
    />
  );

  return (
    <div className={`overflow-hidden ${className}`}>
      <p className="text-[10px] text-gray-400 text-right mb-0.5 pr-1 uppercase tracking-wider">Publicidade</p>
      {ad.link ? (
        <a href={ad.link} target="_blank" rel="noopener noreferrer sponsored nofollow">
          {img}
        </a>
      ) : img}
    </div>
  );
}
