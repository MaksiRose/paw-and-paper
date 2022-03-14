const config = require('../../config.json');
const pjson = require('../../package.json');
const profileModel = require('../../models/profileModel');

module.exports = {
	name: 'release',
	async sendMessage(client, message, argumentsArray) {

		if (message.author.id != '268402976844939266') {

			return;
		}

		if (!argumentsArray) {

			return;
		}

		const allProfiles = [...new Set((await profileModel
			.find({}))
			.map(user => user.userId))];

		for (const userId of allProfiles) {

			const user = await client.users.fetch(userId);

			await user
				.createDM()
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			const oldMessages = await user.dmChannel.messages.fetch({ limit: 100 });

			for (const [, msg] of oldMessages) {

				if (msg.author.bot && msg.components.length > 0) {

					await msg
						.edit({ components: [] })
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
				}
			}

			await user
				.send({
					embeds: [{
						color: config.default_color,
						title: `**New release: ${pjson.version} 🎉🥳🎈🎊**`,
						description: argumentsArray.join(' '),
						footer: { text: 'You can change if you want updates for new releases by clicking the button below.' },
					}],
					components: [{
						type: 'ACTION_ROW',
						components: [{
							type: 'BUTTON',
							customId: 'updates-off',
							label: 'Turn updates off',
							style: 'SECONDARY',
						}],
					}],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		await message
			.reply({ content: 'Yaay! 🎉🥳🎈🎊' })
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});
	},
};