'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { createClient } from '@/lib/supabase/client'

type Props = {
  userId: string
  currentName: string
}

export default function ProfileNameForm({ userId, currentName }: Props) {
  const [name, setName] = useState(currentName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const isUnchanged = name.trim() === currentName
  const canSubmit = name.trim().length > 0 && !isUnchanged

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    const { error: updateError } = await supabase
      .from('users')
      .update({ name: name.trim() })
      .eq('id', userId)

    if (updateError) {
      console.error('ProfileNameForm: failed to update name', {
        message: updateError.message,
        code: updateError.code,
        details: updateError.details,
        hint: updateError.hint,
      })
      setError('名前を更新できませんでした。時間をおいて再度お試しください。')
      setLoading(false)
      return
    }

    setLoading(false)
    setSuccess(true)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <InputField
        id="name"
        label="ユーザー名"
        type="text"
        required
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          setSuccess(false)
        }}
        autoComplete="name"
      />

      {error && <ErrorMessage message={error} />}
      {success && (
        <p role="status" className="rounded-md bg-green-50 p-3 text-sm text-green-700">
          名前を更新しました
        </p>
      )}

      <Button type="submit" loading={loading} disabled={!canSubmit}>
        {loading ? '更新中...' : '名前を保存'}
      </Button>
    </form>
  )
}
