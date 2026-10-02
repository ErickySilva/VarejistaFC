import type { AwardWinner } from "./types";

// Card do prêmio para compartilhar (formato de story, 1080 × 1920). É
// desenhado no próprio aparelho, em um <canvas>: não depende de servidor nem
// de biblioteca, e usa a foto real, o escudo e as cores do clube.

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;

// O canvas não entende variáveis de CSS, então as cores são lidas dos tokens
// da página (globals.css). O valor ao lado só vale se o token não existir.
function token(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

function palette() {
  return {
    ink950: token("--color-ink-950", "#0e1433"),
    ink900: token("--color-ink-900", "#131a40"),
    ink700: token("--color-ink-700", "#243264"),
    paper: token("--color-paper", "#fdfdfc"),
    shield: token("--color-shield", "#b4c7e6"),
    mist: token("--color-mist", "#99a6d0"),
    ribbon: token("--color-ribbon", "#f2c930"),
    ribbonInk: token("--color-accent-ink", "#1b2148"),
  };
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    // Fotos de outro endereço só podem ir para o canvas se ele permitir.
    if (!src.startsWith("/")) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

// O hexágono do escudo, com as mesmas proporções do recorte dos retratos.
function hexPath(
  context: CanvasRenderingContext2D,
  centerX: number,
  top: number,
  width: number,
  height: number,
) {
  const left = centerX - width / 2;
  const right = centerX + width / 2;
  context.beginPath();
  context.moveTo(centerX, top);
  context.lineTo(right, top + height * 0.21);
  context.lineTo(right, top + height * 0.79);
  context.lineTo(centerX, top + height);
  context.lineTo(left, top + height * 0.79);
  context.lineTo(left, top + height * 0.21);
  context.closePath();
}

// Diminui a fonte até o texto caber na largura.
function fitText(
  context: CanvasRenderingContext2D,
  text: string,
  weight: number,
  size: number,
  family: string,
  maxWidth: number,
): number {
  let current = size;
  context.font = `${weight} ${current}px ${family}`;
  while (context.measureText(text).width > maxWidth && current > 40) {
    current -= 4;
    context.font = `${weight} ${current}px ${family}`;
  }
  return current;
}

export async function drawAwardCard(
  canvas: HTMLCanvasElement,
  winner: AwardWinner,
  nightDate: string,
): Promise<void> {
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) return;

  // A mesma fonte da página; espera os pesos usados estarem carregados.
  const family = getComputedStyle(document.body).fontFamily;
  await Promise.all(
    [500, 700, 800].map((weight) =>
      document.fonts.load(`${weight} 64px ${family}`),
    ),
  ).catch(() => undefined);

  const [logo, photo] = await Promise.all([
    loadImage("/brand/logo-mark.webp"),
    winner.photoUrl ? loadImage(winner.photoUrl) : null,
  ]);

  const centerX = CARD_WIDTH / 2;
  const color = palette();

  // Fundo: a tinta do clube, com um foco de luz atrás do retrato.
  context.fillStyle = color.ink900;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  const glow = context.createRadialGradient(
    centerX,
    860,
    60,
    centerX,
    860,
    900,
  );
  glow.addColorStop(0, "rgba(180, 199, 230, 0.30)");
  glow.addColorStop(0.55, "rgba(50, 64, 122, 0.25)");
  glow.addColorStop(1, "rgba(14, 20, 51, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Hexágonos de contorno ao fundo, bem discretos.
  context.strokeStyle = "rgba(180, 199, 230, 0.07)";
  context.lineWidth = 3;
  for (const [x, top, width] of [
    [140, 380, 520],
    [960, 1050, 640],
    [90, 1500, 380],
  ]) {
    hexPath(context, x, top, width, width * (8 / 7));
    context.stroke();
  }

  // Logo no topo.
  if (logo) {
    const logoWidth = 300;
    const logoHeight = (logo.height / logo.width) * logoWidth;
    context.drawImage(
      logo,
      centerX - logoWidth / 2,
      110,
      logoWidth,
      logoHeight,
    );
  }

  // Retrato: fio azul-marinho, faixa branca e a foto, como no escudo.
  const hexWidth = 600;
  const hexHeight = hexWidth * (8 / 7);
  const hexTop = 440;
  hexPath(context, centerX, hexTop - 10, hexWidth + 18, hexHeight + 20);
  context.fillStyle = color.ink700;
  context.fill();
  hexPath(context, centerX, hexTop, hexWidth, hexHeight);
  context.fillStyle = color.paper;
  context.fill();

  const inset = 26;
  const photoWidth = hexWidth - inset * 2;
  const photoHeight = hexHeight - inset * 2;
  const photoTop = hexTop + inset;
  context.save();
  hexPath(context, centerX, photoTop, photoWidth, photoHeight);
  context.clip();
  context.fillStyle = color.ink950;
  context.fillRect(centerX - photoWidth / 2, photoTop, photoWidth, photoHeight);
  let photoDrawn = false;
  if (photo) {
    try {
      // Preenche o hexágono sem distorcer, com o rosto na parte de cima.
      const scale = Math.max(
        photoWidth / photo.width,
        photoHeight / photo.height,
      );
      const drawWidth = photo.width * scale;
      const drawHeight = photo.height * scale;
      context.drawImage(
        photo,
        centerX - drawWidth / 2,
        photoTop - (drawHeight - photoHeight) * 0.3,
        drawWidth,
        drawHeight,
      );
      photoDrawn = true;
    } catch {
      photoDrawn = false;
    }
  }
  if (!photoDrawn) {
    context.fillStyle = color.mist;
    context.font = `800 300px ${family}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      String(winner.shirtNumber),
      centerX,
      photoTop + photoHeight / 2,
    );
  }
  context.restore();

  // Faixa com o nome do prêmio, sobre a base do retrato.
  const ribbonLabel = winner.label.toUpperCase();
  context.font = `800 58px ${family}`;
  const ribbonWidth = Math.max(
    560,
    context.measureText(ribbonLabel).width + 170,
  );
  const ribbonHeight = 116;
  const ribbonTop = hexTop + hexHeight - 84;
  const notch = 34;
  const ribbonLeft = centerX - ribbonWidth / 2;
  context.beginPath();
  context.moveTo(ribbonLeft, ribbonTop);
  context.lineTo(ribbonLeft + ribbonWidth, ribbonTop);
  context.lineTo(
    ribbonLeft + ribbonWidth - notch,
    ribbonTop + ribbonHeight / 2,
  );
  context.lineTo(ribbonLeft + ribbonWidth, ribbonTop + ribbonHeight);
  context.lineTo(ribbonLeft, ribbonTop + ribbonHeight);
  context.lineTo(ribbonLeft + notch, ribbonTop + ribbonHeight / 2);
  context.closePath();
  context.fillStyle = color.ribbon;
  context.fill();
  context.fillStyle = color.ribbonInk;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(ribbonLabel, centerX, ribbonTop + ribbonHeight / 2 + 4);

  // Nome do jogador.
  const nameTop = ribbonTop + ribbonHeight + 168;
  context.fillStyle = color.paper;
  fitText(context, winner.name, 800, 160, family, CARD_WIDTH - 160);
  context.textBaseline = "alphabetic";
  context.fillText(winner.name, centerX, nameTop);

  // Número principal do prêmio e a sua unidade.
  const valueTop = nameTop + 196;
  context.fillStyle = color.ribbon;
  context.font = `800 176px ${family}`;
  context.fillText(winner.value, centerX, valueTop);
  context.fillStyle = color.shield;
  context.font = `500 46px ${family}`;
  context.fillText(winner.unit, centerX, valueTop + 62);

  // Números de apoio, em colunas.
  const stats = winner.stats.slice(0, 4);
  if (stats.length > 0) {
    const statsTop = valueTop + 178;
    const columnWidth = Math.min(250, (CARD_WIDTH - 160) / stats.length);
    const startX = centerX - (columnWidth * (stats.length - 1)) / 2;
    stats.forEach((stat, index) => {
      const x = startX + columnWidth * index;
      context.fillStyle = color.paper;
      context.font = `800 64px ${family}`;
      context.fillText(stat.value, x, statsTop);
      context.fillStyle = color.mist;
      context.font = `500 32px ${family}`;
      context.fillText(stat.label, x, statsTop + 46);
    });
  }

  // Rodapé: a noite a que o prêmio pertence.
  context.fillStyle = color.mist;
  context.font = `500 34px ${family}`;
  context.fillText(`Gameplay de ${nightDate}`, centerX, CARD_HEIGHT - 70);
}

export function canvasToFile(
  canvas: HTMLCanvasElement,
  fileName: string,
): Promise<File | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => {
        resolve(
          blob ? new File([blob], fileName, { type: "image/png" }) : null,
        );
      }, "image/png");
    } catch {
      // Canvas "contaminado" por uma foto de outro endereço sem permissão.
      resolve(null);
    }
  });
}
