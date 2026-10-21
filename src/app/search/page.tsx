import { redirect } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { createClient } from "@/lib/supabase/server";
import { getUserState } from "@/lib/auth/getUserState";
import { logPageAuthRequest } from "@/lib/diagnostics/authRequests";

export default async function SearchPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logPageAuthRequest("/search", Boolean(user));
  if (!user) redirect("/login");

  const state = await getUserState(supabase, user);
  if (state === "no_onboarding") redirect("/onboarding");

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Header */}
      <div className="px-4 pt-14 pb-3 text-center">
        <h1 className="text-xl font-bold text-ink">検索</h1>
      </div>

      {/* Search bar */}
      <div className="px-5 pb-3">
        <form action="/search/results" method="GET">
          <label className="flex items-center gap-2.5 rounded-2xl border border-edge bg-surface px-4 py-3">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-ink-sub"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              name="q"
              placeholder="店名・ジャンル・エリアで検索"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-sub"
              autoComplete="off"
            />
          </label>
        </form>
        <p className="mt-2 text-sm text-ink-sub">
          行きたいお店を直接探すか、今日の条件から探せます
        </p>
      </div>

      <div className="px-4 space-y-4">
        {/* ── 今日のお店を探す ─────────────────────────────────────────── */}
        <div
          className="overflow-hidden rounded-2xl"
          style={{ backgroundColor: "#FEF5EC" }}
        >
          {/* Top portion: left text + right photo */}
          <div className="relative flex" style={{ minHeight: "168px" }}>
            {/* Left content */}
            <div
              className="flex flex-col justify-start p-4 pr-2"
              style={{ width: "62%" }}
            >
              {/* Heading with orange spark icon */}
              <div className="mb-2 flex items-center gap-1.5">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 9 L7 4"
                    stroke="#F97316"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M1.5 13 L8 6.5"
                    stroke="#F97316"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M5 15.5 L11 9.5"
                    stroke="#F97316"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
                <h2 className="text-[19px] font-black leading-tight text-ink">
                  今日のお店を探す
                </h2>
              </div>
              {/* Description */}
              <p className="text-xs leading-relaxed text-ink-sub">
                予算・人数・移動時間・雰囲気などから、
                <br />
                今の条件に合うお店をおすすめします
              </p>
              {/* Condition chips */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["友達と", "¥2,000以下", "近くで", "ゆっくり"].map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-edge bg-white/90 px-2.5 py-1 text-xs font-medium text-ink-sub"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: food photo — fills remaining width + full height */}
            <div
              className="absolute right-0 top-0 bottom-0 overflow-hidden"
              style={{ width: "42%" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/landing-hero-food.png"
                alt=""
                className="h-full w-full object-cover object-center"
                aria-hidden="true"
              />
              {/* Gradient: cream → transparent from left edge of photo */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to right, #FEF5EC 0%, rgba(254,245,236,0.55) 35%, transparent 70%)",
                }}
              />
              {/* Overlay copy */}
              <div className="absolute top-3 right-3">
                <p
                  className="text-right text-[10px] font-bold italic leading-snug text-white"
                  style={{ textShadow: "0 1px 4px rgba(0,0,0,0.55)" }}
                >
                  {/* 今日は
                  <br />
                  どんなお店に行く？ */}
                </p>
              </div>
            </div>
          </div>

          {/* Full-width CTA */}
          <div className="px-4 pb-4">
            <Link
              href="/search/today"
              className="flex h-[46px] w-full items-center justify-center gap-1 rounded-xl bg-terra text-sm font-bold text-white"
            >
              条件を設定する
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          </div>
        </div>

        {/* ── 探し方 ────────────────────────────────────────────────────── */}
        <div>
          <h2 className="mb-3 text-[17px] font-black text-ink">探し方</h2>

          <div className="space-y-3">
            {/* キーワードで探す */}
            <Link
              href="/search/results"
              className="flex items-center gap-3 rounded-2xl border border-edge bg-surface px-4 py-4 hover:bg-canvas"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-terra/10">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#F97316"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-bold text-ink">キーワードで探す</p>
                <p className="mt-0.5 text-xs text-ink-sub">
                  店名・ジャンル・エリアから探す
                </p>
              </div>
              <svg
                width="8"
                height="14"
                viewBox="0 0 8 14"
                fill="none"
                className="shrink-0 text-ink-sub"
                aria-hidden="true"
              >
                <path
                  d="M1 1l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>

            {/* FoodKitに選んでもらう */}
            <Link
              href="/search/today"
              className="flex items-center gap-3 rounded-2xl border border-edge bg-surface px-4 py-4 hover:bg-canvas"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-terra/10">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#F97316"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-bold text-ink">FoodKitに選んでもらう</p>
                <p className="mt-0.5 text-xs text-ink-sub">
                  今日の条件からおすすめを探す
                </p>
              </div>
              <svg
                width="8"
                height="14"
                viewBox="0 0 8 14"
                fill="none"
                className="shrink-0 text-ink-sub"
                aria-hidden="true"
              >
                <path
                  d="M1 1l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
