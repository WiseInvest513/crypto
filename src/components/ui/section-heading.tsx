type SectionHeadingProps = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
};

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
}: SectionHeadingProps) {
  return (
    <div className="section-heading">
      <p className="eyebrow">{eyebrow}</p>
      <div className="section-heading__content">
        <h2 id={id}>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}
