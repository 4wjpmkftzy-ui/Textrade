import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";

// ログインが必要なページ(ここに書いたURLで始まるページ)
const PROTECTED_PATHS = ["/account"];

// proxy は、ページを表示する「前」に毎回実行される処理です。
// ここでは2つのことをしています。
//  1. ログイン状態(Cookie)の有効期限が近ければ、自動で延長する
//  2. ログインしていない人がマイページなどを開いたら、ログイン画面へ案内する
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // ログイン情報を含む応答が、他の人に使い回されないようにする指示
        for (const [name, value] of Object.entries(headers ?? {})) {
          response.headers.set(name, value);
        }
      },
    },
  });

  // ログイン状態を確認(このとき必要なら Cookie が更新されます)
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims);

  const { pathname, search } = request.nextUrl;
  if (!isLoggedIn && PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // 画像やスタイルなどのファイルには実行しない(無駄な処理を省くため)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
