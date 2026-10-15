import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "利用規約" };

// 見出しはよくある構成の例です。追加・削除・並べ替えは自由に行えます。
// 本文は各項目の body: "..." に書き込んでください。
export default function TermsPage() {
  return (
    <LegalPage
      title="利用規約"
      lastUpdated="未定"
      sections={[
        { heading: "目的・適用範囲" },
        { heading: "利用登録" },
        { heading: "アカウントの管理" },
        { heading: "取引について(当事者間で行うこと)" },
        { heading: "禁止事項" },
        { heading: "出品の削除・利用停止" },
        { heading: "免責事項" },
        { heading: "サービス内容の変更・終了" },
        { heading: "規約の変更" },
        { heading: "準拠法・管轄" },
      ]}
    />
  );
}
