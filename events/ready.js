const serverModel = require('../models/serverModel');
const profileModel = require('../models/profileModel');
const config = require('../config.json');

module.exports = {
	name: 'ready',
	once: true,
	async execute(client) {

		console.log('Paw and Paper is online!');
		client.user.setActivity('this awesome RPG :)\nrp help', { type: 'PLAYING' });

		// eslint-disable-next-line no-unused-vars
		for (const [guild_key, guild] of client.guilds.cache) {

			const serverData = await serverModel.findOne({
				serverId: guild.id,
			});

			if (!serverData) {

				return;
			}

			// eslint-disable-next-line no-unused-vars
			for (const [account_id, account] of Object.entries(serverData.accountsToDelete)) {

				setTimeout(async () => {

					await profileModel.findOneAndDelete({
						userId: account.userId,
						serverId: guild.id,
					});

					await serverData.accountsToDelete.delete(account_id);
					await serverData.save();

					const user = await client.users.fetch(account.userId);
					const botReply = await user.dmChannel.messages.fetch(account.privateMessageId);

					return await botReply
						.edit({
							embeds: [{
								color: config.default_color,
								author: { name: `${guild.name}`, icon_url: guild.iconURL() },
								title: 'Your account was deleted permanently!',
								description: '',
							}],
							components: [],
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
				}, new Date().getTime() - account.deletionTimestamp);
			}
		}
	},
};