type SectionHeaderProps = {
  title: string;
  description?: string;
};

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="mb-4">
      <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
      {description ? (
        <p className="text-sm leading-relaxed text-foreground/55 mt-1">{description}</p>
      ) : null}
    </div>
  );
}
