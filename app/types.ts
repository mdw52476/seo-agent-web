export type SiteType = 'nextjs' | 'html'

export interface Site {
  id: string
  name: string
  url: string
  agentRoot: string
  siteType: SiteType
  env: {
    ANTHROPIC_API_KEY?: string
    GITHUB_TOKEN?: string
    GITHUB_REPO?: string
    GITHUB_BRANCH?: string
    GITHUB_CONTENT_PATH?: string
    GITHUB_DIRECTORY_PATH?: string
    SITE_URL?: string
    [key: string]: string | undefined
  }
}

export interface PublishedEntry {
  keyword: string
  slug: string
  title: string
  publishedAt: string
  url: string
}

export interface AuditReport {
  score: number
  pagesChecked: number
  issues: { severity: string; message?: string }[]
  auditedAt: string
}
