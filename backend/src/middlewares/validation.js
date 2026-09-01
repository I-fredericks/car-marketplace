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
  role: z.enum(['BUYER', 'SELLER']).optional()
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
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
  features: z.array(z.string()).optional(),
  images: z.array(z.object({
    data: z.string().min(1, 'Image data is required'),
    isPrimary: z.boolean().optional()
  })).optional(),
  documents: z.array(z.object({
    data: z.string().min(1, 'Document data is required'),
    documentType: z.string().optional()
  })).optional()
});

const updateVehicleSchema = vehicleSchema.partial().extend({
  status: z.enum(['PENDING', 'AVAILABLE', 'REJECTED', 'SOLD']).optional()
});

const updateListingStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'REJECTED'])
});

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  upgradeToSellerSchema,
  vehicleSchema,
  updateVehicleSchema,
  updateListingStatusSchema
};
