export function actorName(req, fallback = "User") {
  const user = req?.user || {};
  const assembled = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return assembled || user.name || user.email || fallback;
}
