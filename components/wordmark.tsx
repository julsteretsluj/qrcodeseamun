export function Wordmark({ title, lede }: { title: string; lede: string }) {
  return (
    <header className="mast">
      <p className="brand">SEAMUN</p>
      <h1>{title}</h1>
      <p className="lede">{lede}</p>
    </header>
  );
}
