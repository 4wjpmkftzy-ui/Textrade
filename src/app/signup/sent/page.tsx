import type { Metadata } from "next";
import { AuthCard } from "@/components/Form";

export const metadata: Metadata = { title: "確認メールを送りました" };

export default function SignupSentPage() {
  return (
    <AuthCard title="確認メールを送りました">
      <div className="space-y-3 text-sm leading-relaxed">
        <p>入力された大学のメールアドレスに、確認用のメールを送りました。</p>
        <p>メールのリンクを開き、表示された画面で「確認を完了する」を押すと登録が完了します。</p>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>メールが届かない場合は、迷惑メールフォルダもご確認ください。</li>
          <li>確認用のリンクの有効期限は1時間です。期限が切れた場合は、同じメールアドレスでもう一度登録すると、確認メールが届き直します。</li>
          <li>確認されないまま24時間たった登録は、自動で取り消されます。</li>
        </ul>
      </div>
    </AuthCard>
  );
}
