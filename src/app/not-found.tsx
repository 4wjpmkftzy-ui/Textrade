import Link from "next/link";

// 存在しないURLにアクセスされたときに表示するページ
export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-xl font-bold">ページが見つかりません</h1>
      <p className="mt-3 text-muted">URLが間違っているか、ページが削除された可能性があります。</p>
      <Link href="/" className="mt-6 inline-block text-brand underline">
        トップページへ戻る
      </Link>
    </div>
  );
}
