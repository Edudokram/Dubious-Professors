import Layout from '../components/Layout'
import Button from '../components/Button'

export default function HowToPlayScreen({ onBack }) {
  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center gap-8 w-full max-w-md py-4">
        <h2 className="text-xl font-light tracking-[0.15em] uppercase">
          How to Play
        </h2>

        <div className="font-light leading-relaxed space-y-6 opacity-80 text-sm">
          <div>
            <p className="uppercase tracking-widest opacity-60 mb-2">Setup</p>
            <p>
              One player hosts the game and shares the game code. Everyone else joins with the code.
              Each professor privately reads a random Wikipedia article from a curated list of unusual topics.
            </p>
          </div>

          <div>
            <p className="uppercase tracking-widest opacity-60 mb-2">Roles</p>
            <p>
              One professor is randomly chosen as the <strong>Truthful Professor</strong> — their article
              becomes the topic. All other professors are <strong>Dubious</strong> and must bluff.
              The <strong>Interrogator</strong> knows the article title but not who read it.
            </p>
          </div>

          <div>
            <p className="uppercase tracking-widest opacity-60 mb-2">Interrogation</p>
            <p>
              The Interrogator questions each professor about the article. Truthful professors
              answer honestly. Dubious professors must pretend they know the article — be creative!
            </p>
          </div>

          <div>
            <p className="uppercase tracking-widest opacity-60 mb-2">The Guess</p>
            <p>
              After questioning, the Interrogator guesses who the Truthful Professor is.
              If correct — the Interrogator wins. If wrong — the Truthful Professor wins.
            </p>
          </div>
        </div>

        <Button onClick={onBack}>Back</Button>
      </div>
    </Layout>
  )
}
