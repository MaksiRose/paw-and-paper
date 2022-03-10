module.exports = {
	activeCommandsObject: {},
	createCommandCollector(userId, guildId, botReply) {

		module.exports.activeCommandsObject['nr' + userId + guildId] = async () => {

			await botReply
				.edit({
					components: [],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			delete module.exports.activeCommandsObject['nr' + userId + guildId];
		};
	},
};