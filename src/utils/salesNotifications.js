export function pendingBySalesperson(claims) {
  const groups = new Map();
  for (const claim of claims) {
    if (claim.status !== "sales" || (claim.approval?.decision && claim.approval.decision !== "pending")) continue;
    const name = String(claim.salesperson || "").trim() || "Unassigned";
    const key = name.toLowerCase();
    const group = groups.get(key) || { key, name, count: 0 };
    group.count += 1;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function salesReviewUrl(href) {
  const url = new URL(href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("page", "sales");
  url.searchParams.set("view", "pending");
  return url.href;
}

export function salespersonMessage(group, href) {
  return `Hi ${group.name}, you have ${group.count} battery claim${group.count === 1 ? "" : "s"} awaiting your review in CellTrack.\nPlease review them here:\n${salesReviewUrl(href)}`;
}

