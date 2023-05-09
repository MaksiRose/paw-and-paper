import cluster from 'node:cluster';
import process from 'node:process';

if (cluster.isPrimary) {

	console.log(`Primary cluster ${process.pid} is running`);
	cluster.fork();

	cluster.on('message', (worker, message) => {

		if (typeof message === 'string' && message === 'restart') {

			const newWorker = cluster.fork();
			newWorker.once('message', (newMessage) => {

				if (typeof newMessage === 'string' && newMessage === 'ready') { worker.send('ready'); }
				else { worker.send('failed'); }
			});
		}
	});

	cluster.on('exit', (worker) => {
		console.log(`Worker cluster ${worker.process.pid} died`);
	});

	cluster.on('disconnect', (worker) => {
		console.log(`Worker cluster ${worker.process.pid} disconnected`);
	});
}
else {

	console.log(`Worker cluster ${process.pid} started`);
	require('./cluster');
}