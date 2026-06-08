import SceneLoader from '@/components/three/SceneLoader'
import SecretLayer from '@/components/SecretLayer'
import Navbar from '@/components/Navbar'
import AudioManager from '@/components/AudioManager'
import TerminalCode from '@/components/TerminalCode'
import SynthwaveHero from '@/components/sections/SynthwaveHero'
import AboutSection from '@/components/sections/AboutSection'
import SkillsSection from '@/components/sections/SkillsSection'
import ContactSection from '@/components/sections/ContactSection'

export default function Home() {
  return (
    <>
      <SceneLoader />
      <SecretLayer />
      <Navbar />
      <AudioManager />
      <TerminalCode />

      <main>
        <div id="hero">
          <SynthwaveHero />
        </div>

        {/* Transition — the torn pink planes scroll into view */}
        <div style={{ height: '120vh' }} />

        {/* 01 / About — over the pink planes */}
        <div id="about">
          <AboutSection />
        </div>

        {/* Long descent through the big tear, down to the city */}
        <div style={{ height: '150vh' }} />

        {/* 02 / Skills — over the cyberpunk city */}
        <div id="skills">
          <SkillsSection />
        </div>

        {/* Long descent down the power cables into the core chamber */}
        <div style={{ height: '150vh' }} />

        {/* 03 / Contact — facing the neutron core */}
        <div id="contact">
          <ContactSection />
        </div>
      </main>
    </>
  )
}
