import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

// 全ページの上部に表示するヘッダー。
// ログインや出品のリンクは、それぞれの機能を作る段階で追加します。
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold tracking-tight text-brand">
          {SITE_NAME}
        </Link>
      </div>
    </header>
  );
}
