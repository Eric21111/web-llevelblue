import express from 'express';
import { fail, handler } from '../services/access.js';
import { developerSnapshot, overviewReport, studentDirectory, assessmentReport, analyticsReport, bktReport, monitoringReport, exportCsv } from '../services/developerAnalytics.js';

export function createDeveloperRoutes(db) {
  const router = express.Router();
  const load = req => developerSnapshot(db, req.query);
  router.get('/overview', handler(async (req, res) => res.json(overviewReport(await load(req)))));
  router.get('/students', handler(async (req, res) => res.json(studentDirectory(await load(req)))));
  router.get('/students/:id/assessments', handler(async (req, res) => {
    const report = assessmentReport(await load(req), req.params.id);
    if (!report) throw fail(404, 'Student not available.');
    res.json(report);
  }));
  router.get('/analytics', handler(async (req, res) => res.json(analyticsReport(await load(req)))));
  router.get('/bkt', handler(async (req, res) => res.json(bktReport(await load(req)))));
  router.get('/monitoring', handler(async (req, res) => res.json(monitoringReport(await load(req)))));
  router.get('/export', handler(async (req, res) => {
    const csv = exportCsv(await load(req));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="levelblue-developer-export.csv"');
    res.send(csv);
  }));
  return router;
}
