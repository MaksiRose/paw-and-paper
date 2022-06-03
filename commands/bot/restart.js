// @ts-check

module.exports.name = 'restart';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message) => {

	if (message.author.id !== client.application.owner.id) {

		return;
	}

	try {

		await message
			.reply({
				content: 'Restarted!',
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		client.destroy();
		process.exit();
	}
	catch (error) {
		console.error(error);
		message.channel
			.send({ content: `ERROR: ${error.message}` })
			.catch((newError) => { throw new Error(newError); });
	}
};