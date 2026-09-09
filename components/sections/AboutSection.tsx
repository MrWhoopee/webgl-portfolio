import DecodeText from '@/components/DecodeText'

export default function AboutSection() {
  return (
    <section className="min-h-screen flex flex-col justify-center px-10 md:px-24 py-24">
      <div
        className="max-w-2xl p-[42px] md:p-[50px]"
        style={{ padding: '3px', background: 'rgba(8,2,20,0.55)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
      >
        <DecodeText as="p" text="01 / About" className="text-xs tracking-[0.3em] uppercase mb-6 block" style={{ color: '#7C3AED', fontFamily: 'Space Mono, monospace' }} />

        <h2 className="text-4xl md:text-5xl font-bold text-white mb-8 leading-tight">
          <DecodeText text="Crafting digital" delay={120} /><br />
          <DecodeText text="experiences" delay={260} style={{ color: '#EC4899' }} />
        </h2>

        <div className="space-y-5 text-lg text-slate-300 leading-relaxed" style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.15rem' }}>
          <DecodeText as="p" delay={380} text="I'm a full-stack developer with a passion for building products that live at the intersection of engineering and design. From scalable APIs to immersive WebGL interfaces — I care about every layer of the stack." />
          <DecodeText as="p" delay={520} text="Currently focused on Next.js applications, 3D web experiences with React Three Fiber, and pushing the creative boundaries of what a browser can render." />
        </div>

        <div className="mt-10 grid grid-cols-3 gap-6">
          {[['2+', 'Years of experience'], ['15+', 'Projects shipped'], ['∞', 'Lines of code']].map(([val, label]) => (
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
