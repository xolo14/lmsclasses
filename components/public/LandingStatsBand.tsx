const stats = [
  { value: "30+", label: "Courses" },
  { value: "500+", label: "Active Students" },
  { value: "Live", label: "Project Sessions", italic: true },
  { value: "100%", label: "Job Placement Assistance" },
];

export function LandingStatsBand() {
  return (
    <section className="border-y border-bg-border bg-bg-card">
      <div className="mx-auto grid max-w-7xl grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={[
              "flex flex-col items-center justify-center px-6 py-10 text-center md:py-14",
              i % 2 === 0 ? "border-r border-bg-border" : "",
              i < 2 ? "border-b border-bg-border lg:border-b-0" : "",
              i < 3 ? "lg:border-r lg:border-bg-border" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <p
              className={`font-display text-3xl text-text-primary md:text-4xl ${
                stat.italic ? "italic" : ""
              }`}
            >
              {stat.value}
            </p>
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
