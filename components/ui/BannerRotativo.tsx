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

const SLIDE_MS = 700;

function Slide({ ad }: { ad: Ad }) {
  if (!ad.image_url) return null;
  const isVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(ad.image_url);
  const media = isVideo ? (
    <video src={ad.image_url} autoPlay loop muted playsInline className="w-full h-auto block" />
  ) : (
    <img
      src={ad.image_url}
      alt={ad.name ?? "Publicidade"}
      className="w-full h-auto block"
      unselectable="on"
    />
  );
  return ad.link ? (
    <a href={ad.link} target="_blank" rel="noopener noreferrer sponsored nofollow">
      {media}
    </a>
  ) : (
    media
  );
}

export function BannerRotativo({ ads, className = "" }: Props) {
  const [index, setIndex] = useState(() =>
    ads.length > 0 ? Math.floor(Math.random() * ads.length) : 0
  );
  const [prev, setPrev] = useState<number | null>(null);
  const [go, setGo] = useState(false);

  // Agenda a troca para o próximo banner
  useEffect(() => {
    if (ads.length <= 1) return;
    const duracao = (ads[index]?.duracao ?? 5) * 1000;
    const timer = setTimeout(() => {
      setPrev(index);
      setGo(false);
      setIndex((index + 1) % ads.length);
    }, duracao);
    return () => clearTimeout(timer);
  }, [ads, index]);

  // Dispara o deslize e limpa o banner anterior ao final
  useEffect(() => {
    if (prev === null) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setGo(true));
    });
    const done = setTimeout(() => {
      setPrev(null);
      setGo(false);
    }, SLIDE_MS + 50);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(done);
    };
  }, [prev]);

  if (!ads.length) return null;
  const ad = ads[index];
  if (!ad?.image_url) return null;
  const prevAd = prev !== null ? ads[prev] : null;

  return (
    <div className={className}>
      <p className="text-[10px] text-gray-400 text-right mb-0.5 pr-1 uppercase tracking-wider">Publicidade</p>
      {prevAd ? (
        <div className="overflow-hidden">
          <div
            className="flex items-start w-[200%]"
            style={{
              transform: go ? "translateX(-50%)" : "translateX(0)",
              transition: go ? `transform ${SLIDE_MS}ms ease-in-out` : "none",
            }}
          >
            <div className="w-1/2 shrink-0"><Slide ad={prevAd} /></div>
            <div className="w-1/2 shrink-0"><Slide ad={ad} /></div>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden"><Slide ad={ad} /></div>
      )}
    </div>
  );
}
