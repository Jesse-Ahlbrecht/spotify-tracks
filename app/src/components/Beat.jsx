import { useInView } from '../lib.js'

// A standalone, reveal-on-scroll narrative section (beats 3–6).
export default function Beat({ kicker, title, lede, children }) {
  const [ref, seen] = useInView()
  return (
    <section ref={ref} className={`beat ${seen ? 'in' : ''}`}>
      <div className="beat-head">
        {kicker && <div className="kicker">{kicker}</div>}
        <h2>{title}</h2>
        {lede && <p className="lede">{lede}</p>}
      </div>
      <div className="beat-body">{children}</div>
    </section>
  )
}
