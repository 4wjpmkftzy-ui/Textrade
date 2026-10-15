import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/Form";
import { ConfirmForm } from "./ConfirmForm";

export const metadata: Metadata = { title: "メールアドレスの確認" };

// 確認メールのリンクを開くと表示されるページ。
// リンクの中の「確認コード」を受け取り、ボタンを押したときに確認を行います。
export default function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  return (
    <AuthCard title="メールアドレスの確認">
      <p className="mb-4 text-sm leading-relaxed">
        下のボタンを押して、手続きを完了してください。
      </p>
      <Suspense fallback={null}>
        <ConfirmFormFromLink searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function ConfirmFormFromLink({ searchParams }: Pick<PageProps<"/auth/confirm">, "searchParams">) {
  const { token_hash, type } = await searchParams;
  if (typeof token_hash !== "string" || typeof type !== "string") {
    return (
      <p className="text-sm text-red-800">
        リンクが正しくありません。メールに書かれたリンクをもう一度開いてください。
      </p>
    );
  }
  return <ConfirmForm tokenHash={token_hash} type={type} />;
}
