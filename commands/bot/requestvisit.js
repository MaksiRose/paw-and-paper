const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const serverModel = require('../../models/serverModel');
const profileModel = require('../../models/profileModel');
const config = require('../../config.json');
const { createCommandCollector } = require('../../utils/commandCollector');

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
						title: 'There are no packs that are available to visit!',
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

		// TO DO: replace messages with actual roleplay messages
		const botReply = await message
			.reply({
				embeds: [{
					color: config.default_color,
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: 'Please choose a pack that you would like to send a visit request to!',
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

				return await declinedInvitation(message, botReply, botReply2);
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

				await botReply
					.edit({
						embeds: [{
							color: config.default_color,
							author: { name: message.guild.name, icon_url: message.guild.iconURL() },
							title: `A visitation invite has been sent to ${otherServerData.name}.`,
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

				const visitChannel = await client.channels.fetch(otherServerData.visitChannelId);

				botReply2 = await visitChannel
					.send({
						embeds: [{
							color: config.default_color,
							title: `${serverData.name} wants to visit this pack! Do you accept?`,
							footer: { text: 'The invitation will expire in five minutes. Alternatively, you can decline it using the button below.' },
						}],
						components: [{
							type: 'ACTION_ROW',
							components: [{
								type: 'BUTTON',
								customId: 'visit_accept',
								label: 'Accept',
								style: 'SUCCESS',
							}, {
								type: 'BUTTON',
								customId: 'visit_decline',
								label: 'Decline',
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

				await botReply2
					.awaitMessageComponent({ time: 300000 })
					.then(async button => {

						if (button.customId === 'visit_decline') {

							return Promise.reject();
						}

						if (button.customId === 'visit_accept') {

							acceptedInvitation(client, botReply, botReply2, serverData, otherServerData);
							return;
						}
					})
					.catch(async () => {return await declinedInvitation(message, botReply, botReply2);});
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

async function declinedInvitation(message, botReply, botReply2) {

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
				title: 'The visitation invite has been declined or expired.',
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
				title: 'The visitation invite has been declined or expired.',
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

async function acceptedInvitation(client, botReply, botReply2, serverData, otherServerData) {

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
				title: 'The visitation invite has been accepted! You can start talking now.',
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
				title: `You have accepted ${serverData.name}! You can start talking to them now.`,
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
							title: 'The visit has ended.',
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
							title: 'The visit has ended.',
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