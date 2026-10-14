'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function RecordSearchClient() {
  const [query, setQuery] = useState('')

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 rounded-full border border-edge bg-surface px-4 py-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-sub" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="店名・ジャンル・エリアで検索"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-sub"
          autoComplete="off"
        />
      </label>

      {query.trim().length >= 2 && (
        <Link
          href={`/search/results?q=${encodeURIComponent(query.trim())}&from=record`}
          className="flex h-[48px] w-full items-center justify-center gap-1.5 rounded-full border border-terra text-sm font-medium text-terra"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          「{query.trim()}」をFoodKit全体で検索する
        </Link>
      )}
    </div>
  )
}
