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
process.on('multipleResolves', async (type, promise, reason) => {
	console.error('Multiple Resolves:\n', type, promise, reason);
});

start(token, bfd_token, bfd_authorization, top_token, top_authorization, dbl_token, dbl_authorization);