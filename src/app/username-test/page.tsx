'use client'

// E1 の完了確認用ページ（設計書 E1 §7）。
// search_users_by_username の動作を目視するためだけの最小画面で、
// 実際の検索UI・フォロー導線は E2 で作る。E2 完成後は削除してよい。

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import ErrorMessage from '@/components/ui/ErrorMessage'
import InputField from '@/components/ui/InputField'
import ValueTypeBadge from '@/components/ValueTypeBadge'

type SearchResult = {
  id: string
  username: string
  name: string
  main_value_type: string | null
}

export default function UsernameTestPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.rpc('search_users_by_username', {
      p_query: query,
    })

    if (error) {
      console.error('search_users_by_username failed', error.message, error.code, error.details, error.hint)
      setError('検索に失敗しました。時間をおいて試してください')
      setResults(null)
      setLoading(false)
      return
    }

    setResults((data ?? []) as SearchResult[])
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-canvas px-6 py-10 pb-20">
      <div className="mx-auto max-w-md">
        <h1 className="mb-1 text-2xl font-bold text-ink">ユーザー検索（動作確認用）</h1>
        <p className="mb-6 text-xs text-ink-sub">
          ユーザーIDの前方一致で検索します。2文字未満と自分自身は結果に出ません。
        </p>

        <Card as="section" className="mb-4 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <InputField
              id="query"
              label="ユーザーID"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="aya"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            {error && <ErrorMessage message={error} />}
            <Button type="submit" loading={loading}>
              {loading ? '検索中...' : '検索する'}
            </Button>
          </form>
        </Card>

        {results !== null &&
          (results.length === 0 ? (
            <Card as="section" className="p-6">
              <p className="text-sm text-ink-sub">該当するユーザーが見つかりませんでした</p>
            </Card>
          ) : (
            <Card as="section" className="p-6">
              <p className="mb-4 text-xs text-ink-sub">{results.length}件</p>
              <ul className="space-y-4">
                {results.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{u.name}</p>
                      <p className="truncate text-sm text-ink-sub">@{u.username}</p>
                    </div>
                    <ValueTypeBadge type={u.main_value_type} />
                  </li>
                ))}
              </ul>
            </Card>
          ))}
      </div>
      <BottomNav />
    </main>
  )
}
