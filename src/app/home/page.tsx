import { createClient } from "@/lib/supabase/server";
import { getUserState } from "@/lib/auth/getUserState";
import { redirect } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import ValueTypeBadge from "@/components/ValueTypeBadge";
import RestaurantCard from "@/components/RestaurantCard";
import CategoryChips from "./CategoryChips";
import {
  distributionFromRecommendationRow,
  sortRestaurants,
  type ReviewRow,
  type RestaurantRow,
} from "@/lib/restaurants/aggregate";
import {
  computeMutualFollowIds,
  type FollowRow,
} from "@/lib/follows/queries";
import {
  VALUE_TYPE_LABEL,
  type MainValueType,
} from "@/lib/onboarding/classifyValueType";
import { logPageAuthRequest } from "@/lib/diagnostics/authRequests";

type RecommendationRow = {
  restaurant_id: string;
  name: string;
  area: string | null;
  genre: string | null;
  same_type_review_count: number;
  rating_4_count: number;
  rating_3_count: number;
  rating_2_count: number;
  rating_1_count: number;
};

type HomeImageReviewRow = {
  restaurant_id: string;
  image_path: string | null;
  visit_date: string | null;
  created_at: string;
};

type FriendValueProfileRow = {
  user_id: string;
  main_value_type: MainValueType | null;
};

type OwnReviewRow = {
  restaurant_id: string;
};

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logPageAuthRequest("/home", Boolean(user));
  if (!user) redirect("/login");

  const state = await getUserState(supabase, user);
  if (state === "no_onboarding") redirect("/onboarding");

  const [
    recommendationsResult,
    valueTypeResult,
    userResult,
    followsResult,
    ownReviewsResult,
  ] = await Promise.all([
      supabase.rpc("get_recommendations_same_type", { p_limit: 10 }),
      supabase
        .from("user_public_value_profiles")
        .select("main_value_type")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.from("users").select("name").eq("id", user.id).single(),
      supabase
        .from("follows")
        .select("follower_id, followee_id")
        .or(`follower_id.eq.${user.id},followee_id.eq.${user.id}`)
        .eq("status", "accepted"),
      supabase
        .from("reviews")
        .select("restaurant_id")
        .eq("user_id", user.id),
    ]);

  if (recommendationsResult.error) {
    throw new Error(
      `HomePage: failed to load recommendations: ${recommendationsResult.error.message}`,
    );
  }
  if (valueTypeResult.error) {
    throw new Error(
      `HomePage: failed to load value type: ${valueTypeResult.error.message}`,
    );
  }
  if (followsResult.error) {
    throw new Error(
      `HomePage: failed to load follows: ${followsResult.error.message}`,
    );
  }
  if (ownReviewsResult.error) {
    throw new Error(
      `HomePage: failed to load own reviews: ${ownReviewsResult.error.message}`,
    );
  }

  const recommendationRows =
    (recommendationsResult.data ?? []) as RecommendationRow[];
  const userName = (userResult.data?.name as string | null | undefined) ?? null;
  const myValueType =
    (valueTypeResult.data?.main_value_type ?? null) as MainValueType | null;
  const followRows = (followsResult.data ?? []) as FollowRow[];
  const mutualFollowIds = computeMutualFollowIds(user.id, followRows);

  const friendValueProfilesResult = mutualFollowIds.length
    ? await supabase
        .from("user_public_value_profiles")
        .select("user_id, main_value_type")
        .in("user_id", mutualFollowIds)
    : { data: [], error: null };

  if (friendValueProfilesResult.error) {
    throw new Error(
      `HomePage: failed to load friend value types: ${friendValueProfilesResult.error.message}`,
    );
  }

  const sameTypeFriendIds = myValueType
    ? ((friendValueProfilesResult.data ?? []) as FriendValueProfileRow[])
        .filter((profile) => profile.main_value_type === myValueType)
        .map((profile) => profile.user_id)
    : [];

  const friendReviewsResult = sameTypeFriendIds.length
    ? await supabase
        .from("reviews")
        .select("restaurant_id, rating, user_id")
        .in("user_id", sameTypeFriendIds)
    : { data: [], error: null };

  if (friendReviewsResult.error) {
    throw new Error(
      `HomePage: failed to load friend reviews: ${friendReviewsResult.error.message}`,
    );
  }

  const ownReviewedRestaurantIds = new Set(
    ((ownReviewsResult.data ?? []) as OwnReviewRow[]).map(
      (review) => review.restaurant_id,
    ),
  );
  const friendReviews = (friendReviewsResult.data ?? []) as ReviewRow[];
  const candidateRestaurantIds = [
    ...new Set(
      friendReviews
        .map((review) => review.restaurant_id)
        .filter((restaurantId) => !ownReviewedRestaurantIds.has(restaurantId)),
    ),
  ];

  const friendRestaurantsResult = candidateRestaurantIds.length
    ? await supabase
        .from("restaurants")
        .select("id, name, area, genre, created_at")
        .in("id", candidateRestaurantIds)
    : { data: [], error: null };

  if (friendRestaurantsResult.error) {
    throw new Error(
      `HomePage: failed to load friend restaurants: ${friendRestaurantsResult.error.message}`,
    );
  }

  const candidateRestaurantIdSet = new Set(candidateRestaurantIds);
  const candidateFriendReviews = friendReviews.filter((review) =>
    candidateRestaurantIdSet.has(review.restaurant_id),
  );
  const sameTypeFriendRecommendations = sortRestaurants(
    (friendRestaurantsResult.data ?? []) as RestaurantRow[],
    candidateFriendReviews,
    new Set(sameTypeFriendIds),
  ).slice(0, 10);

  const topRestaurants = recommendationRows.map((row) => ({
    restaurant: {
      id: row.restaurant_id,
      name: row.name,
      area: row.area,
      genre: row.genre,
      // A5の戻り値にはcreated_atがなく、compactカードでも参照しない。
      created_at: "",
    } satisfies RestaurantRow,
    dist: distributionFromRecommendationRow(row),
  }));
  const countLabel = myValueType ? VALUE_TYPE_LABEL[myValueType] : "全員";
  const friendCountLabel = myValueType
    ? `${VALUE_TYPE_LABEL[myValueType]}の友人`
    : "友人";

  // おすすめ代表画像: 並び順は変えず、各店舗の最新レビュー写真だけをカードへ渡す
  const recommendationRestaurantIds = [
    ...new Set([
      ...topRestaurants.map(({ restaurant }) => restaurant.id),
      ...sameTypeFriendRecommendations.map(
        ({ restaurant }) => restaurant.id,
      ),
    ]),
  ];
  const imageReviewsResult = recommendationRestaurantIds.length
    ? await supabase
        .from("reviews")
        .select("restaurant_id, image_path, visit_date, created_at")
        .in("restaurant_id", recommendationRestaurantIds)
        .not("image_path", "is", null)
    : { data: [], error: null };

  if (imageReviewsResult.error) {
    console.error(
      "HomePage: failed to load recommendation images",
      imageReviewsResult.error,
    );
  }

  const imageReviews =
    (imageReviewsResult.data ?? []) as HomeImageReviewRow[];
  const latestImagePathByRestaurant = new Map<string, string>();
  imageReviews
    .sort((a, b) => {
      const aDate = a.visit_date ?? a.created_at;
      const bDate = b.visit_date ?? b.created_at;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    })
    .forEach((review) => {
      if (
        !latestImagePathByRestaurant.has(review.restaurant_id) &&
        review.image_path
      ) {
        latestImagePathByRestaurant.set(review.restaurant_id, review.image_path);
      }
    });

  const imagePaths = [...new Set(latestImagePathByRestaurant.values())];
  const signedImagesResult = imagePaths.length
    ? await supabase.storage
        .from("review-images")
        .createSignedUrls(imagePaths, 60 * 60)
    : { data: [], error: null };

  if (signedImagesResult.error) {
    console.error("HomePage: failed to sign review images", signedImagesResult.error);
  }

  const signedImageUrls = new Map<string, string | null>();
  for (const signedImage of signedImagesResult.data ?? []) {
    if (signedImage.error) {
      console.error("HomePage: failed to sign review image", {
        path: signedImage.path,
        message: signedImage.error,
      });
    }
    if (signedImage.path) {
      signedImageUrls.set(signedImage.path, signedImage.signedUrl);
    }
  }
  const imageUrlByRestaurant = new Map(
    [...latestImagePathByRestaurant.entries()].map(([restaurantId, imagePath]) => [
      restaurantId,
      signedImageUrls.get(imagePath) ?? null,
    ]),
  );

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* 挨拶 */}
      <div className="px-6 pb-5 pt-10">
        <p className="mb-1 text-2xl font-bold text-ink">
          {userName ? `こんにちは、${userName}さん` : "こんにちは"}
          <span className="ml-1.5" aria-hidden="true">
            👋
          </span>
        </p>
        <p className="text-base text-ink-sub">今日は何が食べたい?</p>
      </div>

      {/* 検索バー */}
      <div className="mb-6 px-6">
        <div className="flex min-h-[44px] items-center gap-3 rounded-full border border-edge bg-surface px-5 shadow-sm transition-all duration-150 hover:shadow-md motion-safe:active:scale-[0.99]">
          <span className="text-base" aria-hidden="true">
            🔍
          </span>
          <span className="text-sm text-ink-sub">店舗を探す・追加する</span>
        </div>
        <div className="mt-2 text-right">
          <Link
            href="/restaurants"
            className="inline-flex min-h-[44px] items-center text-sm font-medium text-terra transition-colors hover:text-terra-deep"
          >
            店舗一覧を見る →
          </Link>
        </div>
      </div>

      {/* クイックカテゴリ */}
      <section className="mb-8">
        <div className="mb-3 px-6">
          <h2 className="text-base font-semibold text-ink">カテゴリ</h2>
        </div>
        <CategoryChips />
      </section>

      {/* おすすめ */}
      {topRestaurants.length > 0 && (
        <section className="mb-8 px-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">おすすめ</h2>
            <Link
              href="/restaurants"
              className="text-sm text-terra transition-colors duration-150 hover:text-terra-deep"
            >
              全て見る →
            </Link>
          </div>

          {myValueType && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-sub">あなたのタイプ：</span>
              <ValueTypeBadge type={myValueType} />
            </div>
          )}

          {/* -mx-6 で親 px-6 をキャンセルし画面端まで広げる */}
          <div className="-mx-6 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-4 pl-6 pr-4 pb-3">
              {topRestaurants.map(({ restaurant, dist }) => (
                <div
                  key={restaurant.id}
                  className="w-[280px] shrink-0 snap-start"
                >
                  <RestaurantCard
                    restaurant={restaurant}
                    dist={dist}
                    countLabel={countLabel}
                    imageUrl={
                      imageUrlByRestaurant.get(restaurant.id) ?? undefined
                    }
                    variant="compact"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* おすすめ②（友人の「また行きたい」） */}
      {sameTypeFriendRecommendations.length > 0 && (
        <section className="px-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-ink">
              おすすめ②（友人の「また行きたい」）
            </h2>
          </div>

          {/* -mx-6 で親 px-6 をキャンセルし画面端まで広げる */}
          <div className="-mx-6 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-4 pl-6 pr-4 pb-3">
              {sameTypeFriendRecommendations.map(({ restaurant, dist }) => (
                <div
                  key={restaurant.id}
                  className="w-[280px] shrink-0 snap-start"
                >
                  <RestaurantCard
                    restaurant={restaurant}
                    dist={dist}
                    countLabel={friendCountLabel}
                    imageUrl={
                      imageUrlByRestaurant.get(restaurant.id) ?? undefined
                    }
                    variant="compact"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <BottomNav />
    </main>
  );
}
