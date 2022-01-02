const config = require('../../config.json');

module.exports = {
	name: 'restart',
	async sendMessage(client, message) {

		if (message.author.id != '268402976844939266') {
			return;
		}

		try {

			await message.reply({
				content: 'Restarted!',
			});

			await process.exit()
				.then(() => {

					client.login(config.token);
				});

		}
		catch (error) {
			message.channel.send({ content: `ERROR: ${error.message}` });
		}
	},
};