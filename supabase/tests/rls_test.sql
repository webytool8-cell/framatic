-- RLS / ownership tests. Any failure raises and aborts (ON_ERROR_STOP).
grant usage on schema public, auth, storage to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com');

-- signup trigger created profile + preferences
do $$ begin
  if (select count(*) from public.profiles) <> 2 then raise exception 'profiles not created'; end if;
  if (select count(*) from public.user_preferences) <> 2 then raise exception 'prefs not created'; end if;
end $$;

-- Alice creates data as an authenticated user
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.projects (id, user_id, name, website_url) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Alice site', 'https://a.example');
insert into public.brand_profiles (id, user_id, profile) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '{}'::jsonb);
update public.projects set brand_profile_id = '20000000-0000-0000-0000-000000000001' where id = '10000000-0000-0000-0000-000000000001';
insert into public.creative_concepts (id, project_id, user_id, kind, slot, content) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'problem_solution', 'A', '{}');
insert into public.scene_plans (concept_id, project_id, user_id, version, source, plan) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 1, 'ai', '{}');
insert into storage.objects (bucket_id, name) values ('brand-assets', '00000000-0000-0000-0000-00000000000a/logo.png');

-- Bob cannot see or modify Alice's data
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  if (select count(*) from public.projects) <> 0 then raise exception 'bob can see alice projects'; end if;
  if (select count(*) from public.brand_profiles) <> 0 then raise exception 'bob can see alice brand'; end if;
  if (select count(*) from public.creative_concepts) <> 0 then raise exception 'bob can see alice concepts'; end if;
  if (select count(*) from public.scene_plans) <> 0 then raise exception 'bob can see alice scene plans'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'bob sees other profiles'; end if;
end $$;
update public.projects set name = 'pwned' where id = '10000000-0000-0000-0000-000000000001';
delete from public.projects where id = '10000000-0000-0000-0000-000000000001';

-- Bob cannot insert rows claiming to be Alice
do $$ begin
  begin
    insert into public.projects (user_id, name) values ('00000000-0000-0000-0000-00000000000a', 'spoof');
    raise exception 'spoofed insert succeeded';
  exception when insufficient_privilege then null; end;
end $$;

-- Bob cannot attach children to Alice's project, even with his own user_id
do $$ begin
  begin
    insert into public.creative_concepts (project_id, user_id, kind, slot, content)
      values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'brand_manifesto', 'C', '{}');
    raise exception 'cross-project insert succeeded';
  exception when insufficient_privilege then null; end;
end $$;

-- Bob cannot point his project at Alice's brand profile
insert into public.projects (id, user_id, name) values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'Bob site');
do $$ begin
  begin
    update public.projects set brand_profile_id = '20000000-0000-0000-0000-000000000001' where id = '10000000-0000-0000-0000-000000000002';
    raise exception 'cross-user brand link succeeded';
  exception when insufficient_privilege then null; end;
end $$;

-- Bob cannot upload into Alice's storage folder
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('brand-assets', '00000000-0000-0000-0000-00000000000a/evil.png');
    raise exception 'cross-user upload succeeded';
  exception when insufficient_privilege then null; end;
end $$;
insert into storage.objects (bucket_id, name) values ('brand-assets', '00000000-0000-0000-0000-00000000000b/logo.png');

-- Only one preferred concept per project
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.creative_concepts (project_id, user_id, kind, slot, content, is_preferred) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'product_in_motion', 'B', '{}', true);
do $$ begin
  begin
    update public.creative_concepts set is_preferred = true where kind = 'problem_solution';
    raise exception 'two preferred concepts allowed';
  exception when unique_violation then null; end;
end $$;

-- Alice's data survived Bob's attempts
do $$ begin
  if (select name from public.projects where id = '10000000-0000-0000-0000-000000000001') <> 'Alice site' then
    raise exception 'alice project was modified';
  end if;
end $$;

-- Renders are private to their owner
insert into public.renders (project_id, user_id, concept_id, scene_plan_version, aspect_ratio, duration_sec)
  select project_id, user_id, id, 1, '16:9', 10 from public.creative_concepts where kind = 'product_in_motion';
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  if (select count(*) from public.renders) <> 0 then raise exception 'bob can see alice renders'; end if;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

-- Cascade: deleting the project deletes concepts and scene plans
delete from public.projects where id = '10000000-0000-0000-0000-000000000001';
do $$ begin
  if (select count(*) from public.creative_concepts) <> 0 or (select count(*) from public.scene_plans) <> 0 or (select count(*) from public.renders) <> 0 then
    raise exception 'cascade delete failed';
  end if;
end $$;

reset role;
select 'RLS TESTS PASSED' as result;
