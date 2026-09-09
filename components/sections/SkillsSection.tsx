const SKILLS = [
  { category: 'Frontend', items: ['Next.js', 'React', 'TypeScript', 'Tailwind CSS', 'React Three Fiber'] },
  { category: 'Backend',  items: ['Node.js', 'Express', 'PostgreSQL', 'Redis', 'Auth0', 'REST APIs', 'WebSockets'] },
  { category: '3D / WebGL (side projects)', items: ['Three.js', 'GLSL Shaders', 'WebGL', 'Blender'] },
  { category: 'Tools',    items: ['Git', 'Docker', 'GitHub Actions', 'Vercel', 'Figma'] },
]

import DecodeText from '@/components/DecodeText'

export default function SkillsSection() {
  return (
    <section className="min-h-screen flex flex-col justify-center px-10 md:px-24 py-24">
      <div
        className="max-w-2xl p-[42px] md:p-[50px]"
        style={{ padding: '3px', background: 'rgba(8,2,20,0.55)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
      >
        <DecodeText as="p" text="02 / Skills" className="text-xs tracking-[0.3em] uppercase mb-6 block" style={{ color: '#7C3AED', fontFamily: 'Space Mono, monospace' }} />

        <h2 className="text-4xl md:text-5xl font-bold text-white mb-12 leading-tight">
          <DecodeText text="Tech " delay={120} /><DecodeText text="stack" delay={220} style={{ color: '#EC4899' }} />
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {SKILLS.map(({ category, items }, ci) => (
            <div key={category}>
              <DecodeText
                as="h3"
                text={category}
                delay={300 + ci * 100}
                className="text-sm tracking-widest uppercase mb-4 block"
                style={{ color: '#EC4899', fontFamily: 'Space Mono, monospace' }}
              />
              <div className="flex flex-wrap gap-2">
                {items.map((skill) => (
                  <span
                    key={skill}
                    className="px-3 py-1 text-sm text-white border rounded-none"
                    style={{
                      borderColor: '#7C3AED',
                      background: 'rgba(124,58,237,0.08)',
                      fontFamily: 'Space Mono, monospace',
                      fontSize: '0.75rem',
                    }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
