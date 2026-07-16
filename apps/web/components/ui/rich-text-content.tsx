"use client";

import { Fragment, type ReactNode, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const BLOCK_END_TAGS = /<\s*\/\s*(?:p|div|h[1-6]|blockquote|li)\s*>/gi;
const BREAK_TAGS = /<\s*br\s*\/?\s*>/gi;
const OPEN_LIST_ITEMS = /<\s*li(?:\s[^>]*)?>/gi;
const ALL_TAGS = /<[^>]*>/g;

function decodeTextEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  const decodeCodePoint = (entity: string, value: string, radix: number) => {
    const codePoint = Number.parseInt(value, radix);
    return Number.isInteger(codePoint) &&
      codePoint >= 0 &&
      codePoint <= 0x10ffff &&
      !(codePoint >= 0xd800 && codePoint <= 0xdfff)
      ? String.fromCodePoint(codePoint)
      : entity;
  };

  return value
    .replace(/&#(\d+);/g, (entity, value: string) =>
      decodeCodePoint(entity, value, 10),
    )
    .replace(/&#x([\da-f]+);/gi, (entity, value: string) =>
      decodeCodePoint(entity, value, 16),
    )
    .replace(/&([a-z]+);/gi, (entity, name: string) =>
      name.toLowerCase() in namedEntities
        ? namedEntities[name.toLowerCase()]
        : entity,
    );
}

function richTextToPlainText(value: string) {
  return decodeTextEntities(
    value
      .replace(BREAK_TAGS, "\n")
      .replace(OPEN_LIST_ITEMS, "\n• ")
      .replace(BLOCK_END_TAGS, "\n")
      .replace(ALL_TAGS, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isSafeLink(href: string) {
  return /^(?:https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(href.trim());
}

function renderNode(node: Node, key: string): ReactNode {
  if (node.nodeType === 3) return node.textContent;
  if (node.nodeType !== 1) return null;

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();
  if (
    [
      "script",
      "style",
      "iframe",
      "object",
      "embed",
      "template",
      "svg",
      "math",
    ].includes(tag)
  ) {
    return null;
  }

  const children = Array.from(element.childNodes).map((child, index) =>
    renderNode(child, `${key}-${index}`),
  );

  switch (tag) {
    case "p":
      return <p key={key}>{children}</p>;
    case "strong":
    case "b":
      return <strong key={key}>{children}</strong>;
    case "em":
    case "i":
      return <em key={key}>{children}</em>;
    case "u":
      return (
        <span key={key} className="underline">
          {children}
        </span>
      );
    case "br":
      return <br key={key} />;
    case "ul":
      return <ul key={key}>{children}</ul>;
    case "ol":
      return <ol key={key}>{children}</ol>;
    case "li":
      return <li key={key}>{children}</li>;
    case "blockquote":
      return <blockquote key={key}>{children}</blockquote>;
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return (
        <p key={key} className="font-semibold text-foreground">
          {children}
        </p>
      );
    case "a": {
      const href = element.getAttribute("href") ?? "";
      return isSafeLink(href) ? (
        <a key={key} href={href}>
          {children}
        </a>
      ) : (
        <Fragment key={key}>{children}</Fragment>
      );
    }
    default:
      return <Fragment key={key}>{children}</Fragment>;
  }
}

function parseRichText(value: string) {
  const document = new DOMParser().parseFromString(value, "text/html");
  return Array.from(document.body.childNodes).map((node, index) =>
    renderNode(node, `rich-text-${index}`),
  );
}

export function RichTextContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const [browserReady, setBrowserReady] = useState(false);

  useEffect(() => {
    setBrowserReady(true);
  }, []);

  const renderedContent = useMemo(
    () =>
      browserReady ? parseRichText(content) : richTextToPlainText(content),
    [browserReady, content],
  );

  return (
    <div
      className={cn(
        "text-sm leading-6 text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p+p]:mt-2 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
        !browserReady && "whitespace-pre-line",
        className,
      )}
    >
      {renderedContent}
    </div>
  );
}
