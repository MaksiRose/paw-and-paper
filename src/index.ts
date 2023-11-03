import cluster from 'node:cluster';
import process from 'node:process';

if (cluster.isPrimary) {

	console.log(`Primary cluster ${process.pid} is running`);
	const currWorker = cluster.fork();
	let currentWorkerId = currWorker.id;
	let lastAliveWorkerId: number | undefined = undefined;

	cluster.on('message', (worker, message: { cmd: string; }) => {

		if (typeof message.cmd === 'string') {

			if (message.cmd === 'restart') {

				const newWorker = cluster.fork();
				currentWorkerId = newWorker.id;
				lastAliveWorkerId = worker.id;
			}

			const oldWorker = (cluster.workers && lastAliveWorkerId) ? cluster.workers[lastAliveWorkerId] : undefined;
			if (oldWorker && worker.id !== lastAliveWorkerId && worker.id === currentWorkerId) {
				if (message.cmd === 'ready') { oldWorker.send({ cmd: 'ready' }); }
				else {

					oldWorker.send({ cmd: 'failed' });
					worker.kill();
				}
			}
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