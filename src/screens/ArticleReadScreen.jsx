import Layout from '../components/Layout'
import Button from '../components/Button'

export default function ArticleReadScreen({ title, url, onBack, onReady }) {
  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center gap-4 w-full max-w-lg">
        <h2 className="text-lg font-light tracking-[0.1em] text-center">
          {title}
        </h2>

        <div className="w-full flex-1 min-h-[50vh] border border-white">
          <iframe
            src={url}
            title={title}
            className="w-full h-full min-h-[50vh]"
            sandbox="allow-same-origin allow-scripts"
          />
        </div>

        <div className="flex gap-4 py-4">
          <Button onClick={onBack}>Back</Button>
          <Button onClick={onReady}>Ready!</Button>
        </div>
      </div>
    </Layout>
  )
}
