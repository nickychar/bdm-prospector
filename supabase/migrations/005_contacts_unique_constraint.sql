-- supabase/migrations/005_contacts_unique_constraint.sql
-- Required for upsert on (company_id, name) in contacts table
ALTER TABLE contacts
  ADD CONSTRAINT contacts_company_name_unique UNIQUE (company_id, name);
