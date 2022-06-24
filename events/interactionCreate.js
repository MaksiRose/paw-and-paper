// @ts-check
const profileModel = require('../models/profileModel');
const config = require('../config.json');
const errorHandling = require('../utils/errorHandling');
const { execute, startRestingTimeout } = require('./messageCreate');
const { sendReminder, stopReminder } = require('../commands/maintenance/water');
const userMap = require('../utils/userMap');
const { getMessageContent } = require('../commands/maintenance/stats');
const { MessageEmbed, Message, MessageActionRow, MessageButton } = require('discord.js');
const serverModel = require('../models/serverModel');
const { sendHugMessage, sendNoHugMessage } = require('../commands/interaction/hug');
const { sendInteractionResponse } = require('../commands/bot/help');

/**
 * @type {import('../typedef').Event}
 */
const event = {
	name: 'interactionCreate',
	once: false,

	/**
	 * Emitted when an interaction is created.
	 * @param {import('../paw').client} client
	 * @param {(import('discord.js').Interaction)} interaction
	 */
	async execute(client, interaction) {

		if (!interaction.channel) { throw new Error('Interaction channel cannot be found.'); }

		let userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: interaction.user.id }));
		const serverData = /** @type {import('../typedef').ServerSchema} */ (await serverModel.findOne({ serverId: interaction.guild?.id }));

		if (interaction.isModalSubmit()) {

			if (interaction.customId.includes('displayedspecies')) {

				const userId = interaction.customId.split('-')[1];
				const characterId = interaction.customId.split('-')[2];
				const displayedSpecies = interaction.components[0].components[0].value;

				userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
					{ userId: userId },
					(/** @type {import('../typedef').ProfileSchema} */ p) => {
						p.characters[characterId].displayedSpecies = displayedSpecies;
					},
				));

				await interaction
					.reply({
						embeds: [new MessageEmbed({
							color: userData.characters[characterId].color,
							author: { name: userData.characters[characterId].name, icon_url: userData.characters[characterId].avatarURL },
							title: displayedSpecies === '' ? 'Successfully removed your displayed species!' : `Successfully changed displayed species to ${displayedSpecies}!`,
						})],
					});
				return;
			}

			if (interaction.customId.includes('edit')) {

				if (interaction.channel.type === 'DM') {

					await interaction
						.reply({
							content: 'Oops, I cannot edit proxied messages in DM\'s!',
							ephemeral: true,
						})
						.catch((error) => {
							if (error.httpStatus !== 404) { throw new Error(error); }
						});
					return;
				}

				await interaction
					.deferUpdate()
					.catch(async (error) => {
						if (error.httpStatus === 400) { return console.error('DiscordAPIError: Interaction has already been acknowledged.'); }
						if (error.httpStatus === 404) { return console.error('DiscordAPIError: Unknown interaction. (This probably means that there was server-side delay when receiving the interaction)'); }
					});

				const messageId = interaction.customId.split('-')[1];

				const webhookChannel = interaction.channel.isThread() ? interaction.channel.parent : interaction.channel;
				if (!webhookChannel) { throw new Error('Webhook can\'t be edited, interaction channel is thread and parent channel cannot be found'); }
				const webhook = (await webhookChannel
					.fetchWebhooks()
					.catch(async (error) => {
						if (error.httpStatus === 403) {
							await interaction.channel?.send({ content: 'Please give me permission to create webhooks 😣' }).catch((err) => { throw new Error(err); });
						}
						throw new Error(error);
					})
				).find(webhook => webhook.name === 'PnP Profile Webhook') || await webhookChannel
					.createWebhook('PnP Profile Webhook')
					.catch(async (error) => {
						if (error.httpStatus === 403) {
							await interaction.channel?.send({ content: 'Please give me permission to create webhooks 😣' }).catch((err) => { throw new Error(err); });
						}
						throw new Error(error);
					});

				await webhook
					.editMessage(messageId, {
						content: interaction.components[0].components[0].value,
						threadId: interaction.channel.isThread() ? interaction.channel.id : undefined,
					})
					.catch((error) => { throw new Error(error); });
				return;
			}
		}

		if (interaction.isCommand() || interaction.isMessageContextMenu()) {

			if (!interaction.inCachedGuild() && interaction.inGuild()) {

				await interaction
					.reply({
						content: 'Oops, I am missing the `bot` scope that is normally part of the invite link. Please re-invite the bot!',
						ephemeral: true,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
				return;
			}

			const command = client.commands[interaction.commandName];

			if (!command || !Object.hasOwn(command, 'sendCommand')) {

				return;
			}

			try {

				console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m successfully executed \x1b[31m${interaction.commandName} \x1b[0min \x1b[32m${interaction.inCachedGuild() ? interaction.guild.name : 'DM'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

				await command
					.sendCommand(client, interaction, userData, serverData, []);
			}
			catch (error) {

				await errorHandling.output(interaction.isCommand() ? interaction : interaction.targetMessage instanceof Message ? interaction.targetMessage : (await interaction.channel.messages.fetch(interaction.targetId)), error);
			}

			return;
		}

		if ((interaction.isButton() || interaction.isSelectMenu()) && !interaction.customId.includes('modal')) {

			if (!(interaction.message instanceof Message)) { return; }

			if (!interaction.inCachedGuild() && interaction.inGuild()) {

				await interaction
					.reply({
						content: 'Oops, I am missing the `bot` scope that is normally part of the invite link. Please re-invite the bot!',
						ephemeral: true,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
				return;
			}

			try {

				await interaction.deferUpdate();
			}
			catch (error) {

				if (error.httpStatus === 400) { return console.error('DiscordAPIError: Interaction has already been acknowledged.'); }
				if (error.httpStatus === 404) { return console.error('DiscordAPIError: Unknown interaction. (This probably means that there was server-side delay when receiving the interaction)'); }
				return await errorHandling.output(interaction.message, error);
			}

			// this is a DM interaction and doesn't have a referenced messages, so it gets processed before everything else
			if (interaction.isButton() && interaction.customId === 'ticket' && interaction.channel.type === 'DM') {

				const user = await client.users.fetch(interaction.user.id);
				if (!user.dmChannel) { throw new Error ('User\'s DM Channel could not be found.');}
				const message = await user.dmChannel.messages.fetch(interaction.message.id);

				return await message
					.delete()
					.catch(async (error) => {
						throw new Error(error);
					});
			}

			// report messages respond to the bot message that had the issue, so referenced messages don't work with it
			if (interaction.isButton() && interaction.customId === 'report' && interaction.inGuild()) {

				interaction.message
					.edit({
						components: [],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});

				const maksi = await client.users.fetch(config.maksi);
				return await maksi
					.send({
						content: `https://discord.com/channels/${interaction.guildId}/${interaction.message.channel.id}/${interaction.message.id}`,
						embeds: interaction.message.embeds,
						components: [{
							type: 'ACTION_ROW',
							components: [{
								type: 'BUTTON',
								customId: 'ticket',
								label: 'Resolve',
								style: 'SUCCESS',
							}],
						}],
					})
					.catch(async (error) => {
						throw new Error(error);
					});
			}

			if (!interaction.message.reference || !interaction.message.reference.messageId) {

				return;
			}

			let characterData = userData?.characters?.[userData?.currentCharacter?.[interaction.guildId || 'DM']];
			let profileData = characterData?.profiles?.[interaction.guildId || 'DM'];

			/** @type {null | import('discord.js').Message} */
			const referencedMessage = await interaction.channel.messages
				.fetch(interaction.message.reference.messageId)
				.catch(async () => { return null; });

			if (referencedMessage === null || referencedMessage.author.id !== interaction.user.id) {

				if ((referencedMessage === null || !referencedMessage.mentions.users.has(interaction.user.id)) && (interaction.isButton() || interaction.isSelectMenu())) {

					await interaction
						.followUp({
							content: 'Sorry, I only listen to the person that created the command 😣 (If your command-creation message was deleted, I won\'t recognize that you created the command)',
							ephemeral: true,
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
					return;
				}

				if (interaction.isButton() && referencedMessage !== null && interaction.customId === 'hug-accept' && interaction.user.id === referencedMessage.mentions.users.first()?.id) {

					sendHugMessage(interaction, userData, characterData, referencedMessage);
				}

				if (interaction.isButton() && referencedMessage !== null && interaction.customId === 'hug-decline' && interaction.user.id === referencedMessage.mentions.users.first()?.id) {

					sendNoHugMessage(interaction, characterData, referencedMessage);
				}

				return;
			}

			if (interaction.inGuild()) {

				if (!userMap.has('nr' + interaction.user.id + interaction.guildId)) {

					userMap.set('nr' + interaction.user.id + interaction.guildId, { activeCommands: 0, lastGentleWaterReminderTimestamp: 0, activityTimeout: null, cooldownTimeout: null, restingTimeout: null });
				}

				clearTimeout(userMap.get('nr' + interaction.user.id + interaction.guildId)?.restingTimeout || undefined);
			}

			if (interaction.isSelectMenu()) {

				console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m successfully selected \x1b[31m${interaction.values[0]} \x1b[0mfrom the menu \x1b[31m${interaction.customId} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);


				if (interaction.customId.includes('help')) { sendInteractionResponse(client, interaction); }
			}

			if (interaction.isButton()) {

				console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m successfully clicked the button \x1b[31m${interaction.customId} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);


				if (interaction.customId === 'water-reminder-off') {

					userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
						{ uuid: userData.uuid },
						(/** @type {import('../typedef').ProfileSchema} */ p) => {
							p.reminders.water = false;
						},
					));

					stopReminder(characterData._id, interaction.user.id, interaction.channel.id);

					await interaction
						.followUp({
							content: 'You turned reminders for watering off!',
							ephemeral: true,
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});

					return await interaction
						.editReply({
							components: [{
								type: 'ACTION_ROW',
								components: [{
									type: 'BUTTON',
									customId: 'water-reminder-on',
									label: 'Turn water reminders on',
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

				if (interaction.customId === 'water-reminder-on') {

					userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
						{ uuid: userData.uuid },
						(/** @type {import('../typedef').ProfileSchema} */ p) => {
							p.reminders.water = true;
						},
					));

					sendReminder(client, userData, characterData, profileData);

					await interaction
						.followUp({
							content: 'You turned reminders for watering on!',
							ephemeral: true,
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});

					return await interaction
						.editReply({
							components: [{
								type: 'ACTION_ROW',
								components: [{
									type: 'BUTTON',
									customId: 'water-reminder-off',
									label: 'Turn water reminders off',
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

				if (interaction.customId === 'resting-reminder-off') {

					userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
						{ uuid: userData.uuid },
						(/** @type {import('../typedef').ProfileSchema} */ p) => {
							p.reminders.resting = false;
						},
					));

					await interaction
						.followUp({
							content: 'You turned pings for automatic resting off!',
							ephemeral: true,
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});

					return await interaction
						.editReply({
							components: [{
								type: 'ACTION_ROW',
								components: [{
									type: 'BUTTON',
									customId: 'resting-reminder-on',
									label: 'Turn automatic resting pings on',
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

				if (interaction.customId === 'resting-reminder-on') {

					userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
						{ uuid: userData.uuid },
						(/** @type {import('../typedef').ProfileSchema} */ p) => {
							p.reminders.resting = true;
						},
					));

					sendReminder(client, userData, characterData, profileData);

					await interaction
						.followUp({
							content: 'You turned pings for automatic resting on!',
							ephemeral: true,
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});

					return await interaction
						.editReply({
							components: [{
								type: 'ACTION_ROW',
								components: [{
									type: 'BUTTON',
									customId: 'resting-reminder-off',
									label: 'Turn automatic resting pings off',
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

				if (interaction.customId === 'stats-refresh') {

					const mentionedUser = referencedMessage.mentions.users.first();
					if (mentionedUser) {

						userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: mentionedUser.id }));
						characterData = userData?.characters?.[userData?.currentCharacter?.[interaction.guildId || 'DM']];
						profileData = characterData?.profiles?.[interaction.guildId || 'DM'];
					}

					await interaction.message
						.edit({
							.../** @type {import('discord.js').MessageEditOptions} */ (getMessageContent(profileData, characterData.name, referencedMessage.mentions.users.size <= 0)),
						})
						.catch((error) => {
							if (error.httpStatus !== 404) { throw new Error(error); }
						});
				}

				if (interaction.customId === 'profile-refresh') {

					const components = new MessageActionRow({
						components: [ new MessageButton({
							customId: 'profile-refresh',
							emoji: '🔁',
							style: 'SECONDARY',
						}), new MessageButton({
							customId: 'profile-store',
							label: 'Store food away',
							style: 'SECONDARY',
						})],
					});

					const mentionedUser = referencedMessage.mentions.users.first();
					if (mentionedUser) {

						userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: mentionedUser.id }));

						components[0].components.pop();
					}
					else if (Object.values(profileData.inventory).map(itemType => Object.values(itemType)).flat().filter(amount => amount > 0).length == 0) {

						components[0].components.pop();
					}

					let injuryText = (Object.values(profileData.injuries).every(item => item == 0)) ? 'none' : '';

					for (const [injuryKey, injuryAmount] of Object.entries(profileData.injuries)) {

						if (injuryAmount > 0) {

							const injuryName = injuryKey.charAt(0).toUpperCase() + injuryKey.slice(1);
							injuryText += `${injuryAmount} ${(injuryAmount > 1) ? injuryName.slice(0, -1) : injuryName}\n`;
						}
					}

					const description = (characterData.description == '') ? '' : `*${characterData.description}*`;
					const user = await client.users
						.fetch(userData.userId)
						.catch(() => { return null; });

					await interaction.message
						.edit({
							embeds: [{
								color: characterData.color,
								title: characterData.name,
								author: { name: `Profile - ${user?.tag}` },
								description: description,
								thumbnail: { url: characterData.avatarURL },
								fields: [
									{ name: '**🦑 Species**', value: (characterData.species.charAt(0).toUpperCase() + characterData.species.slice(1)) || '/', inline: true },
									{ name: '**🏷️ Rank**', value: profileData.rank, inline: true },
									{ name: '**🍂 Pronouns**', value: characterData.pronounSets.map(pronounSet => `${pronounSet[0]}/${pronounSet[1]} (${pronounSet[2]}/${pronounSet[3]}/${pronounSet[4]})`).join('\n') },
									{ name: '**🗺️ Region**', value: profileData.currentRegion },

								],
								footer: { text: `Character ID: ${characterData._id}` },
							},
							{
								color: characterData.color,
								description: `🚩 Levels: \`${profileData.levels}\` - ✨ XP: \`${profileData.experience}/${profileData.levels * 50}\`\n❤️ Health: \`${profileData.health}/${profileData.maxHealth}\`\n⚡ Energy: \`${profileData.energy}/${profileData.maxEnergy}\`\n🍗 Hunger: \`${profileData.hunger}/${profileData.maxHunger}\`\n🥤 Thirst: \`${profileData.thirst}/${profileData.maxThirst}\``,
								fields: [
									{ name: '**🩹 Injuries/Illnesses**', value: injuryText, inline: true },
									{ name: '**🌱 Ginkgo Sapling**', value: profileData.sapling.exists === false ? 'none' : `${profileData.sapling.waterCycles} days alive - ${profileData.sapling.health} health\nNext watering <t:${Math.floor((profileData.sapling.nextWaterTimestamp || 0) / 1000)}:R>`, inline: true },
								],
								footer: { text: profileData.hasQuest === true ? 'There is one open quest!' : undefined },
							}],
							components: [components],
						})
						.catch((error) => {
							if (error.httpStatus !== 404) { throw new Error(error); }
						});
				}

				if (interaction.customId === 'profile-store') {

					interaction.message
						.delete()
						.catch(async (error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});

					referencedMessage.content = `${config.prefix}store`;

					return await execute(client, referencedMessage);
				}
			}

			/*
			This if block ensures that no two timeouts are set at the same time, and only one of them being cleared. When a command that doesn't immediately return (ie explore) is called, this timeout doesn't exist yet, but the old timeout was already cleared. If a second command (ie stats) is started while the old one is still running, it will try to delete the same timeout that the first command (aka explore) already cleared, and create a new one, that subsequently is going to be overwritten by the first command (aka explore) once it is finished. That means that the timeout created by the other command (aka stats) is never going to be cleared, and instead only the timeout of the last finished command (aka explore) is going to be cleared, which means that 10 minutes after the other command (aka stats) was executed, the user will start automatically resting, even if they were still actively playing in that time.
			It is not a good idea to place clearing the timeout behind the command finish executing, since the command finish executing might take some time, and the 10 minutes from that timer might over in that time, making the user attempt to rest while executing a command.
			It is also not a good idea to place starting the timeout before the command start executing, since the command again might take some time to finish executing, and then the 10 minute timer might be over sooner as expected.
			*/
			if (interaction.inGuild() && userMap.has('nr' + interaction.user.id + interaction.guildId) && userMap.get('nr' + interaction.user.id + interaction.guildId)?.activeCommands === 0) {

				// @ts-ignore
				userMap.get('nr' + interaction.user.id + interaction.guildId).restingTimeout = setTimeout(startRestingTimeout, 600000, client, referencedMessage);
			}
		}
	},
};
module.exports = event;