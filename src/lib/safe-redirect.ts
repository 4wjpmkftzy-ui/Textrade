// ログイン後の移動先(?next=...)を、このサイト内のページだけに限定します。
// 「https://悪いサイト」などを指定されて、偽サイトへ誘導されるのを防ぐためです。
export function safeNextPath(value: unknown, fallback = "/account"): string {
  if (typeof value !== "string") return fallback;
  // 「/」で始まり、「//」や「/\」で始まらないもの(=他のサイトを指さないもの)だけ許可
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
