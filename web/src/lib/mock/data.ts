import type { AirTariff, AuthUser, EnquiryRecord, SeaTariff } from '../types'

export const MOCK_USERS: Array<AuthUser & { password: string }> = [
  {
    id: 'u1',
    username: 'ganny',
    password: 'demo',
    displayName: 'Ganny (Admin)',
    role: 'ganny',
    email: 'ganny@atlas.demo',
  },
  {
    id: 'u2',
    username: 'manager',
    password: 'demo',
    displayName: 'Manager',
    role: 'manager',
    email: 'manager@atlas.demo',
  },
  {
    id: 'u3',
    username: 'pricing',
    password: 'demo',
    displayName: 'Pricing Agent',
    role: 'pricing',
    email: 'pricing@atlas.demo',
  },
]

export const MOCK_ENQUIRIES: EnquiryRecord[] = [
  {
    id: 'e1',
    ref: 'AE-ACU-0926-00041',
    customer: 'Zenith Electronics Ltd',
    mode: 'air',
    origin: 'BLR',
    destination: 'LHR',
    status: 'open',
    slaHoursOpen: 2,
    assignee: 'Pricing Team',
    creator: 'ganny',
    createdAt: '2026-09-01T09:15:00Z',
    grandTotal: 4280,
    currency: 'USD',
    amountINR: 356_000,
    grossProfit: 640,
    buyTotal: 3640,
    appliedRate: 4.2,
    appliedBuyRate: 3.55,
    carrier: 'QR - Qatar Airways',
    billingWeight: 1020,
    billingUnit: 'kg',
  },
  {
    id: 'e2',
    ref: 'SE-ADI-0926-00018',
    customer: 'Adani Enterprises',
    mode: 'sea',
    origin: 'INNSA',
    destination: 'NLRTM',
    status: 'quoted',
    slaHoursOpen: 6,
    assignee: 'Sea Nomination',
    creator: 'shaheer',
    createdAt: '2026-09-01T07:40:00Z',
    grandTotal: 3150,
    currency: 'USD',
    amountINR: 262_000,
    grossProfit: 420,
    buyTotal: 2730,
    appliedRate: 45,
    appliedBuyRate: 40,
    carrier: 'Maersk',
    billingWeight: 28,
    billingUnit: 'rt',
  },
  {
    id: 'e3',
    ref: 'CR-FED-0826-00009',
    customer: 'PharmaCare Global',
    mode: 'courier',
    origin: 'BOM',
    destination: 'FRA',
    status: 'won',
    slaHoursOpen: 0,
    assignee: 'Pricing Agent',
    creator: 'pricing',
    createdAt: '2026-08-31T14:20:00Z',
    grandTotal: 890,
    currency: 'USD',
    grossProfit: 120,
    buyTotal: 770,
    carrier: 'FedEx',
  },
  {
    id: 'e4',
    ref: 'SE-MAR-0831-00055',
    customer: 'Marine Components Pte',
    mode: 'sea',
    origin: 'SGPIN',
    destination: 'INMAA',
    status: 'open',
    slaHoursOpen: 9,
    assignee: 'Pricing Team',
    creator: 'ganny',
    createdAt: '2026-08-31T11:05:00Z',
  },
  {
    id: 'e5',
    ref: 'AE-QAT-0831-00033',
    customer: 'Gulf Trading Co',
    mode: 'air',
    origin: 'DOH',
    destination: 'DEL',
    status: 'lost',
    slaHoursOpen: 0,
    assignee: 'Air Nom',
    creator: 'shashank',
    createdAt: '2026-08-30T16:50:00Z',
    grandTotal: 1920,
    currency: 'USD',
    grossProfit: 210,
    buyTotal: 1710,
    appliedRate: 3.1,
    appliedBuyRate: 2.75,
    carrier: 'QR',
    billingWeight: 620,
    billingUnit: 'kg',
  },
]

export const MOCK_AIR_TARIFFS: AirTariff[] = [
  {
    id: 'at1',
    carrier: 'QR - Qatar Airways',
    carrierCode: 'QR',
    origin: 'BLR',
    destination: 'LHR',
    currency: 'USD',
    breaks: {
      min: { sell: 120, buy: 95 },
      plus45: { sell: 4.2, buy: 3.5 },
      plus100: { sell: 3.8, buy: 3.1 },
      plus300: { sell: 3.2, buy: 2.7 },
      plus500: { sell: 2.9, buy: 2.4 },
      plus1000: { sell: 2.5, buy: 2.1 },
    },
  },
  {
    id: 'at2',
    carrier: 'EK - Emirates',
    carrierCode: 'EK',
    origin: 'BLR',
    destination: 'DXB',
    currency: 'USD',
    breaks: {
      min: { sell: 95, buy: 78 },
      plus100: { sell: 2.9, buy: 2.4 },
      plus300: { sell: 2.4, buy: 2.0 },
    },
  },
]

export const MOCK_SEA_TARIFFS: SeaTariff[] = [
  {
    id: 'st1',
    carrier: 'Maersk Line',
    carrierCode: 'MAERSK',
    origin: 'INNSA',
    destination: 'NLRTM',
    mode: 'fcl',
    currency: 'USD',
    lclRate: { sell: 0, buy: 0 },
    fclRates: {
      "20'GP": { sell: 1850, buy: 1620 },
      "40'HC": { sell: 2950, buy: 2580 },
    },
  },
  {
    id: 'st2',
    carrier: 'ECU Worldwide',
    carrierCode: 'ECU',
    origin: 'INNSA',
    destination: 'NLRTM',
    mode: 'lcl',
    currency: 'USD',
    lclRate: { sell: 68, buy: 54 },
    fclRates: {},
  },
]

export const SAMPLE_AIR_ENQUIRY = `Hi team,

Please quote air export for Zenith Electronics Ltd.
POL BLR to POD LHR
Gross weight 420 kg
Dims: 120 x 80 x 90 cm x 4 pcs
Commodity: consumer electronics
Preferred carrier QR if possible.

Thanks,
Sarah`

export const SAMPLE_SEA_ENQUIRY = `Customer: Adani Enterprises
POL: Nhava Sheva (INNSA)
POD: Rotterdam (NLRTM)
Mode: FCL
2x40HC containers
Gross weight 18 MT
Commodity: industrial machinery

Please advise Maersk rates from Circulars.`
