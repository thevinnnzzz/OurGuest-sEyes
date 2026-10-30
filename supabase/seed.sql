-- Demo wedding for local testing. Only useful while the row stays "live"
-- (wedding_date within the last 3 days). Adjust dates as needed.
insert into public.weddings (slug, couple_name_1, couple_name_2, wedding_date, message)
values (
  'demo-lovebirds',
  'Amara',
  'Tomas',
  current_date,
  'Thank you for being the reason this day was unforgettable. See yourselves through our eyes.'
)
on conflict (slug) do nothing;
