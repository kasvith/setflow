import snapshot from './releases.json'

export interface Section {
  title: string
  items: string[]
}

export interface Release {
  tag: string
  date: string
  url: string
  zip: { url: string; size: number } | null
  sections: Section[]
}

interface GhRelease {
  tag_name: string
  published_at: string
  html_url: string
  body: string | null
  assets: { name: string; browser_download_url: string; size: number }[]
}

const REPO = 'kasvith/setflow'

// git-cliff bodies: "### Title" headings and "- item" bullets; everything else is noise
export function parseBody(body: string): Section[] {
  const sections: Section[] = []
  for (const raw of body.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('### ')) {
      sections.push({ title: line.slice(4), items: [] })
    } else if (line.startsWith('- ')) {
      if (sections.length === 0) sections.push({ title: '', items: [] })
      sections[sections.length - 1].items.push(line.slice(2))
    }
  }
  return sections.filter((s) => !INTERNAL.has(s.title))
}

// Groups that only matter inside the repo; the GitHub link on each release has the full notes
const INTERNAL = new Set(['Release', 'Testing', 'Build', 'Ci', 'Documentation'])

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// The only inline markdown these notes use is **bold**
export const inline = (s: string) => escape(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')

export const formatSize = (bytes: number) => `${Math.round(bytes / 1024)} KB`

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })

function toRelease(r: GhRelease): Release {
  const zip = r.assets.find((a) => a.name.endsWith('.zip'))
  return {
    tag: r.tag_name,
    date: r.published_at,
    url: r.html_url,
    zip: zip ? { url: zip.browser_download_url, size: zip.size } : null,
    sections: parseBody(r.body ?? ''),
  }
}

// Fetched live at build time; the committed snapshot covers rate limits and offline builds
export async function getReleases(): Promise<Release[]> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'setflow-site' },
    })
    if (!res.ok) throw new Error(`GitHub API ${res.status}`)
    return ((await res.json()) as GhRelease[]).map(toRelease)
  } catch (err) {
    console.warn(`[releases] using snapshot: ${(err as Error).message}`)
    return (snapshot as GhRelease[]).map(toRelease)
  }
}
