module.exports = {
	name: 'restart',
	async sendMessage(client, message) {

		if (message.author.id != '268402976844939266') {
			return;
		}

		try {

			await message
				.reply({
					content: 'Restarted!',
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			process.exit();
		}
		catch (error) {
			message.channel
				.send({ content: `ERROR: ${error.message}` })
				.catch((newError) => {
					throw new Error(newError);
				});
		}
	},
};