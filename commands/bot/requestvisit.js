const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const serverModel = require('../../models/serverModel');
const profileModel = require('../../models/profileModel');
const config = require('../../config.json');
const { createCommandCollector } = require('../../utils/commandCollector');
const { pronounAndPlural, pronoun, upperCasePronounAndPlural, upperCasePronoun } = require('../../utils/getPronouns');

module.exports = {
	name: 'requestvisit',
	async sendMessage(client, message, argumentsArray, profileData, serverData) {

		if (await hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (serverData.visitChannelId === null) {

			return await message
				.reply({
					embeds: [{
						color: config.error_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: 'Visits are currently turned off! Ask a server admin to turn it on via \'rp allowvisits\'',
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if (serverData.currentlyVisiting !== null) {

			return await message
				.reply({
					embeds: [{
						color: config.error_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: 'You are already visiting someonne!',
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		let visitableServers = await serverModel.find({
			serverId: { $nin: [message.guild.id] },
			visitChannelId: { $nin: [null] },
			currentlyVisiting: null,
		});

		if (visitableServers.length <= 0) {

			return await message
				.reply({
					embeds: [{
						color: config.error_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						description: `*${profileData.name} really wants to visit some packs in the area but no one there seems to have time. The ${profileData.species} gets back feeling a bit lonely but when ${pronounAndPlural(profileData, 0, 'see')} all ${pronoun(profileData, 2)} packmates having fun at home ${profileData.name} cheers up and joins them excitedly.*`,
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		let selectMenuOptionsArray = [];
		let packPage = 0;

		selectMenuOptionsArray = getMenuOptions(visitableServers, packPage, selectMenuOptionsArray);

		let botReply = await message
			.reply({
				embeds: [{
					color: config.default_color,
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					description: `*${profileData.name} is looking to meet some new friends. There are other packs in the area. Who should ${pronoun(profileData, 0)} visit?*`,
				}],
				components: [{
					type: 'ACTION_ROW',
					components: [{
						type: 'SELECT_MENU',
						customId: 'visit-options',
						placeholder: 'Select a pack',
						options: selectMenuOptionsArray,
					}],
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		let botReply2;

		createCommandCollector(message.author.id, message.guild.id, botReply);
		interactionCollector();

		async function interactionCollector() {

			const filter = i => i.user.id === message.author.id;

			const interaction = await botReply
				.awaitMessageComponent({ filter, time: 300000 })
				.catch(() => { return null; });

			if (interaction === null) {

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

			if (interaction.customId === 'visit_cancel') {

				return await declinedInvitation(message, profileData, botReply, botReply2);
			}

			if (interaction.values[0] == 'visit_page') {

				visitableServers = await serverModel.find({
					visitChannelId: { $nin: [null] },
					currentlyVisiting: null,
				});

				packPage++;
				if (packPage >= Math.ceil(visitableServers.length / 24)) {

					packPage = 0;
				}

				selectMenuOptionsArray = getMenuOptions(visitableServers, packPage, []);

				await interaction.message
					.edit({
						components: [{
							type: 'ACTION_ROW',
							components: [{
								type: 'SELECT_MENU',
								customId: 'species-options',
								placeholder: 'Select a species',
								options: selectMenuOptionsArray,
							}],
						}],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				return await interactionCollector();
			}

			if (interaction.values[0].startsWith('visit-')) {

				const visitGuildId = interaction.values[0].split('-')[1];

				let otherServerData = await serverModel.findOne(
					{ serverId: visitGuildId },
				);

				if (otherServerData === null || otherServerData.currentlyVisiting !== null) {

					return await botReply
						.edit({
							embeds: [{
								color: config.error_color,
								author: { name: message.guild.name, icon_url: message.guild.iconURL() },
								title: 'The chosen pack has become unavailable or is already being visited. Please pick another one.',
							}],
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
				}

				serverData = await serverModel.findOneAndUpdate(
					{ serverId: serverData.serverId },
					{ $set: { currentlyVisiting: otherServerData.serverId } },
				);

				otherServerData = await serverModel.findOneAndUpdate(
					{ serverId: otherServerData.serverId },
					{ $set: { currentlyVisiting: serverData.serverId } },
				);

				const visitChannel = await client.channels.fetch(serverData.visitChannelId);

				botReply = await visitChannel
					.send({
						embeds: [{
							color: config.default_color,
							author: { name: message.guild.name, icon_url: message.guild.iconURL() },
							description: `*${profileData.name} strolls over to ${otherServerData.name}. ${upperCasePronounAndPlural(profileData, 0, 'is', 'are')} waiting patiently at the pack borders to be invited in as to not invade the pack's territory without permission.*`,
							footer: { text: 'The invitation will expire in five minutes. Alternatively, you can cancel it using the button below.' },
						}],
						components: [{
							type: 'ACTION_ROW',
							components: [{
								type: 'BUTTON',
								customId: 'visit_cancel',
								label: 'Cancel',
								style: 'DANGER',
							}],
						}],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				interactionCollector();

				const otherVisitChannel = await client.channels.fetch(otherServerData.visitChannelId);

				botReply2 = await otherVisitChannel
					.send({
						embeds: [{
							color: config.default_color,
							author: { name: message.guild.name, icon_url: message.guild.iconURL() },
							title: `Near the lake a ${profileData.species} is waiting. ${upperCasePronoun(profileData, 0)} came out of the direction where a pack named "${serverData.name}" is lying. ${upperCasePronoun(profileData, 0)} seems to be waiting for permission to cross the pack borders.`,
							footer: { text: 'The invitation will expire in five minutes. Alternatively, you can decline it using the button below.' },
						}],
						components: [{
							type: 'ACTION_ROW',
							components: [{
								type: 'BUTTON',
								customId: 'visit_accept',
								label: 'Accept visit',
								style: 'SUCCESS',
							}, {
								type: 'BUTTON',
								customId: 'visit_decline',
								label: 'Decline visit',
								style: 'DANGER',
							}],
						}],
						failIfNotExists: false,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				const filter2 = async i => (await profileModel.findOne({ serverId: i.guild.id, userId: i.user.id })) === null ? false : true;

				await botReply2
					.awaitMessageComponent({ filter2, time: 300000 })
					.then(async button => {

						if (button.customId === 'visit_decline') {

							return Promise.reject();
						}

						const otherProfileData = await profileModel.findOne({ serverId: button.guild.id, userId: button.user.id });

						if (button.customId === 'visit_accept') {

							acceptedInvitation(client, message, botReply, botReply2, serverData, otherServerData, profileData, otherProfileData);
							return;
						}
					})
					.catch(async () => {return await declinedInvitation(message, profileData, botReply, botReply2);});
			}
		}
	},
};

function getMenuOptions(visitableServers, packPage, selectMenuOptionsArray) {

	for (const server of visitableServers.slice((packPage * 24), 25 + (packPage * 24))) {

		selectMenuOptionsArray.push({ label: server.name, value: `visit-${server.serverId}` });
	}

	if (visitableServers.length > 25) {

		selectMenuOptionsArray.length = 24;
		selectMenuOptionsArray.push({ label: 'Show more pack options', value: 'visit_page', description: 'You are currently on page 1', emoji: '📋' });
	}

	return selectMenuOptionsArray;
}

async function declinedInvitation(message, profileData, botReply, botReply2) {

	await botReply
		.edit({
			components: [],
		})
		.catch((error) => {
			if (error.httpStatus !== 404) {
				throw new Error(error);
			}
		});

	await botReply
		.reply({
			embeds: [{
				color: config.default_color,
				author: { name: message.guild.name, icon_url: message.guild.iconURL() },
				description: `*After ${profileData.name} waited for a while, ${pronoun(profileData, 0)} couldn't deal with the boredom and left the borders of ${botReply.guild.name}. The ${profileData.species} gets back feeling a bit lonely but when ${pronounAndPlural(profileData, 0, 'see')} all ${pronoun(profileData, 2)} packmates having fun at home, ${profileData.name} cheers up and joins them excitedly.*`,
			}],
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) {
				throw new Error(error);
			}
		});

	await botReply2
		.edit({
			components: [],
		})
		.catch((error) => {
			if (error.httpStatus !== 404) {
				throw new Error(error);
			}
		});

	await botReply2
		.reply({
			embeds: [{
				color: config.default_color,
				author: { name: message.guild.name, icon_url: message.guild.iconURL() },
				description: `*After the ${profileData.species} waited for a while, the pack members of ${botReply.guild.name} can see them getting up and leaving, probably due to boredom. Everyone is too busy anyways, so it is probably for the best if they come back later.*`,
			}],
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) {
				throw new Error(error);
			}
		});

	await serverModel.findOneAndUpdate(
		{ serverId: botReply.guildId },
		{ $set: { currentlyVisiting: null } },
	);

	await serverModel.findOneAndUpdate(
		{ serverId: botReply2.guildId },
		{ $set: { currentlyVisiting: null } },
	);
}

async function acceptedInvitation(client, message, botReply, botReply2, serverData, otherServerData, profileData, otherProfileData) {

	await botReply
		.edit({
			components: [],
		})
		.catch((error) => {
			if (error.httpStatus !== 404) {
				throw new Error(error);
			}
		});

	await botReply
		.reply({
			embeds: [{
				color: config.default_color,
				author: { name: botReply.guild.name, icon_url: botReply.guild.iconURL() },
				description: `*After waiting for a bit, a ${otherProfileData.species} comes closer, inviting ${profileData.name} and their packmates in and leading them inside where they can talk to all these new friends.*`,
				footer: { text: 'Anyone with a completed profile can now send a message in this channel. It will be delivered to the other pack, and vice versa. Type "rp endvisit" to end the visit at any time.' },
			}],
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) {
				throw new Error(error);
			}
		});

	await botReply2
		.edit({
			components: [],
		})
		.catch((error) => {
			if (error.httpStatus !== 404) {
				throw new Error(error);
			}
		});

	await botReply2
		.reply({
			embeds: [{
				color: config.default_color,
				author: { name: botReply.guild.name, icon_url: botReply.guild.iconURL() },
				description: `*${otherProfileData.name} goes to pick up the ${profileData.species} and their packmates from the pack borders. The new friends seem excited to be here and to talk to everyone.*`,
				footer: { text: 'Anyone with a completed profile can now send a message in this channel. It will be delivered to the other pack, and vice versa. Type "rp endvisit" to end the visit at any time.' },
			}],
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) {
				throw new Error(error);
			}
		});

	const filter = async m => (await profileModel.findOne({ serverId: m.guild.id, userId: m.author.id })) === null ? false : true;

	const hostChannel = await client.channels.fetch(otherServerData.visitChannelId);
	const guestChannel = await client.channels.fetch(serverData.visitChannelId);

	collectMessages(hostChannel, guestChannel);
	collectMessages(guestChannel, hostChannel);

	async function collectMessages(thisServerChannel, otherServerChannel) {

		const collector = thisServerChannel.createMessageCollector({ filter, idle: 300000 });
		const otherServerWebhook = (await otherServerChannel
			.fetchWebhooks()
			.catch((error) => {
				if (error.httpStatus === 403) {
					otherServerChannel.send('Please give me permission to create webhooks 😣');
					thisServerChannel.send('The other pack is missing permissions, so I couldn\'t establish a connection 😣');
				}
				throw new Error(error);
			})
		).find(webhook => webhook.name === 'PnP Profile Webhook') || await otherServerChannel
			.createWebhook('PnP Profile Webhook')
			.catch((error) => {
				if (error.httpStatus === 403) {
					otherServerChannel.send('Please give me permission to create webhooks 😣');
					thisServerChannel.send('The other pack is missing permissions, so I couldn\'t establish a connection 😣');
				}
				throw new Error(error);
			});

		collector.on('collect', async msg => {

			const profile = await profileModel.findOne({ serverId: msg.guild.id, userId: msg.author.id });

			await otherServerWebhook
				.send({
					content: msg.content,
					username: `${profile.name} (${msg.guild.name})`,
					avatarURL: profile.avatarURL,
				})
				.catch((error) => {
					throw new Error(error);
				});

			await msg.react('✅');
		});

		collector.on('end', async () => {

			serverData = await serverModel.findOne(
				{ serverId: thisServerChannel.guild.id },
			);

			otherServerData = await serverModel.findOne(
				{ serverId: otherServerChannel.guild.id },
			);

			if (serverData.currentlyVisiting !== null && otherServerData.currentlyVisiting !== null) {

				await thisServerChannel
					.send({
						embeds: [{
							color: config.default_color,
							author: { name: otherServerChannel.guild.name, icon_url: otherServerChannel.guild.iconURL() },
							description: `*Hanging out with friends is always nice but has to end eventually. And so the friends from ${message.guild.name} went back to their territory. Until next time.*`,
						}],
						failIfNotExists: false,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				await otherServerChannel
					.reply({
						embeds: [{
							color: config.default_color,
							author: { name: thisServerChannel.guild.name, icon_url: thisServerChannel.guild.iconURL() },
							description: `*Hanging out with friends is always nice but has to end eventually. And so the friends from ${message.guild.name} went back to their territory. Until next time.*`,
						}],
						failIfNotExists: false,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				await serverModel.findOneAndUpdate(
					{ serverId: thisServerChannel.guild.id },
					{ $set: { currentlyVisiting: null } },
				);

				await serverModel.findOneAndUpdate(
					{ serverId: otherServerChannel.guild.id },
					{ $set: { currentlyVisiting: null } },
				);
			}
		});
	}
}