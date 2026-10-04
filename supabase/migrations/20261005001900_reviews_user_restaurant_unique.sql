alter table public.reviews
  add constraint reviews_user_restaurant_unique
  unique (user_id, restaurant_id);
