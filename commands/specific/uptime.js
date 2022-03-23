module.exports = {
	name: 'uptime',
	async sendMessage(client, message) {

		await message
			.reply({
				content: `Uptime: ${Math.floor(client.uptime / 3600000)} hours ${Math.floor(client.uptime / 60000) % 60} minutes\nPing: ${client.ws.ping} ms`,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});
	},
};