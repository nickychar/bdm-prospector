create or replace function claim_scrape_job()
returns setof scrape_jobs
language sql
security definer
as $$
  update scrape_jobs
  set status = 'running',
      started_at = now(),
      updated_at = now()
  where id = (
    select id from scrape_jobs
    where status = 'queued'
    order by created_at
    limit 1
    for update skip locked
  )
  returning *;
$$;
