-- 確認B: 関数の全文（テキストで整形して表示）
select pg_get_functiondef('public.join_group_by_invite_code(text)'::regprocedure) as def;