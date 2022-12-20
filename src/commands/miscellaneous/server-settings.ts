import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChannelType, ChatInputCommandInteraction, ComponentType, EmbedBuilder, InteractionCollector, InteractionReplyOptions, InteractionType, InteractionUpdateOptions, MessageComponentInteraction, MessageEditOptions, ModalBuilder, PermissionFlagsBits, RestOrArray, StringSelectMenuBuilder, SelectMenuComponentOptionData, AnySelectMenuInteraction, SlashCommandBuilder, TextChannel, TextInputBuilder, TextInputStyle, RoleSelectMenuBuilder } from 'discord.js';
import { getArrayElement, respond, sendErrorMessage } from '../../utils/helperFunctions';
import serverModel from '../../models/serverModel';
import { userModel } from '../../models/userModel';
import { checkLevelRequirements, checkRankRequirements } from '../../utils/checkRoleRequirements';
import { getMapData } from '../../utils/helperFunctions';
import { missingPermissions } from '../../utils/permissionHandler';
import { SlashCommand } from '../../typings/handle';
import { ServerSchema } from '../../typings/data/server';
import { ProxyListType, RankType, WayOfEarningType } from '../../typings/data/user';
const { default_color, update_channel_id } = require('../../../config.json');

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('server-settings')
		.setDescription('List of server-specific settings like shop roles, update notifications and more.')
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels + PermissionFlagsBits.ManageRoles)
		.toJSON(),
	category: 'page5',
	position: 1,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction, userData, serverData) => {

		// It should give you a message with the a drop-down of menus:
		// shop (which has add, delete, edit), updates, visits, proxying (which as only disable all or disable auto right now)
		// Clicking these should edit the message with the current embed, a first row button that says "⬅️ Back", and any other needed components
		// If the command is nested (as in, you need to click another option to be brought into a sub-sub-setting), the "⬅️ Back" button should only bring you back one level
		// That way you can basically go through the command as if it was a folder

		/* It's checking if the message is in a guild, and if it is, it's checking if the guild is in the database. If it's not, it throws an error. Else, it's responding with the original message */
		if (serverData === null || !interaction.inCachedGuild()) { throw new Error('Message is not in configured guild'); }

		// This is always a reply
		await respond(interaction, getOriginalMessage(interaction, serverData));
		return;
	},
	async sendMessageComponentResponse(interaction, userData, serverData) {

		if (!serverData) { throw new Error('serverData is null'); }
		if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild'); }
		const selectOptionId = interaction.isAnySelectMenu() ? interaction.values[0] : undefined;

		/* It's checking if the interaction is a button that leads back to the main page, and it's updating the message with the main page content. */
		if (interaction.isButton() && interaction.customId.includes('mainpage')) {

			// This is always an update to the message with the button
			await respond(interaction, getOriginalMessage(interaction, serverData), 'update', '@original');
			return;
		}

		/* It's checking if the interaction value or customId includes shop, and sends a message if it does. */
		if ((interaction.isButton() && interaction.customId.startsWith('server-settings_shop_@')) || (interaction.isStringSelectMenu() && interaction.values[0] === 'server-settings_shop')) {

			if (await missingPermissions(interaction, [
				'ManageRoles', // Needed to give out roles configured in this shop
			]) === true) { return; }

			// This is always an update to the message with the component
			await respond(interaction, await getShopMessage(interaction, serverData, 0), 'update', '@original');
			return;
		}

		/* It's checking if the interaction is the shop select menu. */
		if (interaction.isStringSelectMenu() && selectOptionId && interaction.customId.includes('shop_options')) {

			/* It's checking if the value is for turning a page. If it is, it's getting the page number from the value, and it's updating the message with the shop message with the page number. */
			if (selectOptionId.includes('nextpage')) {

				const page = Number(selectOptionId.split('_')[3]);

				// This is always an update to the message with the select menu
				await respond(interaction, await getShopMessage(interaction, serverData, page), 'update', '@original');
				return;
			}
			else {

				const roleIdOrAdd = selectOptionId.split('_')[2] || '';

				const rolePage = 0;
				let role: ServerSchema['shop'][number]['roleId'] | null = serverData.shop.find(shopItem => shopItem.roleId === roleIdOrAdd)?.roleId || null;
				let wayOfEarning: ServerSchema['shop'][number]['wayOfEarning'] | null = serverData.shop.find(shopItem => shopItem.roleId === role)?.wayOfEarning || null;
				let requirement: ServerSchema['shop'][number]['requirement'] | null = serverData.shop.find(shopItem => shopItem.roleId === role)?.requirement || null;
				const roleMenu = await async function() {

					if (roleIdOrAdd !== 'add') { return null; }

					return await getNewRoleMenu(interaction, serverData, rolePage);
				}();

				// This is always an update to the message with the select menu
				await respond(interaction, getShopRoleMessage(interaction, roleMenu, roleIdOrAdd, serverData, wayOfEarning, requirement, role), 'update', '@original');

				const modalCollector = new InteractionCollector(interaction.client, { channel: interaction.channel || undefined, interactionType: InteractionType.ModalSubmit, message: interaction.message });

				const interactionCollector = interaction.message.createMessageComponentCollector<ComponentType.Button | ComponentType.StringSelect>({
					filter: (i) => i.user.id === interaction.user.id,
					idle: 1_800_000,
				}); // idle for 30 minutes

				interactionCollector.on('collect', async (i: MessageComponentInteraction<'cached'>) => {
					try {

						const collectorSelectOptionId = i.isAnySelectMenu() ? i.values[0] : undefined;

						// This is also picked up by sendMessageComponentResponse, so we do not reply and stop the collector since it will reply and start a new collector from the parent function
						if (i.isButton() && i.customId.startsWith('server-settings_shop_@')) { interactionCollector.stop('back'); }

						if (i.isRoleSelectMenu() && collectorSelectOptionId && i.customId.startsWith('server-settings_shop_add_options')) {

							role = collectorSelectOptionId;

							// This is always an update to the message with the select menu
							await respond(i, getShopRoleMessage(i, roleMenu, roleIdOrAdd, serverData!, wayOfEarning, requirement, role), 'update', '@original')
								.catch(error => { console.error(error); });
						}

						if (i.isStringSelectMenu() && collectorSelectOptionId && i.customId.startsWith('server-settings_shop_wayofearning')) {

							wayOfEarning = collectorSelectOptionId.replace('server-settings_shop_wayofearning_', '') as WayOfEarningType;
							requirement = null;

							// This is always an update to the message with the select menu
							await respond(i, getShopRoleMessage(i, roleMenu, roleIdOrAdd, serverData!, wayOfEarning, requirement, role), 'update', '@original')
								.catch(error => { console.error(error); });
						}

						if (i.isStringSelectMenu() && collectorSelectOptionId && i.customId.startsWith('server-settings_shop_requirements')) {

							requirement = collectorSelectOptionId.replace('server-settings_shop_requirements_', '') as RankType;

							// This is always an update to the message with the select menu
							await respond(i, getShopRoleMessage(i, roleMenu, roleIdOrAdd, serverData!, wayOfEarning, requirement, role), 'update', '@original')
								.catch(error => { console.error(error); });
						}

						if (i.isButton() && i.customId.startsWith('server-settings_shop_requirementsmodal')) {

							await i
								.showModal(new ModalBuilder()
									.setCustomId('server-settings_shop_requirements')
									.setTitle('Change requirement')
									.addComponents(
										new ActionRowBuilder<TextInputBuilder>()
											.setComponents([new TextInputBuilder()
												.setCustomId('server-settings_shop_requirements_textinput')
												.setLabel('A positive number')
												.setStyle(TextInputStyle.Short)
												.setRequired(true)
												.setMaxLength(9)
												.setPlaceholder(`The amount of ${wayOfEarning} the user needs, i.e. ${wayOfEarning === WayOfEarningType.Experience ? '10000' : '10'}`),
											]),
									),
								)
								.catch(error => { console.error(error); });
						}

						if (i.isButton() && i.customId.startsWith('server-settings_shop_save')) {

							/* Check if role, wayOfEarning or requirement is null */
							if (role === null || wayOfEarning === null || requirement === null) {

								// This is always a reply
								await respond(i, { content: 'Something went wrong. You shouldn\'t be able to save yet, either the role, way of earning or requirement is missing.', ephemeral: true })
									.catch(error => { console.error(error); });
								return;
							}

							/* Update the serverData, by removing a potential existing entry and making a new entry. */
							serverData = await serverModel.findOneAndUpdate(
								s => s.serverId === i.guildId,
								(s) => {
									if (role === null || wayOfEarning === null || requirement === null) { return; }
									s.shop = s.shop.filter(r => r.roleId !== role);
									s.shop.push({
										roleId: role,
										wayOfEarning: wayOfEarning,
										requirement: requirement,
									});
								},
							);

							// This is always a reply
							await respond(i, {
								content: `<@&${role}> ${roleIdOrAdd === 'add' ? 'added to the shop' : 'edited'}! The requirement is ${requirement} ${wayOfEarning}.`,
								ephemeral: true,
							})
								.catch(error => { console.error(error); });

							/* Get all the users that have at least one quid with a profile on this server */
							const allServerUsers = await userModel.find(
								(u) => {
									return Object.values(u.quids).filter(q => q.profiles[i.guildId] !== undefined).length > 0;
								});

							for (const u of Object.values(allServerUsers)) {

								for (const q of Object.values(u.quids)) {

									const p = q.profiles[i.guildId];
									if (p !== undefined) {

										/* Update the user by checking if there is a role with the roleId, and if there is, deleting it */
										await userModel.findOneAndUpdate(
											user => user._id === u._id,
											(user) => {
												const prof = getMapData(getMapData(user.quids, q._id).profiles, p.serverId);
												prof.roles = prof.roles.filter(r => r.roleId !== role);
											},
										);

										/* Giving users the role if they meet the requirements or removing it if they don't. */
										if (wayOfEarning === WayOfEarningType.Levels) {

											const member = await i.guild.members.fetch(Object.keys(u.userIds)[0] || '').catch(() => { return undefined; });
											await checkLevelRequirements(serverData, i, member, p.levels, false);

											if (p.levels < requirement && member && member.roles.cache.has(role)) {

												await member.roles
													.remove(role)
													.catch(error => { console.error(error); });
											}
										}

										if (wayOfEarning === WayOfEarningType.Rank && typeof requirement === 'string') {

											const member = await i.guild.members.fetch(Object.keys(u.userIds)[0] || '').catch(() => { return undefined; });
											await checkRankRequirements(serverData, i, member, p.rank, false);

											const rankList = { Youngling: 0, Apprentice: 1, Hunter: 2, Healer: 2, Elderly: 2 };
											if (rankList[p.rank] < rankList[requirement] && member && member.roles.cache.has(role)) {

												await member.roles
													.remove(role)
													.catch(error => { console.error(error); });
											}
										}

										if (wayOfEarning === WayOfEarningType.Experience) {

											const member = await i.guild.members.fetch(Object.keys(u.userIds)[0] || '').catch(() => { return undefined; });
											if (member && member.roles.cache.has(role)) {

												await member.roles
													.remove(role)
													.catch(error => { console.error(error); });
											}
										}
									}
								}
							}

							interactionCollector.stop('save');
						}

						if (i.isButton() && i.customId.startsWith('server-settings_shop_delete')) {

							// deleted shop items must be checked to be deleted/removed for all users
							// send a success ephemeral message to the user
							// after this, stop the collector with reason 'delete'

							/* Check if role, wayOfEarning or requirement is null */
							if (role === null || wayOfEarning === null || requirement === null) {

								// This is always a reply
								await respond(i, { content: 'Something went wrong. You shouldn\'t be able to save yet, either the role, way of earning or requirement is missing.', ephemeral: true })
									.catch(error => { console.error(error); });
								return;
							}

							/* Update the serverData, by removing a potential existing entry and making a new entry. */
							serverData = await serverModel.findOneAndUpdate(
								s => s.serverId === i.guildId,
								(s) => {
									s.shop = s.shop.filter(r => r.roleId !== role);
								},
							);

							// This is always a reply
							await respond(i, {
								content: `<@&${role}> with the requirement of ${requirement} ${wayOfEarning} was deleted from the shop.`,
								ephemeral: true,
							})
								.catch(error => { console.error(error); });

							/* Get all the users that have at least one quid with a profile on this server */
							const allServerUsers = await userModel.find(
								(u) => {
									return Object.values(u.quids).filter(q => q.profiles[i.guildId] !== undefined).length > 0;
								});

							for (const u of Object.values(allServerUsers)) {

								for (const q of Object.values(u.quids)) {

									const p = q.profiles[i.guildId];
									if (p !== undefined) {

										/* Update the user by checking if there is a role with the roleId, and if there is, deleting it */
										await userModel.findOneAndUpdate(
											user => user._id === u._id,
											(user) => {
												const prof = getMapData(getMapData(user.quids, q._id).profiles, p.serverId);
												prof.roles = prof.roles.filter(r => r.roleId !== role);
											},
										);

										/* Remove the role from users that have it. */
										const member = await i.guild.members.fetch(Object.keys(u.userIds)[0] || '').catch(() => { return undefined; });

										if (member && member.roles.cache.has(role)) {

											await member.roles
												.remove(role)
												.catch(error => { console.error(error); });
										}
									}
								}
							}

							interactionCollector.stop('delete');
						}
					}
					catch (error) {

						await sendErrorMessage(interaction, error)
							.catch(e => { console.error(e); });
					}
				});

				modalCollector.on('collect', async i => {
					try {

						if (i.type === InteractionType.ModalSubmit && i.isFromMessage()) {

							const modalTextInput = Number(i.fields.getTextInputValue('server-settings_shop_requirements_textinput'))
						;

							if (Number.isInteger(Number(modalTextInput)) === false || Number(modalTextInput) <= 0) {

								// This is always a reply
								await respond(i, { content: 'Please only input positive numbers without any commas or dots!', ephemeral: true })
									.catch(error => { console.error(error); });
								return;
							}

							requirement = modalTextInput;
							// This is always an update to the message the modal was called from
							await respond(i, getShopRoleMessage(interaction, roleMenu, roleIdOrAdd, serverData!, wayOfEarning, requirement, role), 'update', '@original')
								.catch(error => { console.error(error); });
							return;
						}
					}
					catch (error) {

						await sendErrorMessage(interaction, error)
							.catch(e => { console.error(e); });
					}
				});

				interactionCollector.on('end', async (collected, reason) => {
					try {

						modalCollector.stop(reason);

						if (reason !== 'back') {

							// This is an update to "interaction" rather than "i", therefore this will always be an editReply to the original message which is an update to the message with the component
							await respond(interaction, await getShopMessage(interaction, serverData!, 0), 'update', '@original')
								.catch((error) => {
									if (error.httpStatus !== 404) { console.error(error); }
								});
							return;
						}
					}
					catch (error) {

						await sendErrorMessage(interaction, error)
							.catch(e => { console.error(e); });
					}
				});
			}
		}

		/* It's checking if the interaction value includes updates, and sends a message if it does. */
		if (interaction.isStringSelectMenu() && interaction.values[0] === 'server-settings_updates') {

			if (await missingPermissions(interaction, [
				'ViewChannel', 'ManageWebhooks', // Needed to add the follower
			]) === true) { return; }

			// This is always an update to the message with the select menu
			await respond(interaction, await getUpdateMessage(interaction, serverData, 0), 'update', '@original');
			return;
		}

		/* It's checking if the interaction is the updates select menu */
		if (interaction.isStringSelectMenu() && selectOptionId && interaction.customId.includes('updates_options')) {

			/* It's checking if the value is for turning a page. If it is, it's getting the page number from the value, and it's updating the message with the shop message with the page number. */
			if (selectOptionId.includes('nextpage')) {

				const page = Number(selectOptionId.split('_')[3]);

				// This is always an update to the message with the select menu
				await respond(interaction, await getUpdateMessage(interaction, serverData, page), 'update', '@original');
				return;
			}
			else {

				const channelId = getArrayElement(selectOptionId.split('_'), 2);

				const announcementChannel = await interaction.client.channels.fetch(update_channel_id);
				if (announcementChannel === null || announcementChannel.type !== ChannelType.GuildAnnouncement) { throw new Error('Announcement Channel is missing or not of type GuildAnnouncement.'); }

				await announcementChannel.addFollower(channelId);

				// This is always an update to the message with the select menu
				await respond(interaction, getOriginalMessage(interaction, serverData), 'update', '@original')
					.catch((error) => {
						if (error.httpStatus !== 404) { console.error(error); }
					});

				// This is always a followUp
				await respond(interaction, {
					content: `Updates are now posted to <#${channelId}>!`,
					ephemeral: true,
				});
				return;
			}
		}

		/* It's checking if the interaction value includes visits, and sends a message if it does. */
		if (interaction.isStringSelectMenu() && interaction.values[0] === 'server-settings_visits') {

			if (await missingPermissions(interaction, [
				'ManageWebhooks', // Needed to do visits
			]) === true) { return; }

			// This is always an update to the message with the select menu
			await respond(interaction, await getVisitsMessage(interaction, serverData, 0), 'update', '@original');
			return;
		}

		/* It's checking if the interaction is the visits select menu */
		if (interaction.isStringSelectMenu() && selectOptionId && interaction.customId.includes('visits_options')) {

			/* It's checking if the value is for turning a page. If it is, it's getting the page number from the value, and it's updating the message with the shop message with the page number. */
			if (selectOptionId.includes('nextpage')) {

				const page = Number(selectOptionId.split('_')[3]);

				// This is always an update to the message with the select menu
				await respond(interaction, await getVisitsMessage(interaction, serverData, page), 'update', '@original');
				return;
			}
			else {

				// This is always an update to the message with the select menu
				await respond(interaction, getOriginalMessage(interaction, serverData), 'update', '@original')
					.catch((error) => {
						if (error.httpStatus !== 404) { console.error(error); }
					});

				const channelIdOrOff = getArrayElement(selectOptionId.split('_'), 2);

				if (channelIdOrOff === 'off') {

					await serverModel.findOneAndUpdate(
						s => s.serverId === interaction.guildId,
						(s) => {
							s.visitChannelId = null;
						},
					);

					// This is always a followUp
					await respond(interaction, {
						content: 'Visits have successfully been turned off!',
						ephemeral: true,
					});
				}
				else {

					await serverModel.findOneAndUpdate(
						s => s.serverId === interaction.guildId,
						(s) => {
							s.visitChannelId = channelIdOrOff;
						},
					);

					// This is always a followUp
					await respond(interaction, {
						content: `Visits are now possible in <#${channelIdOrOff}>!`,
						ephemeral: true,
					});
				}
				return;
			}
		}

		/* It's checking if the interaction value includes visits, and sends a message if it does. */
		if (interaction.isStringSelectMenu() && interaction.values[0] === 'server-settings_proxying') {

			// This is always an update to the message with the select menu
			await respond(interaction, await getProxyingMessage(interaction, serverData, 0), 'update', '@original');
			return;
		}

		if (interaction.isButton() && interaction.customId.includes('proxying_setTo')) {

			serverData = await serverModel.findOneAndUpdate(
				s => s.serverId === interaction.guildId,
				(s) => {
					s.proxySettings.channels.setTo = s.proxySettings.channels.setTo === ProxyListType.Blacklist ? ProxyListType.Whitelist : ProxyListType.Blacklist;
				},
			);

			// This is always an update to the message with the select menu
			await respond(interaction, await getProxyingMessage(interaction, serverData, 0), 'update', '@original')
				.catch((error) => {
					if (error.httpStatus !== 404) { console.error(error); }
				});

			const setTo = serverData.proxySettings.channels.setTo;

			// This is always a followUp
			await respond(interaction, {
				content: `Proxying is now only ${setTo === ProxyListType.Blacklist ? 'disabled' : 'enabled'} in the ${setTo === ProxyListType.Blacklist ? 'blacklisted' : 'whitelisted'} channels!`,
				ephemeral: true,
			});
			return;
		}

		/* It's checking if the interaction is the visits select menu */
		if (interaction.isStringSelectMenu() && selectOptionId && interaction.customId.includes('proxying_options')) {

			/* It's checking if the value is for turning a page. If it is, it's getting the page number from the value, and it's updating the message with the shop message with the page number. */
			if (selectOptionId.includes('nextpage')) {

				const page = Number(selectOptionId.split('_')[3]);

				// This is always an update to the message with the select menu
				await respond(interaction, await getProxyingMessage(interaction, serverData, page), 'update', '@original');
				return;
			}
			else {

				const setTo = serverData.proxySettings.channels.setTo === ProxyListType.Blacklist ? 'blacklist' : 'whitelist';
				const channelId = selectOptionId.replace('server-settings_proxying_', '');
				const hasChannel = serverData.proxySettings.channels[setTo].includes(channelId);

				serverData = await serverModel.findOneAndUpdate(
					s => s.serverId === interaction.guildId,
					(s) => {
						if (!hasChannel) { s.proxySettings.channels[setTo].push(channelId); }
						else { s.proxySettings.channels[setTo] = s.proxySettings.channels[setTo].filter(string => string !== channelId); }
					},
				);

				// This is always an update to the message with the select menu
				await respond(interaction, await getProxyingMessage(interaction, serverData, 0), 'update', '@original')
					.catch((error) => {
						if (error.httpStatus !== 404) { console.error(error); }
					});

				// This is always a followUp
				await respond(interaction, {
					content: `${hasChannel ? 'Removed' : 'Added'} <#${channelId}> ${hasChannel ? 'from' : 'to'} the proxying ${setTo}!`,
					ephemeral: true,
				});
				return;
			}
		}

	},
};

function getOriginalMessage(interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'> | AnySelectMenuInteraction<'cached'>, serverData: ServerSchema): InteractionReplyOptions & MessageEditOptions & InteractionUpdateOptions {

	return {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setAuthor({ name: serverData.name, iconURL: interaction.guild?.iconURL() || undefined })
			.setTitle('Select what you want to configure from the drop-down menu below.')],
		components: [new ActionRowBuilder<StringSelectMenuBuilder>()
			.setComponents([new StringSelectMenuBuilder()
				.setCustomId(`server-settings_options_@${interaction.user.id}`)
				.setPlaceholder('Select an option to configure')
				.setOptions(
					{ value: 'server-settings_shop', label: 'Shop', description: 'Add, delete or edit earnable roles' },
					{ value: 'server-settings_updates', label: 'Updates', description: 'Get updates for new releases sent to a channel' },
					{ value: 'server-settings_visits', label: 'Visits', description: 'Configure a channel to connect with other servers' },
					{ value: 'server-settings_proxying', label: 'Proxying', description: 'Manage proxying' },
				)])],
	};
}

async function getShopMessage(
	interaction: ButtonInteraction<'cached'> | AnySelectMenuInteraction<'cached'>,
	serverData: ServerSchema,
	page: number,
): Promise<InteractionReplyOptions & MessageEditOptions & InteractionUpdateOptions> {

	let roleMenuOptions: RestOrArray<SelectMenuComponentOptionData> = [{ label: 'Add another shop item', value: 'server-settings_shop_add' }];

	for (const shopItem of serverData.shop) {

		const discordRole = interaction.guild?.roles.cache.get(shopItem.roleId) ?? await interaction.guild?.roles.fetch(shopItem.roleId) ?? null;
		roleMenuOptions.push({ label: discordRole?.name ?? shopItem.roleId, value: `server-settings_shop_${shopItem.roleId}`, description: `${shopItem.requirement} ${shopItem.wayOfEarning}` });
	}

	if (roleMenuOptions.length > 25) {

		roleMenuOptions = roleMenuOptions.splice(page * 24, 24);
		roleMenuOptions.push({ label: 'Show more shop items', value: `server-settings_shop_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setAuthor({ name: serverData.name, iconURL: interaction.guild?.iconURL() || undefined })
			.setTitle('Settings ➜ Shop')
			.setDescription('The shop is a way for users to earn roles by ranking up, leveling up or spending their XP. You can configure this to your liking.')],
		components: [new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(`server-settings_mainpage_@${interaction.user.id}`)
				.setLabel('Back')
				.setEmoji('⬅️')
				.setStyle(ButtonStyle.Secondary)]),
		new ActionRowBuilder<StringSelectMenuBuilder>()
			.setComponents([new StringSelectMenuBuilder()
				.setCustomId(`server-settings_shop_options_@${interaction.user.id}`)
				.setPlaceholder('Select to add/edit/delete a shop item')
				.setOptions(roleMenuOptions)])],
	};
}

async function getNewRoleMenu(
	interaction: AnySelectMenuInteraction<'cached'>,
	serverData: ServerSchema,
	page: number,
): Promise<RoleSelectMenuBuilder> {

	let roles = await interaction.guild.roles.fetch();
	roles = roles.filter(role => role.id !== role.guild.id && !serverData.shop.some(shopItem => shopItem.roleId === role.id));

	let roleMenuOptions: RestOrArray<SelectMenuComponentOptionData> = roles.map(role => ({ label: role.name, value: `server-settings_shop_add_${role.id}` }));

	if (roleMenuOptions.length > 25) {

		roleMenuOptions = roleMenuOptions.splice(page * 24, 24);
		roleMenuOptions.push({ label: 'Show more roles', value: `server-settings_shop_add_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	// This should be a RoleSelectMenu
	return new RoleSelectMenuBuilder()
		.setCustomId(`server-settings_shop_add_options_@${interaction.user.id}`)
		.setPlaceholder('Select a role for users to earn/buy')
		.setMaxValues(1);
}

function getShopRoleMessage(interaction: ButtonInteraction<'cached'> | AnySelectMenuInteraction<'cached'>, roleMenu: StringSelectMenuBuilder | RoleSelectMenuBuilder | null, roleIdOrAdd: string, serverData: ServerSchema, wayOfEarning: ServerSchema['shop'][number]['wayOfEarning'] | null, requirement: ServerSchema['shop'][number]['requirement'] | null, role: ServerSchema['shop'][number]['roleId'] | null): { embeds: Array<EmbedBuilder>, components: Array<ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder | RoleSelectMenuBuilder>>; } {

	const isNotSavable = wayOfEarning === null || requirement === null || role === null;
	const lastRowButtons = [
		...(isNotSavable ? [] :
			[new ButtonBuilder()
				.setCustomId(`server-settings_shop_save_@${interaction.user.id}`)
				.setLabel('Save')
				.setStyle(ButtonStyle.Success)]),
		...(serverData.shop.some(shopItem => shopItem.roleId === roleIdOrAdd) ?
			[new ButtonBuilder()
				.setCustomId(`server-settings_shop_delete_@${interaction.user.id}`)
				.setLabel('Delete')
				.setStyle(ButtonStyle.Danger)] : []),
	];

	return {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setAuthor({ name: serverData.name, iconURL: interaction.guild?.iconURL() || undefined })
			.setTitle(`Settings ➜ Shop ➜ ${roleIdOrAdd === 'add' ? 'New' : 'Edit'} role`)
			.setDescription(`**Role:** ${role === null ? 'Not selected' : `<@&${role}>`}\n**Requirement:** ${wayOfEarning === null ? 'Not selected' : `${requirement === null ? 'unspecified' : String(requirement)} ${wayOfEarning}`}\n\nTip: When selecting experience points as the way of earning, anything between 1,000 and 10,000 XP is recommended as a requirement, 1,000 XP being easy to achieve, and 10,000 being hard to achieve.`)
			.setFooter({ text: 'Make sure to save before clicking "back", otherwise your changes will be lost.' })],
		components: [
			new ActionRowBuilder<ButtonBuilder>()
				.setComponents([new ButtonBuilder()
					.setCustomId(`server-settings_shop_@${interaction.user.id}`)
					.setLabel('Back')
					.setEmoji('⬅️')
					.setStyle(ButtonStyle.Secondary)]),
			/* Only add a role selector if this is to add and not edit a role */
			...(roleMenu ? [new ActionRowBuilder<StringSelectMenuBuilder|RoleSelectMenuBuilder>()
				.setComponents([roleMenu])] : []),
			/* Select a way of earning (experience, levels, rank) */
			new ActionRowBuilder<StringSelectMenuBuilder>()
				.setComponents([new StringSelectMenuBuilder()
					.setCustomId(`server-settings_shop_wayofearning_@${interaction.user.id}`)
					.setPlaceholder('Select the way of earning the role')
					.setOptions(
						{ value: `server-settings_shop_wayofearning_${WayOfEarningType.Experience}`, label: 'Experience Points', description: 'Users can buy this role by spending XP' },
						{ value: `server-settings_shop_wayofearning_${WayOfEarningType.Levels}`, label: 'Levels', description: 'Users earn this role when reaching a level' },
						{ value: `server-settings_shop_wayofearning_${WayOfEarningType.Rank}`, label: 'Rank', description: 'Users earn this role when reaching a rank' },
					)]),
			/* When no way of earning is selected, do not have this, if the way of earning is rank, make it a select for a required rank, else make it a button that opens a modal */
			...(wayOfEarning === null ? [] :
				[new ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>()
					.setComponents(wayOfEarning === WayOfEarningType.Rank ? [new StringSelectMenuBuilder()
						.setCustomId(`server-settings_shop_requirements_@${interaction.user.id}`)
						.setPlaceholder('Select a required rank')
						.setOptions(
							{ value: `server-settings_shop_requirements_${RankType.Youngling}`, label: RankType.Youngling },
							{ value: `server-settings_shop_requirements_${RankType.Apprentice}`, label: RankType.Apprentice },
							{ value: `server-settings_shop_requirements_${RankType.Healer}`, label: RankType.Healer },
							{ value: `server-settings_shop_requirements_${RankType.Hunter}`, label: RankType.Hunter },
							{ value: `server-settings_shop_requirements_${RankType.Elderly}`, label: RankType.Elderly },
						)] :
						[new ButtonBuilder()
							.setCustomId(`server-settings_shop_requirementsmodal_@${interaction.user.id}`)
							.setLabel('Set a required number to reach')
							.setStyle(ButtonStyle.Secondary)])]),
			/* If it's savable, have a save button to save progress and if it's a shop item that's edited, have a delete button */
			...(lastRowButtons.length > 0 ? [new ActionRowBuilder<ButtonBuilder>()
				.setComponents(lastRowButtons)] : []),
		],
	};
}

async function getUpdateMessage(
	interaction: AnySelectMenuInteraction<'cached'>,
	serverData: ServerSchema,
	page: number,
): Promise<InteractionReplyOptions & MessageEditOptions & InteractionUpdateOptions> {

	let updatesMenuOptions: RestOrArray<SelectMenuComponentOptionData> = (await interaction.guild.channels.fetch()).filter((c): c is TextChannel => c !== null && c.type === ChannelType.GuildText).map(channel => ({ label: channel.name, value: `server-settings_updates_${channel.id}` }));

	if (updatesMenuOptions.length > 25) {

		updatesMenuOptions = updatesMenuOptions.splice(page * 24, 24);
		updatesMenuOptions.push({ label: 'Show more channels', value: `server-settings_updates_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setAuthor({ name: serverData.name, iconURL: interaction.guild?.iconURL() || undefined })
			.setTitle('Settings ➜ Updates')
			.setDescription('Selecting a channel means that it will follow the updates channel on the [Paw and Paper Support Server](https://discord.gg/9DENgj8q5Q). To learn more about channel following and how to remove a followed channel, read [Discord\'s FAQ](https://support.discord.com/hc/en-us/articles/360028384531-Channel-Following-FAQ).')],
		components: [new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(`server-settings_mainpage_@${interaction.user.id}`)
				.setLabel('Back')
				.setEmoji('⬅️')
				.setStyle(ButtonStyle.Secondary)]),
		new ActionRowBuilder<StringSelectMenuBuilder>()
			// This should be a ChannelSelectMenu
			.setComponents([new StringSelectMenuBuilder()
				.setCustomId(`server-settings_updates_options_@${interaction.user.id}`)
				.setPlaceholder('Select a channel to send updates to')
				.setOptions(updatesMenuOptions)])],
	};
}

async function getVisitsMessage(
	interaction: AnySelectMenuInteraction<'cached'>,
	serverData: ServerSchema,
	page: number,
): Promise<InteractionReplyOptions & MessageEditOptions & InteractionUpdateOptions> {

	let updatesMenuOptions: RestOrArray<SelectMenuComponentOptionData> = [{ label: 'off', value: 'server-settings_visits_off', emoji: serverData.visitChannelId === null ? '🔘' : undefined }, ...(await interaction.guild.channels.fetch()).filter((c): c is TextChannel => c !== null && c.type === ChannelType.GuildText).map(channel => ({ label: channel!.name, value: `server-settings_visits_${channel.id}`, emoji: serverData.visitChannelId === channel.id ? '🔘' : undefined }))];

	if (updatesMenuOptions.length > 25) {

		updatesMenuOptions = updatesMenuOptions.splice(page * 24, 24);
		updatesMenuOptions.push({ label: 'Show more channels', value: `server-settings_visits_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setAuthor({ name: serverData.name, iconURL: interaction.guild?.iconURL() || undefined })
			.setTitle('Settings ➜ Visits')
			.setDescription('Selecting a channel means that users can connect with other servers that have this feature turned on through that channel. The current selected option has a radio emoji next to it.')],
		components: [new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(`server-settings_mainpage_@${interaction.user.id}`)
				.setLabel('Back')
				.setEmoji('⬅️')
				.setStyle(ButtonStyle.Secondary)]),
		new ActionRowBuilder<StringSelectMenuBuilder>()
			// This should be a ChannelSelectMenu
			.setComponents([new StringSelectMenuBuilder()
				.setCustomId(`server-settings_visits_options_@${interaction.user.id}`)
				.setPlaceholder('Select a channel to set visits to')
				.setOptions(updatesMenuOptions)])],
	};
}

async function getProxyingMessage(
	interaction: AnySelectMenuInteraction<'cached'> | ButtonInteraction<'cached'>,
	serverData: ServerSchema,
	page: number,
): Promise<InteractionReplyOptions & MessageEditOptions & InteractionUpdateOptions> {

	// This should use selected options with the select menu allowing up to 25 selected options
	const setTo = serverData.proxySettings.channels.setTo === ProxyListType.Blacklist ? 'blacklist' : 'whitelist';
	let disableSelectMenuOptions: RestOrArray<SelectMenuComponentOptionData> = (await interaction.guild.channels.fetch()).filter((c): c is TextChannel => c !== null && c.type === ChannelType.GuildText).map((channel, channelId) => ({ label: channel.name, value: `server-settings_proxying_${channelId}`, emoji: serverData.proxySettings.channels[setTo].includes(channelId) ? '🔘' : undefined }));

	if (disableSelectMenuOptions.length > 25) {

		disableSelectMenuOptions = disableSelectMenuOptions.splice(page * 24, 24);
		disableSelectMenuOptions.push({ label: 'Show more channels', value: `server-settings_proxying_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setAuthor({ name: serverData.name, iconURL: interaction.guild?.iconURL() || undefined })
			.setTitle('Settings ➜ Proxying')
			.setDescription('This toggles in which channels proxying should be disabled or enabled, using the drop-down menu below. Selected channels will have a radio emoji next to them. When it is set to blacklist, proxying is *only disabled* in the selected channels. When it is set to whitelist, proxying is *only enabled* in the selected channels.')],
		components: [new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(`server-settings_mainpage_@${interaction.user.id}`)
				.setLabel('Back')
				.setEmoji('⬅️')
				.setStyle(ButtonStyle.Secondary)]),
		new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(`server-settings_proxying_setTo_@${interaction.user.id}`)
				.setLabel(`Currently set to ${serverData.proxySettings.channels.setTo === ProxyListType.Blacklist ? 'blacklist' : 'whitelist'}`)
				.setStyle(ButtonStyle.Secondary)]),
		new ActionRowBuilder<StringSelectMenuBuilder>()
			.setComponents([new StringSelectMenuBuilder()
				.setCustomId(`server-settings_proxying_options_@${interaction.user.id}`)
				.setPlaceholder(`Select channels to ${serverData.proxySettings.channels.setTo === ProxyListType.Blacklist ? 'disable' : 'enable'} proxying for`)
				.setOptions(disableSelectMenuOptions)])],
	};
}