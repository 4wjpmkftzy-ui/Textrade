import Link from "next/link";
import { INDEPENDENCE_NOTICE, SITE_NAME } from "@/lib/site";

// 全ページの下部に表示するフッター。
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-muted">
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/terms" className="hover:text-foreground hover:underline">
            利用規約
          </Link>
          <Link href="/privacy" className="hover:text-foreground hover:underline">
            プライバシーポリシー
          </Link>
        </nav>
        <p className="mt-4">{INDEPENDENCE_NOTICE}</p>
        <p className="mt-1">© {SITE_NAME}</p>
      </div>
    </footer>
  );
}
