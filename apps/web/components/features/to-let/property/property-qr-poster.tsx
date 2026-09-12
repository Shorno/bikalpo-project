import { QRCodeSVG } from "qrcode.react";
import type { Ref } from "react";

function identityLines(value: string, limit: number) {
  if (value.length <= limit) return [value];
  const middle = Math.floor(value.length / 2);
  const spaces = [...value.matchAll(/\s+/g)].map((match) => match.index!);
  const split = spaces.length
    ? spaces.reduce((best, index) =>
        Math.abs(index - middle) < Math.abs(best - middle) ? index : best,
      )
    : middle;
  return [value.slice(0, split).trim(), value.slice(split).trim()];
}

/** Pinned client artwork: 2:3 navy/orange print poster. Only property identity
 * and QR vary. Preview and offline PDF export share this exact composition. */
export function PropertyQrPoster({
  propertyName,
  propertyCode,
  location,
  qrUrl,
  ref,
}: {
  propertyName: string;
  propertyCode: string;
  location?: string | null;
  qrUrl: string;
  ref?: Ref<SVGSVGElement>;
}) {
  const name = propertyName.trim();
  const address = location?.trim() || "Location available on property page";
  // Wrap rather than horizontally stretch Bengali/English glyphs.
  const names = identityLines(name, 32);
  const addresses = identityLines(address, 42);
  const nameSize = Math.min(
    names.length > 1 ? 40 : 68,
    1400 / Math.max(...names.map((line) => line.length), 1),
  );
  const addressSize = Math.min(
    addresses.length > 1 ? 30 : 50,
    1350 / Math.max(...addresses.map((line) => line.length), 1),
  );
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1536"
      width="1024"
      height="1536"
      className="block h-auto w-full"
      role="img"
      aria-label={`${name}, ${address}. Property ID ${propertyCode}. Scan to view available units.`}
    >
      <title>{`${name} — To-Let property poster`}</title>
      <image
        href="/images/to-let-property-poster-template.png"
        x="0"
        y="0"
        width="1024"
        height="1536"
      />
      <g
        fontFamily="Arial, Helvetica, sans-serif"
        textAnchor="middle"
        fontWeight="700"
      >
        {names.map((line, index) => (
          <text
            key={index}
            x="512"
            y={names.length > 1 ? 548 + index * 46 : 577}
            fontSize={nameSize}
            fill="#f4770b"
          >
            {line}
          </text>
        ))}
        {addresses.map((line, index) => (
          <text
            key={index}
            x="512"
            y={addresses.length > 1 ? 630 + index * 34 : 644}
            fontSize={addressSize}
            fill="#073f79"
          >
            {line}
          </text>
        ))}
        <text
          x="510"
          y="1204"
          fontSize={Math.min(38, 790 / (propertyCode.length + 14))}
          fill="#ffffff"
        >
          Property ID : <tspan fill="#ff8a00">{propertyCode}</tspan>
        </text>
      </g>
      {qrUrl ? (
        <QRCodeSVG
          value={qrUrl}
          x={326}
          y={759}
          size={360}
          level="H"
          marginSize={4}
          bgColor="#ffffff"
          fgColor="#000000"
          title={`${propertyCode} permanent property QR`}
        />
      ) : (
        <text
          x="506"
          y="952"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize="24"
          fill="#073f79"
        >
          Preparing QR…
        </text>
      )}
    </svg>
  );
}
