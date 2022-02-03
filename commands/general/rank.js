const profileModel = require('../../models/profileModel');
const checkAccountCompletion = require('../../utils/checkAccountCompletion');
const checkValidity = require('../../utils/checkValidity');
const config = require('../../config.json');
const startCooldown = require('../../utils/startCooldown');

module.exports = {
	name: 'rank',
	aliases: ['role'],
	async sendMessage(client, message, argumentsArray, profileData) {

		if (await checkAccountCompletion.hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await checkValidity.hasCooldown(message, profileData, [module.exports.name].concat(module.exports.aliases))) {

			return;
		}

		profileData = await startCooldown(message, profileData);

		if (profileData.unlockedRanks == 1 && profileData.rank == 'Youngling') {

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { rank: 'Apprentice' } },
			);

			return await message
				.reply({
					embeds: [{
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `*An elderly smiles down at the young ${profileData.rank}.*\n"${profileData.name}, you have proven strength for the first time. I believe you are ready to explore the wild, and learn your strengths and weaknesses. Good luck in your rank as Apprentice" *they say. ${profileData.name}'s breast swells with pride.*`,
					}],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if (profileData.unlockedRanks == 2 && profileData.rank == 'Apprentice') {

			const botReply = await message
				.reply({
					embeds: [{
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						title: `What rank should ${profileData.name} have?`,
						footer: { text: 'Available options: \n\nHealer (recommended for herbivores)\nHunter (recommended for carnivores)' },
					}], components: [{
						type: 'ACTION_ROW',
						components: [{
							type: 'BUTTON',
							customId: 'rank-healer',
							label: 'Healer',
							emoji: { name: '🛡️' },
							style: 'SUCCESS',
						}, {
							type: 'BUTTON',
							customId: 'rank-hunter',
							label: 'Hunter',
							emoji: { name: '⚔️' },
							style: 'SUCCESS',
						}],
					}],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			client.on('messageCreate', async function removeRankComponents(newMessage) {

				if (!botReply || newMessage.author.id != message.author.id || !newMessage.content.toLowerCase().startsWith(config.prefix)) {

					return;
				}

				await botReply
					.edit({
						components: [],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				return client.off('messageCreate', removeRankComponents);
			});

			return await interactionCollector(botReply);
		}

		if (profileData.unlockedRanks == 3 && (profileData.rank == 'Hunter' || profileData.rank == 'Healer')) {

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { rank: 'Elderly' } },
			);

			return await message
				.reply({
					embeds: [{
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `"We are here to celebrate the nomination of ${profileData.name} to the highest rank, Elderly. The ${profileData.species} has shown incredible skills and persistence, and we congratulate ${profileData.pronounArray[1]} to their new title." *A mixture of howls, crows, meows, roars and squeaks are heard all around the hill, on which the Alpha stoof to announce this special event. It is not every day that a packmate gets the title of Elderly.*`,
					}],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		return await message
			.reply({
				embeds: [{
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*${profileData.name} looks at the Elderly with puppy eyes, trying to convince them.*\n"I'm sorry, little ${profileData.species}, you haven't proven yourself worthy of moving up a rank yet. Try again once you were able to put your strength, agility and decision-making to the test!" *the Elderly says.*`,
					footer: { text: 'Go playing (as Youngling) or exploring until you find a quest! Once you have completed the quest, you can move up a rank.' },
				}],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		async function interactionCollector(botReply) {

			const filter = async (i) => {

				if (!i.message.reference || !i.message.reference.messageId) {

					return false;
				}

				const userMessage = await i.channel.messages
					.fetch(i.message.reference.messageId)
					.catch((error) => {
						throw new Error(error);
					});

				return userMessage.id == message.id && i.isButton() && (i.customId == 'rank-healer' || i.customId == 'rank-hunter') && i.user.id == message.author.id;
			};

			const collector = message.channel.createMessageComponentCollector({ filter, max: 1, time: 30000 });
			collector.on('end', async (collected) => {

				if (!collected.size) {

					return await botReply
						.edit({
							components: [],
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
				}

				const interaction = collected.first();

				if (interaction.customId == 'rank-healer') {

					await profileModel.findOneAndUpdate(
						{ userId: message.author.id, serverId: message.guild.id },
						{ $set: { rank: 'Healer' } },
					);

					return await botReply
						.edit({
							embeds: [{
								color: profileData.color,
								author: { name: profileData.name, icon_url: profileData.avatarURL },
								description: `*${profileData.name} stands before one of the eldest, excited to hear their following words.* "Congratulations, ${profileData.name}, you are now a fully-fledged Healer. I am certain you will contribute greatly to the pack in this role."\n*The ${profileData.species} grins from ear to ear.*`,
							}],
							components: [],
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
				}

				if (interaction.customId == 'rank-hunter') {

					await profileModel.findOneAndUpdate(
						{ userId: message.author.id, serverId: message.guild.id },
						{ $set: { rank: 'Hunter' } },
					);

					return await botReply
						.edit({
							embeds: [{
								color: profileData.color,
								author: { name: profileData.name, icon_url: profileData.avatarURL },
								description: `*${profileData.name} stands before one of the eldest, excited to hear their following words.* "Congratulations, ${profileData.name}, you are now a fully-fledged Hunter. I am certain you will contribute greatly to the pack in this role."\n*The ${profileData.species} grins from ear to ear.*`,
							}],
							components: [],
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
				}

				return await interactionCollector();
			});
		}
	},
};