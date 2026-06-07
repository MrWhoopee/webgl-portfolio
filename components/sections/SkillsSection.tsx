const SKILLS = [
  { category: 'Frontend', items: ['Next.js', 'React', 'TypeScript', 'Tailwind CSS', 'React Three Fiber'] },
  { category: 'Backend',  items: ['Node.js', 'PostgreSQL', 'REST APIs', 'WebSockets'] },
  { category: '3D / WebGL', items: ['Three.js', 'GLSL Shaders', 'WebGL', 'Blender'] },
  { category: 'Tools',    items: ['Git', 'Docker', 'Vercel', 'Figma'] },
]

export default function SkillsSection() {
  return (
    <section className="min-h-screen flex flex-col justify-center px-10 md:px-24 py-24">
      <div
        className="max-w-2xl p-[42px] md:p-[50px]"
        style={{ background: 'rgba(8,2,20,0.55)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
      >
        <p className="text-xs tracking-[0.3em] uppercase mb-6" style={{ color: '#7C3AED', fontFamily: 'Space Mono, monospace' }}>
          02 / Skills
        </p>

        <h2 className="text-4xl md:text-5xl font-bold text-white mb-12 leading-tight">
          Tech <span style={{ color: '#EC4899' }}>stack</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {SKILLS.map(({ category, items }) => (
            <div key={category}>
              <h3
                className="text-sm tracking-widest uppercase mb-4"
                style={{ color: '#EC4899', fontFamily: 'Space Mono, monospace' }}
              >
                {category}
              </h3>
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
