import { z } from "zod";

export const airShipmentSchema = z.object({
  customer: z.string().trim().min(1, "Enter customer name."),
  origin: z.string().trim().min(1, "Enter origin airport."),
  destination: z.string().trim().min(1, "Enter destination airport."),
  currency: z.string().min(1),
  incoterm: z.string().min(1),
  commodity: z.string().trim().min(1, "Enter commodity."),
  module: z.enum(["export", "import"]),
});

export type AirShipmentForm = z.infer<typeof airShipmentSchema>;

export const seaShipmentSchema = z.object({
  customer: z.string().trim().min(1, "Enter customer name."),
  origin: z.string().trim().min(1, "Enter port of loading."),
  destination: z.string().trim().min(1, "Enter port of discharge."),
  currency: z.string().min(1),
  incoterm: z.string().min(1),
  module: z.enum(["export", "import"]),
  mode: z.enum(["fcl", "lcl", "bb"]),
});

export type SeaShipmentForm = z.infer<typeof seaShipmentSchema>;
