export type BadgeStatus =
  | "open"
  | "registered"
  | "already_registered"
  | "unassigned"
  | "not_found"
  | "error";

export type DeskCounts = {
  delegates_registered: number;
  delegates_total: number;
  chairs_registered: number;
  chairs_total: number;
};

export type BadgeLookup = DeskCounts & {
  ok: boolean;
  status: BadgeStatus;
  name: string | null;
  committee: string | null;
  allocation: string | null;
  role: "delegate" | "chair" | null;
  registered_at: string | null;
};

export type RosterBadge = {
  short_id: string;
  placard_code: string;
  role: "delegate" | "chair";
  full_name: string | null;
  committee: string;
  allocation: string;
  sort_order: number;
};

export type RegistrationCheckin = {
  short_id: string;
  placard_code: string;
  role: "delegate" | "chair";
  full_name: string | null;
  committee: string;
  allocation: string;
  registered_at: string;
};
