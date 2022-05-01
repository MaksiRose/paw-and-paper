// @ts-check
const { MessageActionRow, MessageButton, MessageEmbed, MessageSelectMenu } = require('discord.js');
const { error_color } = require('../../config.json');
const { profileModel, otherProfileModel } = require('../../models/profileModel');
const serverModel = require('../../models/serverModel');
const { createCommandCollector } = require('../../utils/commandCollector');
const disableAllComponents = require('../../utils/disableAllComponents');

module.exports.name = 'delete';
module.exports.aliases = ['purge', 'remove', 'reset'];

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message) => {

	let allAccounts = [
		.../** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel.find({ userId: message.author.id })),
		.../** @type {Array<import('../../typedef').ProfileSchema>} */ (await otherProfileModel.find({ userId: message.author.id })),
	];
	let allServers = /** @type {Array<import('../../typedef').ServerSchema>} */ (await Promise.all([...new Set(allAccounts.map(p => p.serverId))].map(async serverId => serverModel.findOne({ serverId: serverId }))));

	if (allAccounts.length === 0) {

		await message
			.reply({
				embeds: [ new MessageEmbed({
					color: /** @type {`#${string}`} */ (error_color),
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: 'You have no accounts!',
				})],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	/** @type {import('discord.js').MessageOptions} */
	const originalMessage = {
		embeds: [ new MessageEmbed({
			color: /** @type {`#${string}`} */ (error_color),
			title: 'Please select what you want to delete.',
		})],
		components: [new MessageActionRow({
			components: [new MessageButton({
				customId: 'delete-individual',
				label: 'An individual account',
				style: 'DANGER',
			}), new MessageButton({
				customId: 'delete-server',
				label: 'All accounts on one server',
				style: 'DANGER',
			}), new MessageButton({
				customId: 'delete-all',
				label: 'Everything',
				style: 'DANGER',
			})],
		})],
	};

	let botReply = await message
		.reply({
			...originalMessage,
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	let deletePage = 0;

	createCommandCollector(message.author.id, message.guild.id, botReply);

	interactionCollector();

	async function interactionCollector() {

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.customId.includes('delete') && i.user.id == message.author.id;

		await botReply
			.awaitMessageComponent({ filter, time: 120_000 })
			.then(async interaction => {

				if (interaction.isButton() && interaction.customId === 'delete-individual') {

					deletePage = 0;

					botReply = await botReply
						.edit({
							embeds: [new MessageEmbed({
								color: /** @type {`#${string}`} */ (error_color),
								title: 'Please select an account that you want to delete.',
							})],
							components: [botReply.components[0], new MessageActionRow({
								components: [getAccountsPage(deletePage, allAccounts, allServers)],
							})],
						})
						.catch((error) => { throw new Error(error); });

					await interactionCollector();
					return;
				}

				if (interaction.isSelectMenu() && interaction.values[0] === 'delete-individual_page') {

					deletePage++;
					if (deletePage >= Math.ceil(allAccounts.length / 24)) {

						deletePage = 0;
					}

					botReply = await botReply
						.edit({
							components: [botReply.components[0], new MessageActionRow({
								components: [getAccountsPage(deletePage, allAccounts, allServers)],
							})],
						})
						.catch((error) => { throw new Error(error); });

					await interactionCollector();
					return;
				}

				if (interaction.isSelectMenu() && allAccounts.map(p => p.uuid).includes(interaction.values[0].replace('delete-individual_', ''))) {

					botReply = await botReply
						.edit({
							embeds: [new MessageEmbed({
								color: /** @type {`#${string}`} */ (error_color),
								title: `Are you sure you want to delete the account named "${allAccounts.find(p => p.uuid === interaction.values[0].replace('delete-individual_', '')).name}" on the server "${allServers.find(s => s.serverId === allAccounts.find(p => p.uuid === interaction.values[0].replace('delete-individual_', '')).serverId).name}"? This will be **permanent**!!!`,
							})],
							components: [...disableAllComponents([botReply.components[0], botReply.components[1]]), new MessageActionRow({
								components: [new MessageButton({
									customId: `delete-confirm_individual_${interaction.values[0].replace('delete-individual_', '')}`,
									label: 'Confirm',
									emoji: '✔',
									style: 'DANGER',
								}), new MessageButton({
									customId: 'delete-cancel',
									label: 'Cancel',
									emoji: '✖',
									style: 'SECONDARY',
								})],
							})],
						})
						.catch((error) => { throw new Error(error); });

					await interactionCollector();
					return;
				}

				if (interaction.isButton() && interaction.customId === 'delete-server') {

					deletePage = 0;

					botReply = await botReply
						.edit({
							embeds: [new MessageEmbed({
								color: /** @type {`#${string}`} */ (error_color),
								title: 'Please select a server that you want to delete.',
							})],
							components: [botReply.components[0], new MessageActionRow({
								components: [getServersPage(deletePage, allServers)],
							})],
						})
						.catch((error) => { throw new Error(error); });

					await interactionCollector();
					return;
				}

				if (interaction.isSelectMenu() && interaction.values[0] === 'delete-server_page') {

					deletePage++;
					if (deletePage >= Math.ceil(allServers.length / 24)) {

						deletePage = 0;
					}

					botReply = await botReply
						.edit({
							components: [botReply.components[0], new MessageActionRow({
								components: [getServersPage(deletePage, allServers)],
							})],
						})
						.catch((error) => { throw new Error(error); });

					await interactionCollector();
					return;
				}

				if (interaction.isSelectMenu() && allServers.map(s => s.serverId).includes(interaction.values[0].replace('delete-server_', ''))) {

					botReply = await botReply
						.edit({
							embeds: [new MessageEmbed({
								color: /** @type {`#${string}`} */ (error_color),
								title: `Are you sure you want to delete all your ${allAccounts.filter(p => p.serverId === interaction.values[0].replace('delete-server_', '')).length} accounts on the server ${allServers.find(s => s.serverId === interaction.values[0].replace('delete-server_', '')).name}? This will be **permanent**!!!`,
							})],
							components: [...disableAllComponents([botReply.components[0], botReply.components[1]]), new MessageActionRow({
								components: [new MessageButton({
									customId: `delete-confirm_server_${interaction.values[0].replace('delete-server_', '')}`,
									label: 'Confirm',
									emoji: '✔',
									style: 'DANGER',
								}), new MessageButton({
									customId: 'delete-cancel',
									label: 'Cancel',
									emoji: '✖',
									style: 'SECONDARY',
								})],
							})],
						})
						.catch((error) => { throw new Error(error); });

					await interactionCollector();
					return;
				}

				if (interaction.isButton() && interaction.customId === 'delete-all') {

					botReply = await botReply
						.edit({
							embeds: [new MessageEmbed({
								color: /** @type {`#${string}`} */ (error_color),
								title: 'Are you sure you want to delete all your data? This will be **permanent**!!!',
							})],
							components: [...disableAllComponents([botReply.components[0]]), new MessageActionRow({
								components: [new MessageButton({
									customId: 'delete-confirm_all',
									label: 'Confirm',
									emoji: '✔',
									style: 'DANGER',
								}), new MessageButton({
									customId: 'delete-cancel',
									label: 'Cancel',
									emoji: '✖',
									style: 'SECONDARY',
								})],
							})],
						})
						.catch((error) => { throw new Error(error); });

					await interactionCollector();
					return;
				}

				if (interaction.customId.includes('delete-confirm')) {

					const type = /** @type {'individual' | 'server' | 'all'} */(interaction.customId.split('_')[1]);

					if (type === 'individual') {

						await profileModel.findOneAndDelete({ uuid: interaction.customId.split('_')[2] });
						await otherProfileModel.findOneAndDelete({ uuid: interaction.customId.split('_')[2] });

						await botReply
							.reply({
								embeds: [new MessageEmbed({
									color: /** @type {`#${string}`} */ (error_color),
									title: `The account \`${allAccounts.find(p => p.uuid === interaction.customId.split('_')[2]).name}\` of the server \`${allServers.find(s => s.serverId === allAccounts.find(p => p.uuid === interaction.customId.split('_')[2]).serverId).name}\` was deleted permanently!`,
								})],
							})
							.catch((error) => {
								if (error.httpStatus !== 404) { throw new Error(error); }
							});
					}

					if (type === 'server') {

						await profileModel.findOneAndDelete({ userId: message.author.id, serverId: interaction.customId.split('_')[2] });
						for (const profile of allAccounts.filter(p => p.serverId === interaction.customId.split('_')[2])) {

							await otherProfileModel.findOneAndDelete({ uuid: profile.uuid });
						}

						await botReply
							.reply({
								embeds: [new MessageEmbed({
									color: /** @type {`#${string}`} */ (error_color),
									title: `All ${allAccounts.filter(p => p.serverId === interaction.customId.split('_')[2]).length} accounts on the server \`${allServers.find(s => s.serverId === interaction.customId.split('_')[2]).name}\` were deleted permanently!`,
								})],
							})
							.catch((error) => {
								if (error.httpStatus !== 404) { throw new Error(error); }
							});
					}

					if (type === 'all') {

						for (const profile of allAccounts) {

							await profileModel.findOneAndDelete({ uuid: profile.uuid });
							await otherProfileModel.findOneAndDelete({ uuid: profile.uuid });
						}

						await botReply
							.reply({
								embeds: [new MessageEmbed({
									color: /** @type {`#${string}`} */ (error_color),
									title: 'All your data was deleted permanently!',
									description: 'Did you not like your experience? You can leave constructive criticism using `rp ticket` (an account is not needed).',
								})],
							})
							.catch((error) => {
								if (error.httpStatus !== 404) { throw new Error(error); }
							});

						botReply = await botReply
							.edit({
								components: disableAllComponents(botReply.components),
							})
							.catch((error) => {
								if (error.httpStatus !== 404) { throw new Error(error); }
								return botReply;
							});

						return;
					}

					allAccounts = [
						.../** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel.find({ userId: message.author.id })),
						.../** @type {Array<import('../../typedef').ProfileSchema>} */ (await otherProfileModel.find({ userId: message.author.id })),
					];
					allServers = /** @type {Array<import('../../typedef').ServerSchema>} */ (await Promise.all([...new Set(allAccounts.map(p => p.serverId))].map(async serverId => serverModel.findOne({ serverId: serverId }))));

					botReply = await botReply
						.edit(originalMessage)
						.catch((error) => {
							if (error.httpStatus !== 404) { throw new Error(error); }
							return botReply;
						});

					await interactionCollector();
					return;
				}

				if (interaction.customId === 'delete-cancel') {

					await /** @type {import('discord.js').Message} */ (interaction.message)
						.edit(originalMessage)
						.catch((error) => {
							if (error.httpStatus !== 404) { throw new Error(error); }
						});

					await interactionCollector();
					return;
				}
			})
			.catch(async () => {

				await botReply
					.edit({
						components: disableAllComponents(botReply.components),
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
				return;
			});
	}
};

/**
 * Creates a select menu with the users accounts
 * @param {number} deletePage
 * @param {Array<import('../../typedef').ProfileSchema>} allAccounts
 * @param {Array<import('../../typedef').ServerSchema>} allServers
 * @returns {import('discord.js').MessageSelectMenu}
 */
function getAccountsPage(deletePage, allAccounts, allServers) {

	const accountsMenu = new MessageSelectMenu({
		customId: 'delete-individual-options',
		placeholder: 'Select an account',
	});

	for (const profile of allAccounts) {


		accountsMenu.addOptions({ label: `${profile.name} ${`(${allServers.find(s => s.serverId === profile.serverId)?.name})` || ''}`, value: `delete-individual_${profile.uuid}` });
	}

	if (accountsMenu.options.length > 25) {

		accountsMenu.options = accountsMenu.options.splice(deletePage * 24, (deletePage + 1) * 24);
		accountsMenu.addOptions({ label: 'Show more accounts', value: 'delete-individual_page', description: `You are currently on page ${deletePage + 1}`, emoji: '📋' });
	}

	return accountsMenu;
}

/**
 * Creates a select menu with the servers that have accounts with this user
 * @param {number} deletePage
 * @param {Array<import('../../typedef').ServerSchema>} allServers
 * @returns {import('discord.js').MessageSelectMenu}
 */
function getServersPage(deletePage, allServers) {

	const accountsMenu = new MessageSelectMenu({
		customId: 'delete-server-options',
		placeholder: 'Select a server',
	});

	for (const server of allServers) {


		accountsMenu.addOptions({ label: server.name, value: `delete-server_${server.serverId}` });
	}

	if (accountsMenu.options.length > 25) {

		accountsMenu.options = accountsMenu.options.splice(deletePage * 24, (deletePage + 1) * 24);
		accountsMenu.addOptions({ label: 'Show more servers', value: 'delete-server_page', description: `You are currently on page ${deletePage + 1}`, emoji: '📋' });
	}

	return accountsMenu;
}