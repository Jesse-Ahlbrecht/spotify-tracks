// The active decade's three representative tracks as compact Spotify players
// (most popular, nearest the decade's mood centre). Keyed by id so they reload on change.
export default function TrackEmbed({ tracks, decade, active }) {
  if (!tracks || tracks.length === 0) return null
  return (
    <div className={`embed ${active ? 'show' : ''}`}>
      <div className="embed-caption">
        Sounds like the <b>{decade}s</b> · 3 tracks nearest its centre
      </div>
      <div className="embed-list">
        {tracks.slice(0, 3).map((t) => (
          <iframe
            key={t.id}
            title={`${t.name} — ${t.artist}`}
            src={`https://open.spotify.com/embed/track/${t.id}`}
            width="100%"
            height="80"
            frameBorder="0"
            allow="encrypted-media; clipboard-write"
          />
        ))}
      </div>
    </div>
  )
}
