// @ts-check
const { User } = require('discord.js');

module.exports.name = 'restart';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message) => {

	if (!client.isReady()) { return; }
	await client.application.fetch();

	if ((client.application.owner instanceof User) ? message.author.id !== client.application.owner.id : client.application.owner ? !client.application.owner.members.has(message.author.id) : false) {

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