// A entrada abre no escuro; enquanto carrega, só o fundo aparece.
export default function Loading() {
  return (
    <main className="bg-ink-950 flex-1">
      <p role="status" className="sr-only">
        Carregando
      </p>
    </main>
  );
}
