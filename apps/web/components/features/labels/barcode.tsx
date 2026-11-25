"use client";

import JsBarcode from "jsbarcode";
import { useMemo } from "react";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Code 128 bars for a 13-digit product code, as SVG markup that stretches
 * to its box. Code 128, not EAN-13: our 13th digit is the Type code, not an
 * EAN check digit. The digits are printed under the bars separately.
 */
export function barcodeSvgMarkup(code: string) {
  if (typeof document === "undefined") return "";
  const svg = document.createElementNS(SVG_NS, "svg");
  try {
    JsBarcode(svg, code, {
      format: "CODE128",
      displayValue: false,
      margin: 0,
      width: 2,
      height: 60,
      background: "#ffffff",
      lineColor: "#000000",
    });
  } catch {
    return "";
  }
  const width = Number.parseFloat(svg.getAttribute("width") ?? "0");
  const height = Number.parseFloat(svg.getAttribute("height") ?? "0");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.removeAttribute("style");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Barcode ${code}`);
  return svg.outerHTML;
}

export function Barcode({ code, style }: { code: string; style?: React.CSSProperties }) {
  const markup = useMemo(() => barcodeSvgMarkup(code), [code]);
  return (
    <div
      style={style}
      // Markup is built by JsBarcode from a digits-only code.
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
