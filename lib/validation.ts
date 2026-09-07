import { z } from 'zod';

export const registrationSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(7).max(30),
  email: z.string().trim().email().max(160),
  eventType: z.string().trim().min(2).max(80),
  plannedEventDate: z.string().trim().optional().or(z.literal('')),
  guestCount: z.coerce.number().int().min(1).max(1000).optional(),
  companions: z.coerce.number().int().min(0).max(10).default(0),
  slotId: z.string().uuid(),
  source: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
  privacyConsent: z.literal(true),
  marketingConsent: z.boolean().default(false),
  utmSource: z.string().trim().max(100).optional(),
  utmMedium: z.string().trim().max(100).optional(),
  utmCampaign: z.string().trim().max(120).optional(),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
