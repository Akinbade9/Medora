import { Router } from 'express';
import mongoose from 'mongoose';
import type { AuthService } from '../auth/service.js';
import { authenticate, requireRoles } from '../auth/middleware.js';
import { AuthError, parseInput } from '../auth/validation.js';
import { objectId, pagination } from '../catalogue/validation.js';
import { cancelInput, issueInput } from './validation.js';
import { isPrescriptionActive } from './model.js';
import {
  doctorProfile,
  patientProfile,
  issuePrescription,
  listPrescriptions,
  readOrTransition,
} from './service.js';

export function prescriptionRouter(service: AuthService) {
  const router = Router();
  router.use(['/doctor', '/patient'], authenticate(service));
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use('/doctor', requireRoles('DOCTOR'));
  router.use('/patient', requireRoles('PATIENT'));
  router.post('/doctor/prescriptions', async (req, res) => {
    const result = await issuePrescription(
      req.auth!.user.id,
      parseInput(issueInput, req.body),
    );
    res
      .status(201)
      .json({ ...result.toObject(), isActive: isPrescriptionActive(result) });
  });
  router.get('/doctor/prescriptions', async (req, res) => {
    const profile = await doctorProfile(req.auth!.user.id);
    const { page, limit } = parseInput(pagination, req.query);
    res.json(await listPrescriptions({ doctorId: profile._id }, page, limit));
  });
  router.get('/doctor/prescriptions/:id', async (req, res) => {
    const id = parseInput(objectId, req.params.id);
    const profile = await doctorProfile(req.auth!.user.id);
    res.json(await readOrTransition(id, { doctorId: profile._id }, 'read'));
  });
  router.post('/doctor/prescriptions/:id/cancel', async (req, res) => {
    const id = parseInput(objectId, req.params.id);
    const { cancellationReason } = parseInput(cancelInput, req.body);
    const profile = await doctorProfile(req.auth!.user.id);
    res.json(
      await readOrTransition(
        id,
        { doctorId: profile._id },
        'cancel',
        cancellationReason,
      ),
    );
  });
  router.get('/patient/prescriptions', async (req, res) => {
    const profile = await patientProfile(req.auth!.user.id);
    const { page, limit } = parseInput(pagination, req.query);
    res.json(await listPrescriptions({ patientId: profile._id }, page, limit));
  });
  router.get('/patient/prescriptions/:id', async (req, res) => {
    const id = parseInput(objectId, req.params.id);
    const profile = await patientProfile(req.auth!.user.id);
    res.json(await readOrTransition(id, { patientId: profile._id }, 'view'));
  });
  router.use(((error, _req, _res, next) => {
    if (
      error instanceof mongoose.Error.ValidationError ||
      error instanceof mongoose.Error.CastError
    )
      return next(new AuthError(400, 'Invalid prescription data.'));
    next(error);
  }) satisfies import('express').ErrorRequestHandler);
  return router;
}
