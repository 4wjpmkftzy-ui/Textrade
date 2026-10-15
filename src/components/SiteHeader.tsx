import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { SITE_NAME } from "@/lib/site";

// 全ページの上部に表示するヘッダー。
// 右側には、ログインしていれば「マイページ」、していなければ「ログイン」「新規登録」を表示します。
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold tracking-tight text-brand">
          {SITE_NAME}
        </Link>
        {/* ログイン状態の確認を待つ間も、ヘッダーの他の部分はすぐ表示されます */}
        <Suspense fallback={null}>
          <HeaderAccount />
        </Suspense>
      </div>
    </header>
  );
}

async function HeaderAccount() {
  let loggedIn = false;
  try {
    loggedIn = (await getCurrentUser()) !== null;
  } catch {
    // Supabase に接続できないときも、サイト全体が表示できなくならないようにする
  }

  if (loggedIn) {
    return (
      <Link href="/account" className="text-sm font-semibold text-brand">
        マイページ
      </Link>
    );
  }
  return (
    <nav className="flex items-center gap-3 text-sm">
      <Link href="/login" className="font-semibold text-muted">
        ログイン
      </Link>
      <Link href="/signup" className="rounded-full bg-brand px-3 py-1.5 font-semibold text-white">
        新規登録
      </Link>
    </nav>
  );
}
