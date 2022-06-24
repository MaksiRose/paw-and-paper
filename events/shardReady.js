// @ts-check

/**
 * @type {import('../typedef').Event}
 */
const event = {
	name: 'shardReady',
	once: false,

	/**
	 * Emitted when the client becomes ready to start working.
	 * @param {import('../paw').client} client
	 */
	async execute(client) {

		client.user?.setActivity('this awesome RPG :)\nrp help', { type: 'PLAYING' });
	},
};
module.exports = event;