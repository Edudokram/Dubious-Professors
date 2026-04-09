import Layout from '../components/Layout'
import Button from '../components/Button'
import { howToPlaySections as sections } from '../lib/howToPlay'

export default function HowToPlayScreen({ onBack }) {
  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center gap-6 w-full py-2">
        <h2 className="animate-fade-in text-xl font-bold">How to Play</h2>

        <div className="w-full space-y-3 stagger">
          {sections.map((s, i) => (
            <div key={i} className="animate-slide-up bg-[#1a1a1a] border border-[#333] rounded-xl p-4">
              <p className="text-xs font-bold tracking-widest uppercase text-[#666] mb-2">{s.label}</p>
              <p className="text-sm text-[#ccc] leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>

        <div className="animate-fade-in w-full max-w-xs mt-2" style={{ animationDelay: '400ms' }}>
          <Button onClick={onBack} variant="ghost">Back</Button>
        </div>
      </div>
    </Layout>
  )
}
