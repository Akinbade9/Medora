import { Router } from 'express';
import mongoose from 'mongoose';
import { authenticate, requireRoles } from '../auth/middleware.js';
import type { AuthService } from '../auth/service.js';
import { AuthError, parseInput } from '../auth/validation.js';
import { Medicine, MedicineProduct } from './models.js';
import {
  medicineInput,
  medicinePatch,
  objectId,
  pagination,
  productInput,
  productPatch,
  searchInput,
} from './validation.js';

const medicineFields =
  'genericName activeIngredient strength strengthUnit dosageForm category status createdAt updatedAt';
const productFields =
  'medicineId brandName manufacturer packSize productCode status createdAt updatedAt';
const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function catalogueRouter(service: AuthService) {
  const router = Router();
  router.use(authenticate(service));
  router.get('/', async (req, res) => {
    const { page, limit } = parseInput(pagination, req.query);
    const [items, total] = await Promise.all([
      Medicine.find()
        .select(medicineFields)
        .sort({ genericName: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Medicine.countDocuments(),
    ]);
    res.json({ items, page, limit, total });
  });
  router.get('/search', async (req, res) => {
    const { page, limit, q } = parseInput(searchInput, req.query);
    const regex = new RegExp(escapeRegex(q), 'i');
    const [result] = await Medicine.aggregate([
      {
        $lookup: {
          from: MedicineProduct.collection.name,
          let: { medicine: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$medicineId', '$$medicine'] },
                brandName: regex,
              },
            },
            { $limit: 1 },
            { $project: { _id: 1 } },
          ],
          as: 'brands',
        },
      },
      {
        $match: {
          $or: [
            { genericName: regex },
            { activeIngredient: regex },
            { 'brands.0': { $exists: true } },
          ],
        },
      },
      { $sort: { genericName: 1, _id: 1 } },
      {
        $facet: {
          items: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            { $project: { brands: 0, __v: 0 } },
          ],
          count: [{ $count: 'total' }],
        },
      },
    ]).option({ maxTimeMS: 5000 });
    res.json({
      items: result.items,
      page,
      limit,
      total: result.count[0]?.total ?? 0,
    });
  });
  router.get('/:id/products', async (req, res) => {
    const id = parseInput(objectId, req.params.id);
    const { page, limit } = parseInput(pagination, req.query);
    if (!(await Medicine.exists({ _id: id })))
      throw new AuthError(404, 'Medicine not found.');
    const [items, total] = await Promise.all([
      MedicineProduct.find({ medicineId: id })
        .select(productFields)
        .sort({ brandName: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      MedicineProduct.countDocuments({ medicineId: id }),
    ]);
    res.json({ items, page, limit, total });
  });
  router.get('/:id', async (req, res) => {
    const medicine = await Medicine.findById(
      parseInput(objectId, req.params.id),
    ).select(medicineFields);
    if (!medicine) throw new AuthError(404, 'Medicine not found.');
    res.json(medicine);
  });
  return router;
}

export function adminCatalogueRouter(service: AuthService) {
  const router = Router();
  router.use(authenticate(service), requireRoles('PLATFORM_ADMIN'));
  router.post('/medicines', async (req, res) => {
    const medicine = await Medicine.create(parseInput(medicineInput, req.body));
    res
      .status(201)
      .json(await Medicine.findById(medicine._id).select(medicineFields));
  });
  router.patch('/medicines/:id', async (req, res) => {
    const id = parseInput(objectId, req.params.id);
    const input = parseInput(medicinePatch, req.body);
    const medicine = await Medicine.findById(id);
    if (!medicine) throw new AuthError(404, 'Medicine not found.');
    medicine.set(input);
    await medicine.save();
    res.json(await Medicine.findById(id).select(medicineFields));
  });
  router.post('/medicine-products', async (req, res) => {
    const product = await MedicineProduct.create(
      parseInput(productInput, req.body),
    );
    res
      .status(201)
      .json(await MedicineProduct.findById(product._id).select(productFields));
  });
  router.patch('/medicine-products/:id', async (req, res) => {
    const id = parseInput(objectId, req.params.id);
    const input = parseInput(productPatch, req.body);
    const product = await MedicineProduct.findById(id);
    if (!product) throw new AuthError(404, 'Product not found.');
    product.set(input);
    await product.save();
    res.json(await MedicineProduct.findById(id).select(productFields));
  });
  router.use(((error, _req, _res, next) => {
    if (
      error instanceof mongoose.Error.ValidationError ||
      error instanceof mongoose.Error.CastError
    )
      return next(new AuthError(400, 'Invalid catalogue data.'));
    if (error instanceof mongoose.Error.VersionError)
      return next(new AuthError(409, 'Record changed. Reload and retry.'));
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 11000
    )
      return next(new AuthError(409, 'Catalogue entry already exists.'));
    next(error);
  }) satisfies import('express').ErrorRequestHandler);
  return router;
}
