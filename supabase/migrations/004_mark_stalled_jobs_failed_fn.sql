create or replace function mark_stalled_jobs_failed()
returns void
language sql
security definer
as $$
  update scrape_jobs
  set status = 'failed',
      error = 'timeout',
      updated_at = now()
  where status = 'running'
    and updated_at < now() - interval '3 minutes';
$$;
