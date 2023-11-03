import cluster from 'node:cluster';
import process from 'node:process';

if (cluster.isPrimary) {

	console.log(`Primary cluster ${process.pid} is running`);
	cluster.fork();

	cluster.once('message', (worker, message: {cmd: string}) => {

		if (typeof message.cmd === 'string' && message.cmd === 'restart') {

			const newWorker = cluster.fork();
			newWorker.once('message', (newMessage: {cmd: string}) => {

				if (typeof newMessage.cmd === 'string' && newMessage.cmd === 'ready') { worker.send({ cmd: 'ready' }); }
				else { worker.send({ cmd: 'failed' }); }
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