insert into public.hbs_app_settings (key, value)
values ('invite_code', jsonb_build_object('code', 'HBS2026'))
on conflict (key) do update set value = excluded.value;