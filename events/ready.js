module.exports = {
	name: 'ready',
	once: true,
	execute(client) {
		console.log('Paw and Paper is online!');
		client.user.setActivity('this awesome RPG :)\nrp help', { type: 'PLAYING' });
	},
};