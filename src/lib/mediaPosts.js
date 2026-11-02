// A guest can share several photos and videos in one go. They belong together
// as a single post with a swipeable carousel, not one post per file.
//
// New uploads carry a `batch_id` generated once per upload session. Rows from
// before that column existed (or from a project that has not migrated yet) are
// grouped by the next best signal: same guest, same caption and inserted within
// a couple of minutes of each other.
const LEGACY_BATCH_WINDOW_MS = 2 * 60 * 1000;

export function groupMediaIntoPosts(media) {
  const ordered = [...media].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const posts = [];
  const batches = new Map();

  for (const item of ordered) {
    if (item.batch_id) {
      let post = batches.get(item.batch_id);
      if (!post) {
        post = { key: item.batch_id, guestId: item.guest_id, caption: item.caption || null, items: [] };
        batches.set(item.batch_id, post);
        posts.push(post);
      }
      post.items.push(item);
      continue;
    }

    const last = posts[posts.length - 1];
    const lastItem = last?.items[last.items.length - 1];
    const gap = lastItem
      ? new Date(item.created_at).getTime() - new Date(lastItem.created_at).getTime()
      : Infinity;

    const continuesLegacyBatch =
      last?.legacy &&
      last.guestId === item.guest_id &&
      (last.caption || null) === (item.caption || null) &&
      gap <= LEGACY_BATCH_WINDOW_MS;

    if (continuesLegacyBatch) {
      last.items.push(item);
    } else {
      posts.push({
        key: `legacy-${item.id}`,
        legacy: true,
        guestId: item.guest_id,
        caption: item.caption || null,
        items: [item],
      });
    }
  }

  // Newest upload first, and newest item first inside each carousel.
  return posts.reverse().map((post) => ({ ...post, items: [...post.items].reverse() }));
}
