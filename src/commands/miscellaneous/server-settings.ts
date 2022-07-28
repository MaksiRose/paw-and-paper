import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChannelType, ChatInputCommandInteraction, EmbedBuilder, InteractionCollector, InteractionReplyOptions, InteractionType, InteractionUpdateOptions, MessageEditOptions, ModalBuilder, PermissionFlagsBits, RestOrArray, SelectMenuBuilder, SelectMenuComponentOptionData, SelectMenuInteraction, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { respond } from '../../events/interactionCreate';
import serverModel from '../../models/serverModel';
import userModel from '../../models/userModel';
import { RankType, ServerSchema, SlashCommand, WayOfEarningType } from '../../typedef';
import { checkLevelRequirements, checkRankRequirements } from '../../utils/checkRoleRequirements';
import { getMapData } from '../../utils/getInfo';
const { default_color, update_channel_id } = require('../../../config.json');

const name: SlashCommand['name'] = 'server-settings';
const description: SlashCommand['description'] = 'List of server-specific settings like shop roles, update notifications and more.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels + PermissionFlagsBits.ManageRoles)
		.toJSON(),
	disablePreviousCommand: false,
	sendCommand: async (client, interaction, userData, serverData) => {

		// It should give you a message with the a drop-down of menus:
		// shop (which has add, delete, edit), updates, visits, proxying (which as only disable all or disable auto right now)
		// Clicking these should edit the message with the current embed, a first row button that says "⬅️ Back", and any other needed components
		// If the command is nested (as in, you need to click another option to be brought into a sub-sub-setting), the "⬅️ Back" button should only bring you back one level
		// That way you can basically go through the command as if it was a folder

		/* It's checking if the message is in a guild, and if it is, it's checking if the guild is in the database. If it's not, it throws an error. Else, it's responding with the original message */
		if (!serverData || !interaction.inCachedGuild()) { throw new Error('Message is not in configured guild'); }

		await respond(interaction, getOriginalMessage(interaction, serverData), true)
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	},
};

export async function serversettingsInteractionCollector(interaction: ButtonInteraction | SelectMenuInteraction, serverData: ServerSchema) {

	if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild'); }
	const selectOptionId = interaction.isSelectMenu() ? interaction.values[0] : undefined;

	/* It's checking if the interaction is a button that leads back to the main page, and it's updating the message with the main page content. */
	if (interaction.isButton() && interaction.customId === 'serversettings_mainpage') {

		await interaction
			.update(getOriginalMessage(interaction, serverData))
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	/* It's checking if the interaction value or customId includes shop, and sends a message if it does. */
	if ((interaction.isButton() && interaction.customId === 'serversettings_shop') || (interaction.isSelectMenu() && interaction.values[0] === 'serversettings_shop')) {

		await interaction
			.update(await getShopMessage(interaction, serverData, 0))
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	/* It's checking if the interaction is the shop select menu. */
	if (interaction.isSelectMenu() && selectOptionId && interaction.customId === 'serversettings_shop_options') {

		/* It's checking if the value is for turning a page. If it is, it's getting the page number from the value, and it's updating the message with the shop message with the page number. */
		if (selectOptionId.includes('nextpage')) {

			const page = Number(selectOptionId.split('_')[3]);

			await interaction
				.update(await getShopMessage(interaction, serverData, page))
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}
		else {

			const roleIdOrAdd = selectOptionId.split('_')[2] || '';

			let rolePage = 0;
			let role: ServerSchema['shop'][number]['roleId'] | null = serverData.shop.find(shopItem => shopItem.roleId === roleIdOrAdd)?.roleId || null;
			let wayOfEarning: ServerSchema['shop'][number]['wayOfEarning'] | null = serverData.shop.find(shopItem => shopItem.roleId === role)?.wayOfEarning || null;
			let requirement: ServerSchema['shop'][number]['requirement'] | null = serverData.shop.find(shopItem => shopItem.roleId === role)?.requirement || null;
			let roleMenu = await async function() {

				if (roleIdOrAdd !== 'add') { return null; }

				return await getNewRoleMenu(interaction, serverData, rolePage);
			}();

			await interaction
				.update(getShopRoleMessage(interaction, roleMenu, roleIdOrAdd, serverData, wayOfEarning, requirement, role))
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});

			const modalCollector = new InteractionCollector(interaction.client, { channel: interaction.channel || undefined, interactionType: 5, message: interaction.message });

			const interactionCollector = interaction.message.createMessageComponentCollector({ filter: (i) => i.user.id === interaction.user.id, idle: 1_800_000 }); // idle for 30 minutes

			interactionCollector.on('collect', async i => {

				const collectorSelectOptionId = i.isSelectMenu() ? i.values[0] : undefined;

				if (i.isButton() && i.customId === 'serversettings_shop') { interactionCollector.stop('back'); }

				if (i.isSelectMenu() && collectorSelectOptionId && i.customId === 'serversettings_shop_add_options') {

					if (collectorSelectOptionId.startsWith('serversettings_shop_add_nextpage_')) {

						rolePage = Number(collectorSelectOptionId.replace('serversettings_shop_add_nextpage_', ''));
						roleMenu = await getNewRoleMenu(i, serverData, rolePage).catch(() => { return null; });
					}
					else { role = collectorSelectOptionId.replace('serversettings_shop_add_', ''); }

					await i
						.update(getShopRoleMessage(i, roleMenu, roleIdOrAdd, serverData, wayOfEarning, requirement, role))
						.catch(error => { console.error(error); });
				}

				if (i.isSelectMenu() && collectorSelectOptionId && i.customId === 'serversettings_shop_wayofearning') {

					wayOfEarning = collectorSelectOptionId.replace('serversettings_shop_wayofearning_', '') as WayOfEarningType;
					requirement = null;
					await i
						.update(getShopRoleMessage(i, roleMenu, roleIdOrAdd, serverData, wayOfEarning, requirement, role))
						.catch(error => { console.error(error); });
				}

				if (i.isSelectMenu() && collectorSelectOptionId && i.customId === 'serversettings_shop_requirements') {

					requirement = collectorSelectOptionId.replace('serversettings_shop_requirements_', '') as RankType;
					await i
						.update(getShopRoleMessage(i, roleMenu, roleIdOrAdd, serverData, wayOfEarning, requirement, role))
						.catch(error => { console.error(error); });
				}

				if (i.isButton() && i.customId === 'serversettings_shop_requirementsmodal') {

					await i
						.showModal(new ModalBuilder()
							.setCustomId('serversettings_shop_requirements')
							.setTitle('Change requirement')
							.addComponents(
								new ActionRowBuilder<TextInputBuilder>()
									.setComponents([new TextInputBuilder()
										.setCustomId('serversettings_shop_requirements_textinput')
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

				if (i.isButton() && i.customId === 'serversettings_shop_save') {

					/* Check if role, wayOfEarning or requirement is null */
					if (role === null || wayOfEarning === null || requirement === null) {

						await i
							.reply({ content: 'Something went wrong. You shouldn\'t be able to save yet, either the role, way of earning or requirement is missing.', ephemeral: true })
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

					/* Reply to the user that the role is configured */
					await i
						.reply({
							content: `<@&${role}> ${roleIdOrAdd === 'add' ? 'added to the shop' : 'edited'}! The requirement is ${requirement} ${wayOfEarning}.`,
							ephemeral: true,
						})
						.catch(error => { console.error(error); });

					/* Get all the users that have at least one character with a profile on this server */
					const allServerUsers = await userModel.find(
						(u) => {
							return Object.values(u.characters).filter(c => c.profiles[i.guildId] !== undefined).length > 0;
						});

					for (const u of Object.values(allServerUsers)) {

						for (const c of Object.values(u.characters)) {

							const p = c.profiles[i.guildId];
							if (p !== undefined) {

								/* Update the user by checking if there is a role with the roleId, and if there is, deleting it */
								await userModel.findOneAndUpdate(
									user => user.uuid === u.uuid,
									(user) => {
										const prof = getMapData(getMapData(user.characters, c._id).profiles, p.serverId);
										prof.roles = prof.roles.filter(r => r.roleId !== role);
									},
								);

								/* Giving users the role if they meet the requirements or removing it if they don't. */
								if (wayOfEarning === WayOfEarningType.Levels) {

									const member = await i.guild.members.fetch(u.userId[0] || '').catch(() => { return undefined; });
									await checkLevelRequirements(serverData, i, member, p.levels, false);

									if (p.levels < requirement && member && member.roles.cache.has(role)) {

										await member.roles
											.remove(role)
											.catch(error => { console.error(error); });
									}
								}

								if (wayOfEarning === WayOfEarningType.Rank && typeof requirement === 'string') {

									const member = await i.guild.members.fetch(u.userId[0] || '').catch(() => { return undefined; });
									await checkRankRequirements(serverData, i, member, p.rank, false);

									const rankList = { Youngling: 0, Apprentice: 1, Hunter: 2, Healer: 2, Elderly: 2 };
									if (rankList[p.rank] < rankList[requirement] && member && member.roles.cache.has(role)) {

										await member.roles
											.remove(role)
											.catch(error => { console.error(error); });
									}
								}

								if (wayOfEarning === WayOfEarningType.Experience) {

									const member = await i.guild.members.fetch(u.userId[0] || '').catch(() => { return undefined; });
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

				if (i.isButton() && i.customId === 'serversettings_shop_delete') {

					// deleted shop items must be checked to be deleted/removed for all users
					// send a success ephemeral message to the user
					// after this, stop the collector with reason 'delete'

					/* Check if role, wayOfEarning or requirement is null */
					if (role === null || wayOfEarning === null || requirement === null) {

						await i
							.reply({ content: 'Something went wrong. You shouldn\'t be able to save yet, either the role, way of earning or requirement is missing.', ephemeral: true })
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

					/* Reply to the user that the role is configured */
					await i
						.reply({
							content: `<@&${role}> with the requirement of ${requirement} ${wayOfEarning} was deleted from the shop.`,
							ephemeral: true,
						})
						.catch(error => { console.error(error); });

					/* Get all the users that have at least one character with a profile on this server */
					const allServerUsers = await userModel.find(
						(u) => {
							return Object.values(u.characters).filter(c => c.profiles[i.guildId] !== undefined).length > 0;
						});

					for (const u of Object.values(allServerUsers)) {

						for (const c of Object.values(u.characters)) {

							const p = c.profiles[i.guildId];
							if (p !== undefined) {

								/* Update the user by checking if there is a role with the roleId, and if there is, deleting it */
								await userModel.findOneAndUpdate(
									user => user.uuid === u.uuid,
									(user) => {
										const prof = getMapData(getMapData(user.characters, c._id).profiles, p.serverId);
										prof.roles = prof.roles.filter(r => r.roleId !== role);
									},
								);

								/* Remove the role from users that have it. */
								const member = await i.guild.members.fetch(u.userId[0] || '').catch(() => { return undefined; });

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
			});

			modalCollector.on('collect', async i => {

				if (i.type === InteractionType.ModalSubmit && i.isFromMessage()) {

					const modalTextInput = Number(i.fields.getTextInputValue('serversettings_shop_requirements_textinput'))
						;

					if (Number.isInteger(Number(modalTextInput)) === false || Number(modalTextInput) <= 0) {

						await i
							.reply({ content: 'Please only input positive numbers without any commas or dots!', ephemeral: true })
							.catch(error => { console.error(error); });
						return;
					}

					requirement = modalTextInput;
					await i
						.update(getShopRoleMessage(interaction, roleMenu, roleIdOrAdd, serverData, wayOfEarning, requirement, role))
						.catch(error => { console.error(error); });
					return;
				}
			});

			interactionCollector.on('end', async (collected, reason) => {

				modalCollector.stop(reason);

				if (reason !== 'back') {

					await interaction.message
						.edit(await getShopMessage(interaction, serverData, 0))
						.catch((error) => {
							if (error.httpStatus !== 404) { console.error(error); }
						});
					return;
				}
			});
		}
	}

	/* It's checking if the interaction value includes updates, and sends a message if it does. */
	if (interaction.isSelectMenu() && interaction.values[0] === 'serversettings_updates') {

		await interaction
			.update(await getUpdateMessage(interaction, serverData, 0))
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	/* It's checking if the interaction is the updates select menu */
	if (interaction.isSelectMenu() && selectOptionId && interaction.customId === 'serversettings_updates_options') {

		/* It's checking if the value is for turning a page. If it is, it's getting the page number from the value, and it's updating the message with the shop message with the page number. */
		if (selectOptionId.includes('nextpage')) {

			const page = Number(selectOptionId.split('_')[3]);

			await interaction
				.update(await getUpdateMessage(interaction, serverData, page))
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}
		else {

			const channelId = selectOptionId.split('_')[2];
			if (!channelId) { throw new Error('Missing channelId'); }

			const newsChannel = await interaction.client.channels.fetch(update_channel_id);
			if (!newsChannel || newsChannel.type !== ChannelType.GuildNews) { throw new Error('News Channel is missing or not of type GuildNews.'); }

			await newsChannel.addFollower(channelId);

			await respond(interaction, {
				content: `Updates are now posted to <#${channelId}>!`,
				ephemeral: true,
			}, false)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});

			await interaction.message
				.edit(getOriginalMessage(interaction, serverData))
				.catch((error) => {
					if (error.httpStatus !== 404) { console.error(error); }
				});
			return;
		}
	}

	/* It's checking if the interaction value includes visits, and sends a message if it does. */
	if (interaction.isSelectMenu() && interaction.values[0] === 'serversettings_visits') {

		await interaction
			.update(await getVisitsMessage(interaction, serverData, 0))
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	/* It's checking if the interaction is the visits select menu */
	if (interaction.isSelectMenu() && selectOptionId && interaction.customId === 'serversettings_visits_options') {

		/* It's checking if the value is for turning a page. If it is, it's getting the page number from the value, and it's updating the message with the shop message with the page number. */
		if (selectOptionId.includes('nextpage')) {

			const page = Number(selectOptionId.split('_')[3]);

			await interaction
				.update(await getVisitsMessage(interaction, serverData, page))
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}
		else {

			const channelIdOrOff = selectOptionId.split('_')[2];
			if (!channelIdOrOff) { throw new Error('Missing channelId'); }

			if (channelIdOrOff === 'off') {

				await serverModel.findOneAndUpdate(
					s => s.serverId === interaction.guildId,
					(s) => {
						s.visitChannelId = null;
					},
				);

				await respond(interaction, {
					content: 'Visits have successfully been turned off!',
					ephemeral: true,
				}, false)
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
			}
			else {

				await serverModel.findOneAndUpdate(
					s => s.serverId === interaction.guildId,
					(s) => {
						s.visitChannelId = channelIdOrOff;
					},
				);

				await respond(interaction, {
					content: `Visits are now possible in <#${channelIdOrOff}>!`,
					ephemeral: true,
				}, false)
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
			}

			await interaction.message
				.edit(getOriginalMessage(interaction, serverData))
				.catch((error) => {
					if (error.httpStatus !== 404) { console.error(error); }
				});
			return;
		}
	}

	/* It's checking if the interaction value includes visits, and sends a message if it does. */
	if (interaction.isSelectMenu() && interaction.values[0] === 'serversettings_proxying') {

		await interaction
			.update(await getProxyingMessage(interaction, serverData, 0))
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	/* It's checking if the interaction is the visits select menu */
	if (interaction.isSelectMenu() && selectOptionId && interaction.customId === 'serversettings_proxying_options') {

		/* It's checking if the value is for turning a page. If it is, it's getting the page number from the value, and it's updating the message with the shop message with the page number. */
		if (selectOptionId.includes('nextpage')) {

			const page = Number(selectOptionId.split('_')[3]);

			await interaction
				.update(await getProxyingMessage(interaction, serverData, page))
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}
		else {

			const channelId = selectOptionId.replace('serversettings_proxying_', '');
			const hasChannel = serverData && serverData.proxySettings.channels.blacklist.includes(channelId);

			serverData = await serverModel.findOneAndUpdate(
				s => s.serverId === interaction.guildId,
				(s) => {
					if (!hasChannel) { s.proxySettings.channels.blacklist.push(channelId); }
					else { s.proxySettings.channels.blacklist = s.proxySettings.channels.blacklist.filter(string => string !== channelId); }
				},
			);

			await respond(interaction, {
				content: `${hasChannel ? 'Enabled' : 'Disabled'} proxying in <#${channelId}>!`,
				ephemeral: true,
			}, false)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});

			await interaction.message
				.edit(await getProxyingMessage(interaction, serverData, 0))
				.catch((error) => {
					if (error.httpStatus !== 404) { console.error(error); }
				});
			return;
		}
	}
}

function getOriginalMessage(interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'> | SelectMenuInteraction<'cached'>, serverData: ServerSchema): InteractionReplyOptions & MessageEditOptions & InteractionUpdateOptions {

	return {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setAuthor({ name: serverData.name, iconURL: interaction.guild?.iconURL() || undefined })
			.setTitle('Select what you want to configure from the drop-down menu below.')],
		components: [new ActionRowBuilder<SelectMenuBuilder>()
			.setComponents([new SelectMenuBuilder()
				.setCustomId('serversettings_options')
				.setPlaceholder('Select an option to configure')
				.setOptions(
					{ value: 'serversettings_shop', label: 'Shop', description: 'Add, delete or edit earnable roles' },
					{ value: 'serversettings_updates', label: 'Updates', description: 'Get updates for new releases sent to a channel' },
					{ value: 'serversettings_visits', label: 'Visits', description: 'Configure a channel to connect with other servers' },
					{ value: 'serversettings_proxying', label: 'Proxying', description: 'Disable auto- or all proxying in specific channels or everywhere' },
				)])],
	};
}

async function getShopMessage(interaction: ButtonInteraction<'cached'> | SelectMenuInteraction<'cached'>, serverData: ServerSchema, page: number): Promise<InteractionReplyOptions & MessageEditOptions & InteractionUpdateOptions> {

	let roleMenuOptions: RestOrArray<SelectMenuComponentOptionData> = [{ label: 'Add another shop item', value: 'serversettings_shop_add' }];

	for (const shopItem of serverData.shop) {

		const discordRole = interaction.guild?.roles.cache.get(shopItem.roleId) ?? await interaction.guild?.roles.fetch(shopItem.roleId) ?? null;
		roleMenuOptions.push({ label: discordRole?.name ?? shopItem.roleId, value: `serversettings_shop_${shopItem.roleId}`, description: `${shopItem.requirement} ${shopItem.wayOfEarning}` });
	}

	if (roleMenuOptions.length > 25) {

		roleMenuOptions = roleMenuOptions.splice(page * 24, 24);
		roleMenuOptions.push({ label: 'Show more shop items', value: `serversettings_shop_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setAuthor({ name: serverData.name, iconURL: interaction.guild?.iconURL() || undefined })
			.setTitle('Settings ➜ Shop')
			.setDescription('The shop is a way for users to earn roles by ranking up, leveling up or spending their XP. You can configure this to your liking.')],
		components: [new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId('serversettings_mainpage')
				.setLabel('Back')
				.setEmoji('⬅️')
				.setStyle(ButtonStyle.Secondary)]),
		new ActionRowBuilder<SelectMenuBuilder>()
			.setComponents([new SelectMenuBuilder()
				.setCustomId('serversettings_shop_options')
				.setPlaceholder('Select to add/edit/delete a shop item')
				.setOptions(roleMenuOptions)])],
	};
}

async function getNewRoleMenu(interaction: SelectMenuInteraction<'cached'>, serverData: ServerSchema, page: number): Promise<SelectMenuBuilder> {

	if (!interaction.guild) { throw new Error('Guild object is null'); }
	let roles = await interaction.guild.roles.fetch();
	roles = roles.filter(role => role.id !== role.guild.id && !serverData.shop.some(shopItem => shopItem.roleId === role.id));

	let roleMenuOptions: RestOrArray<SelectMenuComponentOptionData> = roles.map(role => ({ label: role.name, value: `serversettings_shop_add_${role.id}` }));

	if (roleMenuOptions.length > 25) {

		roleMenuOptions = roleMenuOptions.splice(page * 24, 24);
		roleMenuOptions.push({ label: 'Show more roles', value: `serversettings_shop_add_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return new SelectMenuBuilder()
		.setCustomId('serversettings_shop_add_options')
		.setPlaceholder('Select a role for users to earn/buy')
		.setOptions(roleMenuOptions);
}

function getShopRoleMessage(interaction: ButtonInteraction<'cached'> | SelectMenuInteraction<'cached'>, roleMenu: SelectMenuBuilder | null, roleIdOrAdd: string, serverData: ServerSchema, wayOfEarning: ServerSchema['shop'][number]['wayOfEarning'] | null, requirement: ServerSchema['shop'][number]['requirement'] | null, role: ServerSchema['shop'][number]['roleId'] | null): { embeds: Array<EmbedBuilder>, components: Array<ActionRowBuilder<SelectMenuBuilder | ButtonBuilder>>; } {

	const isNotSavable = wayOfEarning === null || requirement === null || role === null;
	const lastRowButtons = [
		...(isNotSavable ? [] :
			[new ButtonBuilder()
				.setCustomId('serversettings_shop_save')
				.setLabel('Save')
				.setStyle(ButtonStyle.Success)]),
		...(serverData.shop.some(shopItem => shopItem.roleId === roleIdOrAdd) ?
			[new ButtonBuilder()
				.setCustomId('serversettings_shop_delete')
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
					.setCustomId('serversettings_shop')
					.setLabel('Back')
					.setEmoji('⬅️')
					.setStyle(ButtonStyle.Secondary)]),
			/* Only add a role selector if this is to add and not edit a role */
			...(roleMenu ? [new ActionRowBuilder<SelectMenuBuilder>()
				.setComponents([roleMenu])] : []),
			/* Select a way of earning (experience, levels, rank) */
			new ActionRowBuilder<SelectMenuBuilder>()
				.setComponents([new SelectMenuBuilder()
					.setCustomId('serversettings_shop_wayofearning')
					.setPlaceholder('Select the way of earning the role')
					.setOptions(
						{ value: `serversettings_shop_wayofearning_${WayOfEarningType.Experience}`, label: 'Experience Points', description: 'Users can buy this role by spending XP' },
						{ value: `serversettings_shop_wayofearning_${WayOfEarningType.Levels}`, label: 'Levels', description: 'Users earn this role when reaching a level' },
						{ value: `serversettings_shop_wayofearning_${WayOfEarningType.Rank}`, label: 'Rank', description: 'Users earn this role when reaching a rank' },
					)]),
			/* When no way of earning is selected, do not have this, if the way of earning is rank, make it a select for a required rank, else make it a button that opens a modal */
			...(wayOfEarning === null ? [] :
				[new ActionRowBuilder<SelectMenuBuilder | ButtonBuilder>()
					.setComponents(wayOfEarning === WayOfEarningType.Rank ? [new SelectMenuBuilder()
						.setCustomId('serversettings_shop_requirements')
						.setPlaceholder('Select a required rank')
						.setOptions(
							{ value: `serversettings_shop_requirements_${RankType.Youngling}`, label: RankType.Youngling },
							{ value: `serversettings_shop_requirements_${RankType.Apprentice}`, label: RankType.Apprentice },
							{ value: `serversettings_shop_requirements_${RankType.Healer}`, label: RankType.Healer },
							{ value: `serversettings_shop_requirements_${RankType.Hunter}`, label: RankType.Hunter },
							{ value: `serversettings_shop_requirements_${RankType.Elderly}`, label: RankType.Elderly },
						)] :
						[new ButtonBuilder()
							.setCustomId('serversettings_shop_requirementsmodal')
							.setLabel('Set a required number to reach')
							.setStyle(ButtonStyle.Secondary)])]),
			/* If it's savable, have a save button to save progress and if it's a shop item that's edited, have a delete button */
			...(lastRowButtons.length > 0 ? [new ActionRowBuilder<ButtonBuilder>()
				.setComponents(lastRowButtons)] : []),
		],
	};
}

async function getUpdateMessage(interaction: SelectMenuInteraction<'cached'>, serverData: ServerSchema, page: number): Promise<InteractionReplyOptions & MessageEditOptions & InteractionUpdateOptions> {

	let updatesMenuOptions: RestOrArray<SelectMenuComponentOptionData> = (await interaction.guild.channels.fetch()).map(channel => ({ label: channel.name, value: `serversettings_updates_${channel.id}` }));

	if (updatesMenuOptions.length > 25) {

		updatesMenuOptions = updatesMenuOptions.splice(page * 24, 24);
		updatesMenuOptions.push({ label: 'Show more channels', value: `serversettings_updates_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setAuthor({ name: serverData.name, iconURL: interaction.guild?.iconURL() || undefined })
			.setTitle('Settings ➜ Updates')
			.setDescription('Selecting a channel means that it will follow the updates channel on the [Paw and Paper Support Server](https://discord.gg/9DENgj8q5Q). To learn more about channel following and how to remove a followed channel, read [Discord\'s FAQ](https://support.discord.com/hc/en-us/articles/360028384531-Channel-Following-FAQ).')],
		components: [new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId('serversettings_mainpage')
				.setLabel('Back')
				.setEmoji('⬅️')
				.setStyle(ButtonStyle.Secondary)]),
		new ActionRowBuilder<SelectMenuBuilder>()
			.setComponents([new SelectMenuBuilder()
				.setCustomId('serversettings_updates_options')
				.setPlaceholder('Select a channel to send updates to')
				.setOptions(updatesMenuOptions)])],
	};
}

async function getVisitsMessage(interaction: SelectMenuInteraction<'cached'>, serverData: ServerSchema, page: number): Promise<InteractionReplyOptions & MessageEditOptions & InteractionUpdateOptions> {

	let updatesMenuOptions: RestOrArray<SelectMenuComponentOptionData> = [{ label: 'off', value: 'serversettings_visits_off', emoji: serverData.visitChannelId === null ? '🔘' : undefined }, ...(await interaction.guild.channels.fetch()).map(channel => ({ label: channel.name, value: `serversettings_visits_${channel.id}`, emoji: serverData.visitChannelId === channel.id ? '🔘' : undefined }))];

	if (updatesMenuOptions.length > 25) {

		updatesMenuOptions = updatesMenuOptions.splice(page * 24, 24);
		updatesMenuOptions.push({ label: 'Show more channels', value: `serversettings_visits_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setAuthor({ name: serverData.name, iconURL: interaction.guild?.iconURL() || undefined })
			.setTitle('Settings ➜ Visits')
			.setDescription('Selecting a channel means that users can connect with other servers that have this feature turned on through that channel. The current selected option has a radio emoji next to it.')],
		components: [new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId('serversettings_mainpage')
				.setLabel('Back')
				.setEmoji('⬅️')
				.setStyle(ButtonStyle.Secondary)]),
		new ActionRowBuilder<SelectMenuBuilder>()
			.setComponents([new SelectMenuBuilder()
				.setCustomId('serversettings_visits_options')
				.setPlaceholder('Select a channel to set visits to')
				.setOptions(updatesMenuOptions)])],
	};
}

async function getProxyingMessage(interaction: SelectMenuInteraction<'cached'>, serverData: ServerSchema, page: number): Promise<InteractionReplyOptions & MessageEditOptions & InteractionUpdateOptions> {

	let disableSelectMenuOptions: RestOrArray<SelectMenuComponentOptionData> = (await interaction.guild.channels.fetch()).map((channel, channelId) => ({ label: channel.name, value: `serversettings_proxying_${channelId}`, emoji: serverData?.proxySettings.channels.blacklist?.includes(channelId) ? '🔘' : undefined }));

	if (disableSelectMenuOptions.length > 25) {

		disableSelectMenuOptions = disableSelectMenuOptions.splice(page * 24, 24);
		disableSelectMenuOptions.push({ label: 'Show more channels', value: `serversettings_proxying_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setAuthor({ name: serverData.name, iconURL: interaction.guild?.iconURL() || undefined })
			.setTitle('Settings ➜ Proxying')
			.setDescription('This toggles whether proxying should be disabled or enabled in specific channels, or in the entire server, using the drop-down menus below. Selected options will have a radio emoji next to them.')],
		components: [new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId('serversettings_mainpage')
				.setLabel('Back')
				.setEmoji('⬅️')
				.setStyle(ButtonStyle.Secondary)]),
		new ActionRowBuilder<SelectMenuBuilder>()
			.setComponents([new SelectMenuBuilder()
				.setCustomId('serversettings_proxying_options')
				.setPlaceholder('Select channels to disable proxying for')
				.setOptions(disableSelectMenuOptions)])],
	};
}