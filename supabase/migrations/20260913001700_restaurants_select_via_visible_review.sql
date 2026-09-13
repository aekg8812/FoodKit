create policy restaurants_select_via_visible_review
on public.restaurants
for select
to authenticated
using (
  exists (
    select 1
    from public.reviews r
    where r.restaurant_id = restaurants.id
      and public.can_view_review(r.user_id, r.restaurant_id)
  )
);
