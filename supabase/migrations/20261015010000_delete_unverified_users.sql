-- =====================================================================
-- 未確認アカウントの自動削除
--
-- 【なぜ必要か】
--  他人の大学メールアドレスで勝手に登録すると、確認メールは本人に届くので
--  ログインはできませんが、そのアドレスが「使用済み」のまま残ってしまいます。
--  (本人が後から登録しようとしても登録できない=「先取り登録」)
--  そこで、登録から24時間たってもメール確認されていないアカウントを削除します。
-- =====================================================================

create function public.delete_unverified_users() returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_deleted integer;
begin
  -- auth.users を消すと、profiles / user_private も一緒に消えます(on delete cascade)
  delete from auth.users u
  where u.email_confirmed_at is null
    and u.created_at < now() - interval '24 hours'
    -- 念のため、一度でも大学メールの確認が済んだ人は対象外にする
    and not exists (
      select 1 from public.user_private p
      where p.user_id = u.id and p.university_verified_at is not null
    );
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- 画面側(利用者)からは実行できないようにする
revoke execute on function public.delete_unverified_users() from public, anon, authenticated;

-- 1時間ごとに自動実行する(Supabase の pg_cron という定期実行の仕組みを使う)
-- ※ 手元のテスト用データベースには pg_cron がないので、その場合は登録だけ飛ばします
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule(
      'delete-unverified-users',
      '23 * * * *',
      'select public.delete_unverified_users()'
    );
  else
    raise notice 'pg_cron がないため、定期実行の登録をスキップしました';
  end if;
end;
$$;
