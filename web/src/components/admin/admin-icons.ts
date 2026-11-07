import { Activity, AlertTriangle, CalendarDays, Database, Eye, History, KeyRound, Mail, MapPin, MessageCircle, Repeat, Sparkles, Timer, UserPlus, Users, Wallet, type LucideIcon } from "lucide-react";
import type { AdminIcon } from "@/lib/admin/sections";

/** One small picture per kind of section, drawn the same way everywhere in the Admin console. */
export const ADMIN_ICONS: Record<AdminIcon, LucideIcon> = {
  users: Users,
  userplus: UserPlus,
  key: KeyRound,
  pin: MapPin,
  wallet: Wallet,
  repeat: Repeat,
  timer: Timer,
  calendar: CalendarDays,
  spark: Sparkles,
  chat: MessageCircle,
  eye: Eye,
  alert: AlertTriangle,
  history: History,
  activity: Activity,
  mail: Mail,
  database: Database,
};
