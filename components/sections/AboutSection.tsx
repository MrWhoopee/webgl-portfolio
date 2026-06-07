export default function AboutSection() {
  return (
    <section className="min-h-screen flex flex-col justify-center px-10 md:px-24 py-24">
      <div
        className="max-w-2xl p-[42px] md:p-[50px]"
        style={{ background: 'rgba(8,2,20,0.55)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
      >
        <p className="text-xs tracking-[0.3em] uppercase mb-6" style={{ color: '#7C3AED', fontFamily: 'Space Mono, monospace' }}>
          01 / About
        </p>

        <h2 className="text-4xl md:text-5xl font-bold text-white mb-8 leading-tight">
          Crafting digital<br />
          <span style={{ color: '#EC4899' }}>experiences</span>
        </h2>

        <div className="space-y-5 text-lg text-slate-300 leading-relaxed" style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.15rem' }}>
          <p>
            I&apos;m a full-stack developer with a passion for building products that live at the intersection of
            engineering and design. From scalable APIs to immersive WebGL interfaces — I care about every layer of the stack.
          </p>
          <p>
            Currently focused on Next.js applications, 3D web experiences with React Three Fiber,
            and pushing the creative boundaries of what a browser can render.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-3 gap-6">
          {[['3+', 'Years of experience'], ['15+', 'Projects shipped'], ['∞', 'Lines of code']].map(([val, label]) => (
            <div key={label}>
              <div className="text-3xl font-bold" style={{ color: '#7C3AED', fontFamily: 'Space Mono, monospace' }}>{val}</div>
              <div className="text-slate-400 text-sm mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
