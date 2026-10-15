import type { NextConfig } from "next";

// ブラウザに「このサイトをどう扱うか」を指示するセキュリティ設定。
// 全ページの応答に付けて送ります。
const securityHeaders = [
  // 他サイトの中に埋め込まれて、偽の画面でクリックさせられる攻撃を防ぐ
  { key: "X-Frame-Options", value: "DENY" },
  // ファイルの種類をブラウザに勝手に推測させない
  { key: "X-Content-Type-Options", value: "nosniff" },
  // 他サイトへ移動するとき、閲覧中のページのURLを詳しく伝えない
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // カメラ・マイク・位置情報などを使わないことを宣言する
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // 常に暗号化通信(https)で接続させる
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // 「Next.jsで作られている」という情報を外部に出さない
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
