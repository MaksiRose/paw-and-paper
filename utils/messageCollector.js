const config = require('../config.json');

module.exports = async (message, botReply) => {

	if (!botReply) {

		return;
	}

	const filter = m => m.author.id === message.author.id && m.content.toLowerCase().startsWith(config.prefix);

	const collector = message.channel.createMessageCollector({ filter, max: 1, time: 120000 });
	collector.on('end', async () => {

		await botReply
			.edit({
				components: [],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		return;
	});
};