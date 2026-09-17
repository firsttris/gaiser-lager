alter table public.signup_settings
add column inactivity_timeout_minutes int not null default 5;
