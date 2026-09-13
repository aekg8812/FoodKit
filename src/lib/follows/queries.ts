export type FollowRow = {
  follower_id: string
  followee_id: string
}

export function computeMutualFollowIds(
  viewerId: string,
  followRows: FollowRow[],
): string[] {
  const incomingIds = new Set(
    followRows
      .filter((row) => row.followee_id === viewerId)
      .map((row) => row.follower_id),
  )
  const outgoingIds = new Set(
    followRows
      .filter((row) => row.follower_id === viewerId)
      .map((row) => row.followee_id),
  )
  const relatedIds = [
    ...new Set(
      followRows.map((row) =>
        row.follower_id === viewerId ? row.followee_id : row.follower_id,
      ),
    ),
  ]

  return relatedIds.filter(
    (id) => incomingIds.has(id) && outgoingIds.has(id),
  )
}
