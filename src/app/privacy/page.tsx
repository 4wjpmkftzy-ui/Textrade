import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "プライバシーポリシー" };

// 見出しはよくある構成の例です。追加・削除・並べ替えは自由に行えます。
// 本文は各項目の body: "..." に書き込んでください。
export default function PrivacyPage() {
  return (
    <LegalPage
      title="プライバシーポリシー"
      lastUpdated="未定"
      sections={[
        { heading: "取得する情報" },
        { heading: "利用目的" },
        { heading: "他の利用者への表示範囲" },
        { heading: "第三者への提供" },
        { heading: "外部サービスの利用" },
        { heading: "安全管理" },
        { heading: "保存期間と削除" },
        { heading: "開示・訂正・削除のご請求" },
        { heading: "お問い合わせ窓口" },
        { heading: "本ポリシーの変更" },
      ]}
    />
  );
}
