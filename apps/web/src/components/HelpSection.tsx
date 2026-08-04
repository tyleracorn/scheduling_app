type HelpSectionProps = {
  id: string;
  title: string;
  steps: string[];
  tip?: string;
  imageSrc?: string;
  imageAlt?: string;
};

export function HelpSection({ id, title, steps, tip, imageSrc, imageAlt }: HelpSectionProps) {
  return (
    <section id={id} className="scroll-mt-20 space-y-3 border-b border-slate-200 pb-8 last:border-b-0">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <ol className="list-decimal list-inside space-y-1.5 text-sm text-slate-700">
        {steps.map((step) => (
          <li key={step} className="leading-relaxed">
            {step}
          </li>
        ))}
      </ol>
      {tip && <p className="text-sm text-slate-500 italic">{tip}</p>}
      {imageSrc && (
        <figure className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          <img
            src={imageSrc}
            alt={imageAlt ?? title}
            className="w-full h-auto"
            loading="lazy"
          />
        </figure>
      )}
    </section>
  );
}
