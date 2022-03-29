const config = require('../../config.json');
const pjson = require('../../package.json');
const profileModel = require('../../models/profileModel');
const fs = require('fs');

module.exports = {
	name: 'release',
	async sendMessage(client, message, argumentsArray) {

		if (message.author.id != '268402976844939266') {

			return;
		}

		if (!argumentsArray) {

			return;
		}

		const dataObject = JSON.parse(fs.readFileSync('./database/noUpdatesUserList.json'));

		const allProfiles = [...new Set((await profileModel
			.find({}))
			.map(user => user.userId))]
			.filter(userId => dataObject.usersArray.includes(userId) === false);

		for (const userId of allProfiles) {

			const user = await client.users.fetch(userId);

			await user
				.createDM()
				.catch((error) => {
					if (error.httpStatus !== 404 && error.httpStatus !== 403) {
						throw new Error(error);
					}
				});

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
				.then(async newMessage => {

					const oldMessages = await user.dmChannel.messages.fetch({ limit: 100, before: newMessage.id });

					for (const [, msg] of oldMessages) {

						if (msg.author.bot && msg.components.length > 0 && msg.components[0].components[0].customId.includes('updates')) {

							await msg
								.edit({ components: [] })
								.catch((error) => {
									if (error.httpStatus !== 404 && error.httpStatus !== 403) {
										throw new Error(error);
									}
								});
						}
					}

					console.log(`\x1b[32mNew release message\x1b[0m successfully sent to \x1b[33m${user.tag} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
				})
				.catch((error) => {
					if (error.httpStatus !== 404 && error.httpStatus !== 403) {
						throw new Error(error);
					}
					console.log(`\x1b[32mNew release message\x1b[0m could not be sent to \x1b[33m${user.tag} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
				});
		}

		await message
			.reply({
				content: 'Yaay! 🎉🥳🎈🎊',
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});
	},
};