// Bingkai area screenshot. Default: hanya kartu data. Opsi: ditambah latar tokoh 3D (gambar dari scene).
export default function SnapFrame({ snapping, bg, children }) {
  const wy = snapping && !!bg;
  return (
    <div id="snap-out" className={'snapout' + (wy ? ' wy' : '')} style={wy ? { backgroundImage: `url(${bg})` } : undefined}>
      <div id="snap" className={'snapbox' + (snapping ? ' snapping' : '')}>{children}</div>
    </div>
  );
}
