"use client";

import { useState } from "react";

// Um valor que avisa quando mudou. Na primeira vez aparece parado; quando os
// dados da tela são atualizados e o valor é outro, ele sobe e pisca no acento.
// É a resposta visual a "uma partida nova foi registrada".
export function FlashValue({
  value,
  className = "",
}: {
  value: string | number;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const [changes, setChanges] = useState(0);
  if (shown !== value) {
    setShown(value);
    setChanges((count) => count + 1);
  }

  return (
    <span
      key={changes}
      className={`inline-block ${changes > 0 ? "animate-tick" : ""} ${className}`}
    >
      {value}
    </span>
  );
}
