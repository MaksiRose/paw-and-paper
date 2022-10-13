const { token, bfd_token, bfd_authorization, top_token, top_authorization, dbl_token, dbl_authorization } = require('../config.json');
import { start } from './paw';

process.on('unhandledRejection', async (err) => {
	console.error('Unhandled Promise Rejection:\n', err);
});
process.on('uncaughtException', async (err) => {
	console.error('Uncaught Promise Exception:\n', err);
});
process.on('uncaughtExceptionMonitor', async (err) => {
	console.error('Uncaught Promise Exception (Monitor):\n', err);
});

start(token, bfd_token, bfd_authorization, top_token, top_authorization, dbl_token, dbl_authorization);