import Link from "next/link";
import type { ReactNode } from "react";

export function CompanyPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-20">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline"
      >
        Back to home
      </Link>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      <p className="mt-5 text-lg leading-8 text-muted-foreground">{intro}</p>
      <p className="mt-6 border-y border-border py-4 text-sm leading-6 text-muted-foreground">
        This page contains preliminary information. Content will be updated
        before it is finalized.
      </p>
      <div className="mt-8 space-y-8 text-base leading-7 text-muted-foreground [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4">
        {children}
      </div>
    </article>
  );
}
