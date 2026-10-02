"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { ShareIcon, Spinner } from "../ui/icons";
import {
  canvasToFile,
  CARD_HEIGHT,
  CARD_WIDTH,
  drawAwardCard,
} from "./share-card";
import type { AwardWinner } from "./types";

interface ShareCardPanelProps {
  winner: AwardWinner;
  nightDate: string;
}

function fileNameFor(winner: AwardWinner): string {
  const slug = `${winner.label}-${winner.name}`
    .normalize("NFD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `varejista-fc-${slug}.png`;
}

// O card do prêmio escolhido, à vista, com as formas de levá-lo para fora: a
// folha de compartilhar do aparelho (WhatsApp, Instagram) quando existe, ou
// baixar a imagem.
export function ShareCardPanel({ winner, nightDate }: ShareCardPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const key = `${winner.award}:${winner.name}`;
  const [drawn, setDrawn] = useState<string | null>(null);
  const [message, setMessage] = useState<{ for: string; text: string } | null>(
    null,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let current = true;
    drawAwardCard(canvas, winner, nightDate).then(() => {
      if (current) setDrawn(key);
    });
    return () => {
      current = false;
    };
  }, [winner, nightDate, key]);

  const ready = drawn === key;
  const note = message?.for === key ? message.text : null;

  async function cardFile(): Promise<File | null> {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const file = await canvasToFile(canvas, fileNameFor(winner));
    if (!file) {
      setMessage({
        for: key,
        text: "Não foi possível gerar a imagem neste aparelho.",
      });
    }
    return file;
  }

  function download(file: File) {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(url);
    setMessage({ for: key, text: "Imagem salva. Agora é só postar." });
  }

  async function share() {
    setMessage(null);
    const file = await cardFile();
    if (!file) return;
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `${winner.label}: ${winner.name}`,
        });
      } catch {
        // A pessoa fechou a folha de compartilhar: nada a fazer.
      }
      return;
    }
    download(file);
  }

  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-4">
      <div className="bg-ink-900 relative w-32 overflow-hidden rounded-md sm:w-40">
        <canvas
          ref={canvasRef}
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
          role="img"
          aria-label={`Card de ${winner.label}: ${winner.name}, ${winner.value} ${winner.unit}`}
          className={`block h-auto w-full transition-opacity duration-300 ${
            ready ? "opacity-100" : "opacity-0"
          }`}
        />
        {!ready && (
          <span className="text-muted absolute inset-0 flex items-center justify-center">
            <Spinner className="h-6 w-6" />
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-sm">
          <span className="text-muted block text-xs">Card para postar</span>
          <span className="font-bold">
            {winner.label}: {winner.name}
          </span>
        </p>
        <Button variant="primary" onClick={share} disabled={!ready}>
          <ShareIcon />
          Compartilhar card
        </Button>
        <Button
          onClick={async () => {
            setMessage(null);
            const file = await cardFile();
            if (file) download(file);
          }}
          disabled={!ready}
        >
          Baixar imagem
        </Button>
        {note && (
          <p role="status" className="text-soft animate-fade text-xs">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}
