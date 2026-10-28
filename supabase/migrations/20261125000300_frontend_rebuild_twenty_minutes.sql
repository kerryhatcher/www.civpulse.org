-- Reschedule the existing named job in place; retain its identity and history.
-- The historical job name remains stable for operations and monitoring.
select cron.schedule('frontend-rebuild-hourly', '*/20 * * * *',
  'select frontend_private.invoke_rebuild();');
