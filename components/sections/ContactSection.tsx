import DecodeText from "@/components/DecodeText";
import CoreStatus from "@/components/CoreStatus";

const LINKS = [
  { label: "GitHub", href: "https://github.com/MrWhoopee" },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/artemii-holovko-146490260/",
  },
  { label: "Email", href: "mailto:artem.holovko.97@gmail.com" },
];

export default function ContactSection() {
  return (
    <section
      className="relative min-h-screen flex flex-col justify-center px-10 md:px-24 py-24"
    >
      <div
        className="max-w-2xl p-[42px] md:p-[50px]"
        style={{ padding: "3px", background: "rgba(8,2,20,0.55)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
      >
        <DecodeText
          as="p"
          text="03 / Contact"
          className="text-xs tracking-[0.3em] uppercase mb-6 block"
          style={{ color: "#7C3AED", fontFamily: "Space Mono, monospace" }}
        />

        <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
          <DecodeText text="Let's build something" delay={120} />
          <br />
          <DecodeText text="together" delay={300} style={{ color: "#EC4899" }} />
        </h2>

        <DecodeText
          as="p"
          delay={420}
          text="Open to interesting projects and collaborations. Drop me a message — I usually respond within a day."
          className="text-lg text-slate-300 mb-10 leading-relaxed block"
          style={{ fontFamily: "Rajdhani, sans-serif", fontSize: "1.15rem" }}
        />

        <div className="flex flex-col gap-4">
          {LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 text-slate-300 hover:text-white transition-colors w-fit"
              style={{ fontFamily: "Space Mono, monospace" }}
            >
              <span
                className="w-8 h-px transition-all group-hover:w-14"
                style={{ background: "#7C3AED" }}
              />
              <span className="text-sm tracking-wider">{label}</span>
              <span style={{ color: "#EC4899" }}>↗</span>
            </a>
          ))}
        </div>
      </div>

      {/* Core status plaque — flows below the text on phones; pinned under the
          core on desktop (md:fixed pulls it out of this flow). */}
      <CoreStatus />

      <p
        className="absolute bottom-8 max-w-[60%] text-xs text-slate-600 md:max-w-none"
        style={{ fontFamily: "Space Mono, monospace" }}
      >
        © 2026 Artemii. Built with Next.js & WebGL.
      </p>
    </section>
  );
}
