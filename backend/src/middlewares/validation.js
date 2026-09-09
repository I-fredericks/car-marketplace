const { z } = require('zod');

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const message = result.error?.errors?.[0]?.message || 'Validation error';
    return res.status(400).json({ message });
  }
  req.body = result.data;
  next();
};

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  role: z.enum(['BUYER', 'SELLER']).optional(),
  sellerType: z.enum(['PRIVATE', 'DEALER', 'COMPANY']).optional()
});

const emailOnlySchema = z.object({
  email: z.string().email('Invalid email address')
});

const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Reset token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters')
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

const adminLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

const adminVerifySchema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().regex(/^\d{6}$/, 'The security code must be 6 digits')
});

const upgradeToSellerSchema = z.object({
  whatsapp: z.string().optional(),
  location: z.string().optional(),
  sellerType: z.enum(['PRIVATE', 'DEALER', 'COMPANY']).optional()
});

const vehicleSchema = z.object({
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  year: z.coerce.number().int().min(1900).max(new Date().getFullYear() + 1),
  price: z.coerce.number().positive('Price must be positive'),
  location: z.string().min(1, 'Location is required'),
  condition: z.enum(['BRAND_NEW', 'FOREIGN_USED', 'LOCALLY_USED']).optional(),
  mileage: z.coerce.number().int().nonnegative().optional(),
  transmission: z.enum(['AUTOMATIC', 'MANUAL']).optional(),
  fuelType: z.enum(['PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC']).optional(),
  engineSize: z.string().optional(),
  driveType: z.string().optional(),
  bodyType: z.string().optional(),
  color: z.string().optional(),
  doors: z.coerce.number().int().positive().optional(),
  seats: z.coerce.number().int().positive().optional(),
  description: z.string().optional(),
  // Structured condition facts — buyers filter on these, so they must be
  // real booleans, and the issue disclosure is bounded free text.
  noKnownFaults: z.boolean().optional(),
  firstOwner: z.boolean().optional(),
  registered: z.boolean().optional(),
  exchangePossible: z.boolean().optional(),
  issueNote: z.string().max(1000, 'Issue note is too long').optional(),
  features: z.array(z.string()).optional(),
  images: z.array(z.object({
    data: z.string().min(1, 'Image data is required'),
    isPrimary: z.boolean().optional()
  })).max(15, 'Maximum 15 images per listing').optional()
    .refine(
      // Zod v4 runs refines for undefined optional fields too — guard first.
      (imgs) => !imgs || imgs.every((img) => {
        // Accept base64 raster images and uploaded/external URLs only — SVG
        // can carry scripts (stored XSS), so it is rejected at creation time.
        if (/^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(img.data)) return true;
        if (/^\/?uploads\//.test(img.data)) return true;
        if (/^https?:\/\//.test(img.data)) return true;
        return false;
      }),
      { message: 'Images must be JPEG, PNG, WebP or GIF' }
    )
    .refine(
      (imgs) => !imgs || imgs.every((img) => img.data.length <= 12_000_000),
      { message: 'Each image must be under ~9MB' }
    ),
  documents: z.array(z.object({
    data: z.string().min(1, 'Document data is required'),
    documentType: z.string().optional()
  })).max(5, 'Maximum 5 documents per listing').optional()
    .refine(
      // Zod v4 runs refines even for undefined optional fields, so guard
      // before reading — clients that omit documents crashed here.
      (docs) => !docs || docs.every((doc) => {
        if (/^data:(image\/(jpeg|jpg|png|webp)|application\/pdf);base64,/i.test(doc.data)) return true;
        if (/^\/?uploads\//.test(doc.data)) return true;
        return false;
      }),
      { message: 'Documents must be images or PDFs' }
    )
    .refine(
      (docs) => !docs || docs.every((doc) => doc.data.length <= 12_000_000),
      { message: 'Each document must be under ~9MB' }
    )
});

// Status is deliberately NOT client-settable here: edits by the owner go back
// to PENDING for re-approval (vehicleController), and admins change status via
// the dedicated /admin/vehicles/:id/status endpoint.
const updateVehicleSchema = vehicleSchema.partial();

const updateListingStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'REJECTED', 'DEACTIVATED'])
});

const updateUserStatusSchema = z.object({
  isActive: z.boolean({ message: 'isActive must be true or false' })
});

const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  location: z.string().optional(),
  sellerType: z.enum(['PRIVATE', 'DEALER', 'COMPANY']).optional(),
  // Seller payout rails (how the platform pays escrow releases)
  payoutMethod: z.enum(['MOMO_MTN', 'MOMO_TELECEL', 'MOMO_AIRTELTIGO', 'BANK']).optional(),
  payoutAccount: z.string().max(120).optional(),
  payoutName: z.string().max(120).optional()
});

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  adminLoginSchema,
  adminVerifySchema,
  upgradeToSellerSchema,
  emailOnlySchema,
  resetPasswordSchema,
  changePasswordSchema,
  vehicleSchema,
  updateVehicleSchema,
  updateListingStatusSchema,
  updateUserStatusSchema,
  updateProfileSchema
};
