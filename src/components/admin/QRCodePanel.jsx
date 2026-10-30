import { useState } from 'react';
import QRCode from 'qrcode';

export default function QRCodePanel({ wedding, appUrl }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [show, setShow] = useState(false);

  if (!wedding) return null;

  const target = `${appUrl}/w/${wedding.slug}`;

  const generate = async () => {
    setShow(true);
    if (dataUrl) return;
    const url = await QRCode.toDataURL(target, {
      width: 512,
      margin: 2,
      color: { dark: '#4A3527', light: '#FAF6EF' },
      errorCorrectionLevel: 'M',
    });
    setDataUrl(url);
  };

  const download = () => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `qr-${wedding.slug}.png`;
    a.click();
  };

  return (
    <div className="space-y-3">
      {!show ? (
        <button type="button" className="oge-btn-gold w-full" onClick={generate}>
          Show QR code
        </button>
      ) : (
        <div className="rounded-2xl border border-brown/10 bg-white p-4 text-center shadow-card">
          {dataUrl ? (
            <>
              <img src={dataUrl} alt={`QR code for ${wedding.slug}`} className="mx-auto h-48 w-48" />
              <p className="mt-2 break-all text-xs text-brown/60">{target}</p>
              <a
                href={target}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block text-xs font-semibold text-rose-dark underline"
              >
                Open guest page ↗
              </a>
              <button type="button" className="oge-btn-primary mt-3 w-full" onClick={download}>
                Download PNG
              </button>
            </>
          ) : (
            <p className="py-8 text-sm text-brown/60">Generating…</p>
          )}
        </div>
      )}
    </div>
  );
}
