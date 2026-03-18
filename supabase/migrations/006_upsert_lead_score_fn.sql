create or replace function upsert_lead_score(p_company_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_last_post_date    date;
  v_recent_post_count int;
  v_has_flexmarkt     boolean;
  v_most_recent_boards int;
  v_has_hm            boolean;
  v_has_as            boolean;
  v_has_smtp          boolean;
  v_size_band         text;
  v_stage             text;
  v_score             int := 0;
  v_days_since        int;
begin
  perform id from companies where id = p_company_id for update;

  select
    max(posted_date),
    count(*) filter (where posted_date >= current_date - interval '90 days'),
    coalesce(bool_or(board = 'flexmarkt'), false)
  into v_last_post_date, v_recent_post_count, v_has_flexmarkt
  from job_signals
  where company_id = p_company_id;

  select boards_count into v_most_recent_boards
  from job_signals
  where company_id = p_company_id
    and posted_date is not null
  order by posted_date desc
  limit 1;

  if v_last_post_date is not null then
    v_days_since := current_date - v_last_post_date;
    if    v_days_since = 0  then v_score := v_score + 30;
    elsif v_days_since <= 3 then v_score := v_score + 22;
    elsif v_days_since <= 7 then v_score := v_score + 15;
    elsif v_days_since <= 30 then v_score := v_score + 8;
    end if;
  end if;

  if v_recent_post_count >= 3 then v_score := v_score + 15; end if;
  if v_has_flexmarkt then v_score := v_score + 8; end if;
  if coalesce(v_most_recent_boards, 0) >= 3 then v_score := v_score + 5; end if;

  select
    coalesce(bool_or(persona_type = 'hiring_manager'  and confidence != 'low'), false),
    coalesce(bool_or(persona_type = 'agency_selector' and confidence != 'low'), false),
    coalesce(bool_or(smtp_verified = true), false)
  into v_has_hm, v_has_as, v_has_smtp
  from contacts
  where company_id = p_company_id;

  if v_has_hm   then v_score := v_score + 10; end if;
  if v_has_as   then v_score := v_score + 10; end if;
  if v_has_smtp then v_score := v_score + 5;  end if;

  select size_band into v_size_band from companies where id = p_company_id;
  if v_size_band = 'mid' then v_score := v_score + 5; end if;

  select stage into v_stage from leads where company_id = p_company_id for update;

  if v_stage in ('contacted', 'replied', 'meeting_booked', 'proposal_sent') then
    v_score := v_score - 20;
  end if;

  v_score := greatest(v_score, 0);

  insert into leads (company_id, score, stage)
  values (p_company_id, v_score, 'new')
  on conflict (company_id) do update
    set score = excluded.score,
        last_activity_at = now();
end;
$$;
