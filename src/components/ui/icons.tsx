// Ícones do produto, desenhados em traço único para combinar entre si.
// Sem biblioteca: são poucos e assim não pesam no carregamento.

interface IconProps {
  className?: string;
}

function Svg({
  className = "h-5 w-5",
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 11.5 12 5l8 6.5" />
    <path d="M6.5 10v8.5h11V10" />
  </Svg>
);

export const RankingIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5 19v-6M12 19V6M19 19v-9" />
  </Svg>
);

export const MatchesIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <path d="M12 5v14M4 12h3M17 12h3" />
  </Svg>
);

export const PersonIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="9" r="3.5" />
    <path d="M5.5 19c1.2-3 3.6-4.5 6.5-4.5s5.3 1.5 6.5 4.5" />
  </Svg>
);

export const PlayIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" />
  </Svg>
);

export const PlusIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const MinusIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5 12h14" />
  </Svg>
);

export const CheckIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);

export const ChevronRightIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);

export const ArrowLeftIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);

export const EditIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5 19h3.5L19 8.5 15.5 5 5 15.5z" />
    <path d="m13.5 7 3.5 3.5" />
  </Svg>
);

export const ShieldIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 3.5 19 6v6c0 4-3 7-7 8.5C8 19 5 16 5 12V6z" />
  </Svg>
);

export const EyeIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.6" />
  </Svg>
);

export const ShareIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 15V4M8 7.5 12 4l4 3.5" />
    <path d="M6 12v6.5h12V12" />
  </Svg>
);

export const WhistleIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="9" cy="14" r="5" />
    <path d="M9 9h11v4h-6.2M13 6.5V4" />
  </Svg>
);

// Gol: a bola.
export const BallIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m12 8.2 3.4 2.5-1.3 4h-4.2l-1.3-4z" />
    <path d="M12 3.5v4.7M20.1 9.4l-4.7 1.3M17 18.9l-2.9-4.2M7 18.9l2.9-4.2M3.9 9.4l4.7 1.3" />
  </Svg>
);

// Assistência: o passe que chega em alguém.
export const AssistIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="5.5" cy="17.5" r="2" />
    <path d="M9 15.5c3-.4 6-2.6 8.5-6.5" />
    <path d="M13.5 8.2 18 8.5l-.3 4.5" />
  </Svg>
);

// Defesa: a luva do goleiro.
export const GloveIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M7.5 13V7a1.4 1.4 0 0 1 2.8 0v4M10.3 10.5V5.4a1.4 1.4 0 0 1 2.8 0v5.1M13.1 10.8V6.5a1.4 1.4 0 0 1 2.8 0v6" />
    <path d="M7.5 12.5 6.2 11a1.4 1.4 0 0 0-2.2 1.8l2.6 3.9c1 1.5 2.4 2.3 4.2 2.3h1.6c2.6 0 4.3-1.900 4.3-4.500v-2" />
    <path d="M8 21h8" />
  </Svg>
);

// Coroa: quem lidera um scout (gols, assistências ou G/A). Preenchida, para
// ser lida em tamanho pequeno sobre a foto.
export const CrownIcon = ({ className = "h-4 w-5" }: IconProps) => (
  <svg
    viewBox="0 0 24 20"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M3.5 15.5 2 5l5.5 4L12 2.5l4.5 6.5L22 5l-1.5 10.5z" />
    <path d="M4.5 18.5h15" fill="none" strokeLinecap="round" />
  </svg>
);

// Resultado: seta para cima, igual e seta para baixo.
export const WinIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 18V6M6.5 11.5 12 6l5.5 5.5" />
  </Svg>
);

export const DrawIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6 9.5h12M6 14.5h12" />
  </Svg>
);

export const LossIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 6v12M6.5 12.5 12 18l5.5-5.5" />
  </Svg>
);

export const Spinner = ({ className = "h-5 w-5" }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    className={`${className} animate-spin`}
  >
    <circle
      cx="12"
      cy="12"
      r="9"
      stroke="currentColor"
      strokeOpacity={0.25}
      strokeWidth={2.5}
    />
    <path
      d="M21 12a9 9 0 0 0-9-9"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
    />
  </svg>
);
