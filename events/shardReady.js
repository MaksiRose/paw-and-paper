module.exports = {
	name: 'shardReady',
	once: false,
	async execute(client) {

		client.user.setActivity('this awesome RPG :)\nrp help', { type: 'PLAYING' });
	},
};