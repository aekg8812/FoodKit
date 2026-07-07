import { createClient } from "@/lib/supabase/server";

export default async function SupabaseTestPage() {
  let connectionStatus = "接続確認が完了しました";
  let connectionDetail = "Supabase サーバークライアントを作成できました。";
  let userMessage = "現在ログインしているユーザーはいません";
  let hasError = false;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();

    if (error && error.name !== "AuthSessionMissingError") {
      hasError = true;
      connectionStatus = "接続確認でエラーが発生しました";
      connectionDetail = error.message;
    } else if (data.user) {
      userMessage = data.user.email
        ? `ログイン中のユーザー: ${data.user.email}`
        : `ログイン中のユーザーID: ${data.user.id}`;
    }
  } catch (error) {
    hasError = true;
    connectionStatus = "接続確認でエラーが発生しました";
    connectionDetail =
      error instanceof Error ? error.message : "Supabase の確認中に不明なエラーが発生しました。";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-16 text-zinc-950">
      <section className="w-full max-w-xl rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Supabase 接続確認</h1>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              hasError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {hasError ? "Error" : "OK"}
          </span>
        </div>

        <dl className="space-y-4 text-sm">
          <div>
            <dt className="font-medium text-zinc-600">接続状態</dt>
            <dd className="mt-1 text-zinc-950">{connectionStatus}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-600">詳細</dt>
            <dd className="mt-1 text-zinc-950">{connectionDetail}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-600">現在のユーザー</dt>
            <dd className="mt-1 text-zinc-950">{userMessage}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-600">データベース</dt>
            <dd className="mt-1 text-zinc-950">DB テーブルへのクエリは実行していません。</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}