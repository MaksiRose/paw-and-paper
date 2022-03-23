module.exports = {
	name: 'shardReady',
	once: false,
	async execute(client) {

		client.destroy();
		process.exit();
	},
};