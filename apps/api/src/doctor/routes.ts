import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { authenticate, requireRoles } from '../auth/middleware.js';
import type { AuthService } from '../auth/service.js';
import { AuthError, parseInput } from '../auth/validation.js';
import { objectId, pagination } from '../catalogue/validation.js';
import { Doctor, Patient, Hospital } from '../domain/index.js';
import { User } from '../auth/models.js';

const search = pagination.extend({ q: z.string().trim().min(2).max(100) });
const patientProjection = {
  _id: 1,
  patientCode: 1,
  dateOfBirth: 1,
  displayName: '$account.displayName',
};
export function doctorRouter(service: AuthService) {
  const router = Router();
  router.use(authenticate(service), requireRoles('DOCTOR'));
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.get('/profile', async (req, res) => {
    const doctor = await Doctor.findOne({ userId: req.auth!.user.id }).select(
      'professionalRegistrationNumber specialty verificationStatus hospitalId',
    );
    if (!doctor)
      throw new AuthError(
        404,
        'Doctor profile has not been set up. Contact your administrator.',
      );
    const hospital = await Hospital.findById(doctor.hospitalId).select(
      'name verificationStatus',
    );
    res.json({
      ...doctor.toObject(),
      hospital,
      canIssue:
        doctor.verificationStatus === 'VERIFIED' &&
        !!hospital &&
        !['SUSPENDED', 'REJECTED'].includes(hospital.verificationStatus),
    });
  });
  router.use(async (req, _res, next) => {
    if (
      !(await Doctor.exists({
        userId: req.auth!.user.id,
        verificationStatus: 'VERIFIED',
      }))
    )
      throw new AuthError(
        403,
        'A verified doctor profile is required to search patients.',
      );
    next();
  });
  const join = [
    {
      $lookup: {
        from: User.collection.name,
        localField: 'userId',
        foreignField: '_id',
        as: 'account',
      },
    },
    { $unwind: '$account' },
    { $match: { 'account.role': 'PATIENT', 'account.active': true } },
  ];
  router.get('/patients', async (req, res) => {
    const { q, page, limit } = parseInput(search, req.query);
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const [result] = await Patient.aggregate([
      ...join,
      {
        $match: {
          $or: [{ patientCode: regex }, { 'account.displayName': regex }],
        },
      },
      { $sort: { patientCode: 1, _id: 1 } },
      {
        $facet: {
          items: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            { $project: patientProjection },
          ],
          count: [{ $count: 'total' }],
        },
      },
    ]).option({ maxTimeMS: 5000 });
    res.json({
      items: result.items,
      total: result.count[0]?.total ?? 0,
      page,
      limit,
    });
  });
  router.get('/patients/:id', async (req, res) => {
    const id = parseInput(objectId, req.params.id);
    const [patient] = await Patient.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      ...join,
      { $project: patientProjection },
    ]);
    if (!patient) throw new AuthError(404, 'Patient profile not found.');
    res.json(patient);
  });
  return router;
}
