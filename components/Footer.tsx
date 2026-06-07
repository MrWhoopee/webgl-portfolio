const LINKS = [
  { label: "GitHub", href: "https://github.com/" },
  { label: "LinkedIn", href: "https://linkedin.com/in/" },
  { label: "Email", href: "mailto:artem.holovko.97@gmail.com" },
];

export default function Footer() {
  return (
    <footer
      style={{
        background: "#040008",
        borderTop: "1px solid rgba(124,58,237,0.18)",
        fontFamily: '"Space Mono", monospace',
      }}
    >
      <div className="px-10 md:px-24 py-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
        {/* Brand */}
        <div>
          <div className="text-white text-lg font-bold tracking-widest mb-1">
            A<span style={{ color: "#7C3AED" }}>.</span>
          </div>
          <div className="text-xs tracking-wider" style={{ color: "#4B5563" }}>
            Full-Stack Developer
          </div>
        </div>

        {/* Links */}
        <div className="flex gap-8">
          {LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs tracking-widest transition-colors hover:text-white"
              style={{ color: "#6B7280" }}
            >
              {label}
            </a>
          ))}
        </div>

        {/* Copyright */}
        <div className="text-xs" style={{ color: "#374151" }}>
          <div>© 2026 Artemii.</div>
          <div>Built with Next.js &amp; WebGL.</div>
        </div>
      </div>
    </footer>
  );
}
