import Link from 'next/link'

export default function UserNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6 py-10">
      <div className="w-full max-w-md rounded-2xl border border-edge bg-surface p-6 text-center shadow-sm">
        <p className="text-3xl" aria-hidden="true">
          👤
        </p>
        <h1 className="mt-3 text-xl font-bold text-ink">ユーザーが見つかりません</h1>
        <p className="mt-2 text-sm text-ink-sub">
          ユーザー名が変更されたか、アカウントが存在しない可能性があります。
        </p>
        <Link
          href="/friends?tab=friends"
          className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-full bg-terra px-5 text-sm font-medium text-white transition-colors hover:bg-terra-deep"
        >
          友人ページに戻る
        </Link>
      </div>
    </main>
  )
}
