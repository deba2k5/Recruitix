-- Storage buckets for snapshots, plus RPCs for round-score recording and session finalization.

insert into storage.buckets (id, name, public)
values
  ('face-gate-snapshots', 'face-gate-snapshots', false),
  ('violation-snapshots', 'violation-snapshots', false)
on conflict (id) do nothing;

-- Object paths must be "${auth.uid()}/${sessionId}/${filename}" so the first folder segment is the owner.
create policy "face_gate_snapshots_insert_own" on storage.objects for insert
  with check (bucket_id = 'face-gate-snapshots' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "face_gate_snapshots_select_own_or_recruiter" on storage.objects for select
  using (bucket_id = 'face-gate-snapshots' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_recruiter()));

create policy "violation_snapshots_insert_own" on storage.objects for insert
  with check (bucket_id = 'violation-snapshots' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "violation_snapshots_select_own_or_recruiter" on storage.objects for select
  using (bucket_id = 'violation-snapshots' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_recruiter()));

-- Records a completed round's score, advances current_round, and finalizes the session after HR.
create or replace function public.record_round_score(p_session_id uuid, p_round text, p_score numeric, p_pct numeric)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_next_round text;
begin
  if p_round not in ('technical','personal','hr') then
    raise exception 'invalid round %', p_round;
  end if;

  update public.exam_sessions s set
    technical_score = case when p_round = 'technical' then p_score else s.technical_score end,
    technical_pct   = case when p_round = 'technical' then p_pct else s.technical_pct end,
    personal_score  = case when p_round = 'personal' then p_score else s.personal_score end,
    personal_pct    = case when p_round = 'personal' then p_pct else s.personal_pct end,
    hr_score        = case when p_round = 'hr' then p_score else s.hr_score end,
    hr_pct          = case when p_round = 'hr' then p_pct else s.hr_pct end
  where s.id = p_session_id and s.user_id = auth.uid();

  if not found then
    raise exception 'exam session not found or not owned by caller';
  end if;

  v_next_round := case p_round when 'technical' then 'personal' when 'personal' then 'hr' else null end;

  if v_next_round is not null then
    update public.exam_sessions set current_round = v_next_round where id = p_session_id;
  else
    update public.exam_sessions s set
      current_round = null,
      status = 'submitted',
      ended_at = now(),
      overall_pct = round((coalesce(s.technical_pct,0) + coalesce(s.personal_pct,0) + coalesce(s.hr_pct,0)) / 3.0, 1)
    where s.id = p_session_id;
  end if;
end; $$;
grant execute on function public.record_round_score(uuid, text, numeric, numeric) to authenticated;

-- Force-submits a session that hit the violation-policy AUTO_SUBMIT_AT threshold mid-round.
create or replace function public.auto_submit_exam_session(p_session_id uuid) returns void
  language plpgsql security invoker set search_path = public as $$
begin
  update public.exam_sessions s set
    status = 'auto_submitted',
    ended_at = now(),
    overall_pct = round((coalesce(s.technical_pct,0) + coalesce(s.personal_pct,0) + coalesce(s.hr_pct,0)) / 3.0, 1)
  where s.id = p_session_id and s.user_id = auth.uid();
end; $$;
grant execute on function public.auto_submit_exam_session(uuid) to authenticated;
