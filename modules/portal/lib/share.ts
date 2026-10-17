export function whatsappShareUrl(url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(url)}`;
}

export type LinkState = "none" | "active" | "disabled";

export function linkState(link: { active: boolean } | null): LinkState {
  return !link ? "none" : link.active ? "active" : "disabled";
}
