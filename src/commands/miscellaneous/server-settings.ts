import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChannelType, ChatInputCommandInteraction, EmbedBuilder, InteractionReplyOptions, InteractionUpdateOptions, MessageEditOptions, ModalBuilder, PermissionFlagsBits, RestOrArray, StringSelectMenuBuilder, SelectMenuComponentOptionData, AnySelectMenuInteraction, SlashCommandBuilder, TextChannel, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder, channelMention, ModalMessageModalSubmitInteraction, Role } from 'discord.js';
import { deepCopy, respond } from '../../utils/helperFunctions';
import { missingPermissions } from '../../utils/permissionHandler';
import { SlashCommand } from '../../typings/handle';
import Server from '../../models/server';
import QuidToServer from '../../models/quidToServer';
import ProxyLimits from '../../models/proxyLimits';
import { Op } from 'sequelize';
import DiscordUserToServer from '../../models/discordUserToServer';
import GroupToServer from '../../models/groupToServer';
import UserToServer from '../../models/userToServer';
import { explainRuleset } from '../../utils/nameRules';
const { default_color, update_channel_id } = require('../../../config.json');

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('server-settings')
		.setDescription('List of server-specific settings like shop roles, update notifications and more.')
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels + PermissionFlagsBits.ManageRoles)
		.toJSON(),
	category: 'page3',
	position: 2,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction, { server }) => {

		// It should give you a message with the a drop-down of menus:
		// shop (which has add, delete, edit), updates, visits, proxying (which as only disable all or disable auto right now)
		// Clicking these should edit the message with the current embed, a first row button that says "⬅️ Back", and any other needed components
		// If the command is nested (as in, you need to click another option to be brought into a sub-sub-setting), the "⬅️ Back" button should only bring you back one level
		// That way you can basically go through the command as if it was a folder

		/* It's checking if the message is in a guild, and if it is, it's checking if the guild is in the database. If it's not, it throws an error. Else, it's responding with the original message */
		if (server === undefined || !interaction.inCachedGuild()) { throw new Error('Message is not in configured guild'); }

		// This is always a reply
		await respond(interaction, getOriginalMessage(interaction));
		return;
	},
	async sendMessageComponentResponse(interaction, { server }) {

		if (!server) { throw new Error('server is null'); }
		if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild'); }
		const selectOptionId = interaction.isAnySelectMenu() ? interaction.values[0] : undefined;

		/* It's checking if the interaction is a button that leads back to the main page, and it's updating the message with the main page content. */
		if (interaction.isButton() && interaction.customId.includes('mainpage')) {

			// This is always an update to the message with the button
			await respond(interaction, getOriginalMessage(interaction), 'update', interaction.message.id);
			return;
		}

		/* It's checking if the interaction value includes updates, and sends a message if it does. */
		if (interaction.isStringSelectMenu() && interaction.values[0] === 'updates') {

			if (await missingPermissions(interaction, [
				'ViewChannel', 'ManageWebhooks', // Needed to add the follower
			]) === true) { return; }

			// This is always an update to the message with the select menu
			await respond(interaction, await getUpdateMessage(interaction), 'update', interaction.message.id);
			return;
		}

		/* It's checking if the interaction is the updates select menu */
		if (interaction.isChannelSelectMenu() && selectOptionId && interaction.customId.includes('updates_options')) {

			const channelId = selectOptionId;

			const announcementChannel = await interaction.client.channels.fetch(update_channel_id);
			if (announcementChannel === null || announcementChannel.type !== ChannelType.GuildAnnouncement) { throw new Error('Announcement Channel is missing or not of type GuildAnnouncement.'); }

			await announcementChannel.addFollower(channelId);

			// This is always an update to the message with the select menu
			await respond(interaction, getOriginalMessage(interaction), 'update', interaction.message.id)
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

		if ((interaction.isStringSelectMenu() && interaction.values[0] === 'proxying') || (interaction.isButton() && interaction.customId.includes('server-settings_proxying_@'))) {

			// This is always an update to the message with the select menu
			await respond(interaction, await getProxyingMessage(interaction), 'update', interaction.message.id);
			return;
		}

		if ((interaction.isStringSelectMenu() && interaction.customId.includes('proxying_options') && interaction.values[0] === 'logging') || (interaction.isButton() && interaction.customId.startsWith('server-settings_proxying_logging_@'))) {

			// This is always an update to the message with the select menu
			await respond(interaction, await getProxyingLoggingMessage(interaction, server, 0), 'update', interaction.message.id);
			return;
		}

		/* It's checking if the interaction is the visits select menu */
		if (interaction.isStringSelectMenu() && interaction.customId.includes('proxying_logging_channel')) {

			if (selectOptionId && selectOptionId.includes('nextpage')) {

				const page = Number(selectOptionId.split('_')[1]) + 1;

				// This is always an update to the message with the select menu
				await respond(interaction, await getProxyingLoggingMessage(interaction, server, page), 'update', interaction.message.id);
				return;
			}
			else if (selectOptionId === undefined || selectOptionId === 'off') {

				await server.update({ logChannelId: null });

				// This is always a reply
				await respond(interaction, {
					content: 'Logging has successfully been turned off!',
					ephemeral: true,
				});
			}
			else {

				await server.update({ logChannelId: selectOptionId });

				// This is always a reply
				await respond(interaction, {
					content: `Proxied messages are now logged in ${channelMention(selectOptionId)}!`,
					ephemeral: true,
				});
			}
			return;
		}

		if (interaction.isButton() && interaction.customId.includes('proxying_logging_advanced')) {

			const logLimits = await ProxyLimits.findByPk(server.logLimitsId);
			if (!logLimits) { throw new TypeError('channelLimits is null'); }
			// This is always an update to the message with the select menu
			await respond(interaction, await getProxyingLoggingAdvancedMessage(interaction, logLimits, 0), 'update', interaction.message.id);
			return;
		}

		if (interaction.isButton() && interaction.customId.includes('proxying_logging_setTo')) {

			const logLimits = await ProxyLimits.findByPk(server.logLimitsId);
			if (!logLimits) { throw new TypeError('channelLimits is null'); }
			await logLimits?.update({ setToWhitelist: !logLimits.setToWhitelist });

			// This is always an update to the message with the select menu
			await respond(interaction, await getProxyingLoggingAdvancedMessage(interaction, logLimits, 0), 'update', interaction.message.id)
				.catch((error) => {
					if (error.httpStatus !== 404) { console.error(error); }
				});

			// This is always a followUp
			await respond(interaction, {
				content: `Logging proxied messages is now only ${logLimits.setToWhitelist ? 'enabled' : 'disabled'} in the ${logLimits.setToWhitelist ? 'whitelisted' : 'blacklisted'} channels!`,
				ephemeral: true,
			});
			return;
		}

		/* It's checking if the interaction is the visits select menu */
		if (interaction.isStringSelectMenu() && selectOptionId && interaction.customId.includes('proxying_logging_options')) {

			const logLimits = await ProxyLimits.findByPk(server.logLimitsId);
			if (!logLimits) { throw new TypeError('channelLimits is null'); }
			/* It's checking if the value is for turning a page. If it is, it's getting the page number from the value, and it's updating the message with the shop message with the page number. */
			if (selectOptionId.includes('nextpage')) {

				const page = Number(selectOptionId.split('_')[1]) + 1;

				// This is always an update to the message with the select menu
				await respond(interaction, await getProxyingLoggingAdvancedMessage(interaction, logLimits, page), 'update', interaction.message.id);
				return;
			}
			else {

				const listType = logLimits.setToWhitelist ? 'whitelist' : 'blacklist';
				let deepCopiedList = deepCopy(logLimits[listType]);

				const hasChannel = deepCopiedList.includes(selectOptionId);
				if (!hasChannel) { deepCopiedList.push(selectOptionId); }
				else { deepCopiedList = deepCopiedList.filter(string => string !== selectOptionId); }
				await logLimits.update({
					[listType]: deepCopiedList,
				});


				// This is always an update to the message with the select menu
				await respond(interaction, await getProxyingLoggingAdvancedMessage(interaction, logLimits, 0), 'update', interaction.message.id)
					.catch((error) => {
						if (error.httpStatus !== 404) { console.error(error); }
					});

				// This is always a followUp
				await respond(interaction, {
					content: `${hasChannel ? 'Removed' : 'Added'} <#${selectOptionId}> ${hasChannel ? 'from' : 'to'} the logging ${listType}!`,
					ephemeral: true,
				});
				return;
			}
		}

		if (interaction.isStringSelectMenu() && interaction.customId.includes('proxying_options') && interaction.values[0] === 'namerules') {

			// This is always an update to the message with the select menu
			await respond(interaction, await getProxyingNamerulesMessage(interaction, server, 0), 'update', interaction.message.id);
			return;
		}

		if (interaction.isStringSelectMenu() && selectOptionId && interaction.customId.includes('proxying_namerules_options')) {

			if (selectOptionId.includes('nextpage')) {

				const page = Number(selectOptionId.split('_')[1]) + 1;

				// This is always an update to the message with the select menu
				await respond(interaction, await getProxyingNamerulesMessage(interaction, server, page), 'update', interaction.message.id);
				return;
			}
			else {

				/* Getting the position of the pronoun in the array, and the existing pronoun in that place */
				const nameRuleSet = selectOptionId === 'add' ? '' : server.nameRuleSets[Number(selectOptionId)];
				if (nameRuleSet === undefined) { throw new TypeError('nameRuleSet is undefined'); }

				const textInput = new TextInputBuilder()
					.setCustomId('nameRuleSet')
					.setLabel('Text')
					.setStyle(TextInputStyle.Paragraph)
					.setMinLength(0)
					.setRequired(selectOptionId === 'add');
				if (selectOptionId !== 'add') { textInput.setValue(nameRuleSet); }

				await interaction
					.showModal(new ModalBuilder()
						.setCustomId(`server-settings_proxying_namerules_${selectOptionId}`)
						.setTitle(`${selectOptionId === 'add' ? 'Add' : 'Change'} Ruleset`)
						.addComponents(new ActionRowBuilder<TextInputBuilder>()
							.setComponents([textInput])),
					);
				return;
			}
		}

		if (interaction.isStringSelectMenu() && interaction.customId.includes('proxying_options') && interaction.values[0] === 'channels') {

			const channelLimits = await ProxyLimits.findByPk(server.proxy_channelLimitsId);
			if (!channelLimits) { throw new TypeError('channelLimits is null'); }
			// This is always an update to the message with the select menu
			await respond(interaction, await getProxyingChannelsMessage(interaction, channelLimits, 0), 'update', interaction.message.id);
			return;
		}

		if (interaction.isButton() && interaction.customId.includes('proxying_channel_setTo')) {

			const channelLimits = await ProxyLimits.findByPk(server.proxy_channelLimitsId);
			if (!channelLimits) { throw new TypeError('channelLimits is null'); }
			await channelLimits?.update({ setToWhitelist: !channelLimits.setToWhitelist });

			// This is always an update to the message with the select menu
			await respond(interaction, await getProxyingChannelsMessage(interaction, channelLimits, 0), 'update', interaction.message.id)
				.catch((error) => {
					if (error.httpStatus !== 404) { console.error(error); }
				});

			// This is always a followUp
			await respond(interaction, {
				content: `Proxying is now only ${channelLimits.setToWhitelist ? 'enabled' : 'disabled'} in the ${channelLimits.setToWhitelist ? 'whitelisted' : 'blacklisted'} channels!`,
				ephemeral: true,
			});
			return;
		}

		/* It's checking if the interaction is the visits select menu */
		if (interaction.isStringSelectMenu() && selectOptionId && interaction.customId.includes('proxying_channel_options')) {

			const channelLimits = await ProxyLimits.findByPk(server.proxy_channelLimitsId);
			if (!channelLimits) { throw new TypeError('channelLimits is null'); }
			/* It's checking if the value is for turning a page. If it is, it's getting the page number from the value, and it's updating the message with the shop message with the page number. */
			if (selectOptionId.includes('nextpage')) {

				const page = Number(selectOptionId.split('_')[1]) + 1;

				// This is always an update to the message with the select menu
				await respond(interaction, await getProxyingChannelsMessage(interaction, channelLimits, page), 'update', interaction.message.id);
				return;
			}
			else {

				const listType = channelLimits.setToWhitelist ? 'whitelist' : 'blacklist';
				let deepCopiedList = deepCopy(channelLimits[listType]);

				const hasChannel = deepCopiedList.includes(selectOptionId);
				if (!hasChannel) { deepCopiedList.push(selectOptionId); }
				else { deepCopiedList = deepCopiedList.filter(string => string !== selectOptionId); }
				await channelLimits.update({
					[listType]: deepCopiedList,
				});


				// This is always an update to the message with the select menu
				await respond(interaction, await getProxyingChannelsMessage(interaction, channelLimits, 0), 'update', interaction.message.id)
					.catch((error) => {
						if (error.httpStatus !== 404) { console.error(error); }
					});

				// This is always a followUp
				await respond(interaction, {
					content: `${hasChannel ? 'Removed' : 'Added'} <#${selectOptionId}> ${hasChannel ? 'from' : 'to'} the proxying ${listType}!`,
					ephemeral: true,
				});
				return;
			}
		}

		if (interaction.isStringSelectMenu() && interaction.customId.includes('proxying_options') && interaction.values[0] === 'roles') {

			const roleLimits = await ProxyLimits.findByPk(server.proxy_roleLimitsId);
			if (!roleLimits) { throw new TypeError('roleLimits is null'); }
			// This is always an update to the message with the select menu
			await respond(interaction, await getProxyingRolesMessage(interaction, roleLimits, 0), 'update', interaction.message.id);
			return;
		}

		if (interaction.isButton() && interaction.customId.includes('proxying_channel_setTo')) {

			const roleLimits = await ProxyLimits.findByPk(server.proxy_roleLimitsId);
			if (!roleLimits) { throw new TypeError('roleLimits is null'); }
			await roleLimits?.update({ setToWhitelist: !roleLimits.setToWhitelist });

			// This is always an update to the message with the select menu
			await respond(interaction, await getProxyingRolesMessage(interaction, roleLimits, 0), 'update', interaction.message.id)
				.catch((error) => {
					if (error.httpStatus !== 404) { console.error(error); }
				});

			// This is always a followUp
			await respond(interaction, {
				content: `Proxying is now only ${roleLimits.setToWhitelist ? 'enabled' : 'disabled'} for the ${roleLimits.setToWhitelist ? 'whitelisted' : 'blacklisted'} roles!`,
				ephemeral: true,
			});
			return;
		}

		/* It's checking if the interaction is the visits select menu */
		if (interaction.isStringSelectMenu() && selectOptionId && interaction.customId.includes('proxying_role_options')) {

			const roleLimits = await ProxyLimits.findByPk(server.proxy_roleLimitsId);
			if (!roleLimits) { throw new TypeError('roleLimits is null'); }
			/* It's checking if the value is for turning a page. If it is, it's getting the page number from the value, and it's updating the message with the shop message with the page number. */
			if (selectOptionId.includes('nextpage')) {

				const page = Number(selectOptionId.split('_')[1]) + 1;

				// This is always an update to the message with the select menu
				await respond(interaction, await getProxyingRolesMessage(interaction, roleLimits, page), 'update', interaction.message.id);
				return;
			}
			else {

				const listType = roleLimits.setToWhitelist ? 'whitelist' : 'blacklist';
				let deepCopiedList = deepCopy(roleLimits[listType]);

				const hasRole = deepCopiedList.includes(selectOptionId);
				if (!hasRole) { deepCopiedList.push(selectOptionId); }
				else { deepCopiedList = deepCopiedList.filter(string => string !== selectOptionId); }
				await roleLimits.update({
					[listType]: deepCopiedList,
				});


				// This is always an update to the message with the select menu
				await respond(interaction, await getProxyingRolesMessage(interaction, roleLimits, 0), 'update', interaction.message.id)
					.catch((error) => {
						if (error.httpStatus !== 404) { console.error(error); }
					});

				// This is always a followUp
				await respond(interaction, {
					content: `${hasRole ? 'Removed' : 'Added'} <@&${selectOptionId}> ${hasRole ? 'from' : 'to'} the proxying ${listType}!`,
					ephemeral: true,
				});
				return;
			}
		}

		if (interaction.isStringSelectMenu() && interaction.values[0] === 'delete') {

			// This is always an update to the message with the select menu
			await respond(interaction, await getDeletionMessage(interaction), 'update', interaction.message.id);
			return;
		}

		if (interaction.isButton() && interaction.customId.startsWith('server-settings_delete_confirm_@')) {

			await respond(interaction, { content: 'All information will be deleted now.' }, 'update', interaction.message.id);

			await ProxyLimits.destroy({ where: { [Op.or]: [{ id: server.proxy_roleLimitsId }, { id: server.proxy_channelLimitsId }] } });
			await UserToServer.destroy({ where: { serverId: server.id } });
			await GroupToServer.destroy({ where: { serverId: server.id } });
			await DiscordUserToServer.destroy({ where: { serverId: server.id } });
			await QuidToServer.destroy({ where: { serverId: server.id } });
			await server.destroy();

			await interaction.guild.leave();
		}
	},
	async sendModalResponse(interaction, { server }) {

		if (!interaction.isFromMessage()) { return; }
		if (!interaction.inCachedGuild()) { return; }
		if (!server) { return; }

		/* Getting the array position of the pronoun that is being edited, the pronouns that are being set, whether the pronouns are being deleted, and whether the pronouns are being set to none. */
		const rulesetNumber = Number(interaction.customId.split('_')[3]);
		const newRuleset = interaction.fields.getTextInputValue('nameRuleSet');
		const willBeDeleted = newRuleset === '';

		/* Checking if the user has provided the correct amount of arguments. If they haven't, it will send an error message. */
		if (!willBeDeleted) {

			const newRules = newRuleset.split('\n');
			for (let i = 0; i < newRules.length; i++) {

				const rule = newRules[i];
				if (!rule) { break; }

				if (rule.replace(/@displayname/g, '@').length > 80) {

					// This is always a reply
					await respond(interaction, {
						content: `Rule ${i + 1} is longer than 80 characters, which makes it impossible to follow because names can only be 80 characters long!`,
						ephemeral: true,
					});
					return;
				}
			}
		}

		const oldRuleset = isNaN(rulesetNumber) ? undefined : server.nameRuleSets[rulesetNumber];

		/* Add the pronouns, send a success message and update the original one. */
		const nameRuleSets = deepCopy(server.nameRuleSets);
		if ((willBeDeleted && !isNaN(rulesetNumber))) { nameRuleSets.splice(rulesetNumber, 1); }
		else { nameRuleSets[isNaN(rulesetNumber) ? nameRuleSets.length : rulesetNumber] = newRuleset; }

		await server.update({
			nameRuleSets: nameRuleSets,
		});

		// This is always an update
		await respond(interaction, await getProxyingNamerulesMessage(interaction, server, 0), 'update', interaction.message.id);

		const addedOrEditedTo = oldRuleset === undefined ? 'added ruleset' : `edited ruleset from \`${explainRuleset(oldRuleset)}\` to`;
		// This is always a followUp
		await respond(interaction, {
			content: `Successfully ${willBeDeleted ? `deleted ruleset \`${explainRuleset(oldRuleset ?? '')}\`` : `${addedOrEditedTo} \`${explainRuleset(newRuleset)}\``}!`,
		});
		return;
	},
};

function getOriginalMessage(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'> | AnySelectMenuInteraction<'cached'>,
): InteractionReplyOptions & MessageEditOptions & InteractionUpdateOptions {

	return {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() ?? undefined })
			.setTitle('Select what you want to configure from the drop-down menu below.')],
		components: [new ActionRowBuilder<StringSelectMenuBuilder>()
			.setComponents([new StringSelectMenuBuilder()
				.setCustomId(`server-settings_options_@${interaction.user.id}`)
				.setPlaceholder('Select an option to configure')
				.setOptions(
					{ value: 'updates', label: 'Updates', description: 'Get updates for new releases sent to a channel' },
					{ value: 'proxying', label: 'Proxying', description: 'Manage proxying' },
					{ value: 'delete', label: 'Deletion', description: 'Delete all information around this server and remove the bot' },
				)])],
	};
}

async function getUpdateMessage(
	interaction: AnySelectMenuInteraction<'cached'>,
): Promise<InteractionReplyOptions & MessageEditOptions & InteractionUpdateOptions> {

	return {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() ?? undefined })
			.setTitle('Settings ➜ Updates')
			.setDescription('Selecting a channel means that it will follow the updates channel on the [Paw and Paper Support Server](https://discord.gg/9DENgj8q5Q). To learn more about channel following and how to remove a followed channel, read [Discord\'s FAQ](https://support.discord.com/hc/en-us/articles/360028384531-Channel-Following-FAQ).')],
		components: [new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(`server-settings_mainpage_@${interaction.user.id}`)
				.setLabel('Back')
				.setEmoji('⬅️')
				.setStyle(ButtonStyle.Secondary)]),
		new ActionRowBuilder<ChannelSelectMenuBuilder>()
			.setComponents([new ChannelSelectMenuBuilder()
				.setCustomId(`server-settings_updates_options_@${interaction.user.id}`)
				.setPlaceholder('Select a channel to send updates to')
				.setMaxValues(1)
				.setChannelTypes([ChannelType.GuildText])])],
	};
}

async function getProxyingMessage(
	interaction: AnySelectMenuInteraction<'cached'> | ButtonInteraction<'cached'>,
): Promise<InteractionReplyOptions & MessageEditOptions & InteractionUpdateOptions> {

	return {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() ?? undefined })
			.setTitle('Settings ➜ Proxying')
			.setDescription('Please select which proxying rule you would like to configure.')],
		components: [new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(`server-settings_mainpage_@${interaction.user.id}`)
				.setLabel('Back')
				.setEmoji('⬅️')
				.setStyle(ButtonStyle.Secondary)]),
		new ActionRowBuilder<StringSelectMenuBuilder>()
			.setComponents([new StringSelectMenuBuilder()
				.setCustomId(`server-settings_proxying_options_@${interaction.user.id}`)
				.setPlaceholder('Select an option to configure.')
				.setOptions(
					{ value: 'logging', label: 'Logging', description: 'Configure logging proxied messages' },
					{ value: 'namerules', label: 'Name Rules', description: 'Configure rules a members name must follow for their message to be proxied' },
					{ value: 'channels', label: 'Channels', description: 'Toggle in which channels proxying should be enabled or disabled' },
					{ value: 'roles', label: 'Roles', description: 'Toggle for which channels proxying should be enabled or disabled' },
				)])],
	};
}

async function getProxyingLoggingMessage(
	interaction: AnySelectMenuInteraction<'cached'> | ButtonInteraction<'cached'>,
	server: Server,
	page: number,
): Promise<InteractionReplyOptions & MessageEditOptions & InteractionUpdateOptions> {

	let loggingChannelSelectMenuOptions: RestOrArray<SelectMenuComponentOptionData> = [{ label: 'off', value: 'off', default: server.logChannelId === null }, ...(await interaction.guild.channels.fetch()).filter((c): c is TextChannel => c !== null && c.type === ChannelType.GuildText).map(channel => ({ label: channel!.name, value: channel.id, default: server.logChannelId === channel.id }))];

	if (loggingChannelSelectMenuOptions.length > 25) {

		const pageCount = Math.ceil(loggingChannelSelectMenuOptions.length / 24);
		let adjustedPage = page % pageCount;
		if (adjustedPage < 0) { adjustedPage += pageCount; }

		loggingChannelSelectMenuOptions = loggingChannelSelectMenuOptions.splice(page * 24, 24);
		loggingChannelSelectMenuOptions.push({ label: 'Show more channels', value: `nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() ?? undefined })
			.setTitle('Settings ➜ Proxying ➜ Logging')
			.setDescription('Here, you can select a channel where proxied messages are logged to.')],
		components: [new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(`server-settings_proxying_@${interaction.user.id}`)
				.setLabel('Back')
				.setEmoji('⬅️')
				.setStyle(ButtonStyle.Secondary)]),
		new ActionRowBuilder<StringSelectMenuBuilder>()
			.setComponents([new StringSelectMenuBuilder()
				.setCustomId(`server-settings_proxying_logging_channel_@${interaction.user.id}`)
				.setPlaceholder('Select a channel where proxied messages are logged to')
				.setOptions(loggingChannelSelectMenuOptions)]),
		new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(`server-settings_proxying_logging_advanced_@${interaction.user.id}`)
				.setLabel('Advanced Options')
				.setEmoji('🔧')
				.setStyle(ButtonStyle.Primary)])],
	};
}

async function getProxyingLoggingAdvancedMessage(
	interaction: AnySelectMenuInteraction<'cached'> | ButtonInteraction<'cached'>,
	logLimits: ProxyLimits,
	page: number,
): Promise<InteractionReplyOptions & MessageEditOptions & InteractionUpdateOptions> {

	// If ChannelSelects ever allow for default values, then this could be implemented here. Right now, using default values clashes with the "Show more channels" feature
	const listType = logLimits.setToWhitelist ? 'whitelist' : 'blacklist';
	let disableSelectMenuOptions: RestOrArray<SelectMenuComponentOptionData> = (await interaction.guild.channels.fetch()).filter((c): c is TextChannel => c !== null && c.type === ChannelType.GuildText).map((channel, channelId) => ({ label: channel.name, value: channelId, emoji: logLimits[listType].includes(channelId) ? '🔘' : undefined }));

	if (disableSelectMenuOptions.length > 25) {

		const pageCount = Math.ceil(disableSelectMenuOptions.length / 24);
		let adjustedPage = page % pageCount;
		if (adjustedPage < 0) { adjustedPage += pageCount; }

		disableSelectMenuOptions = disableSelectMenuOptions.splice(page * 24, 24);
		disableSelectMenuOptions.push({ label: 'Show more channels', value: `nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() ?? undefined })
			.setTitle('Settings ➜ Proxying ➜ Logging ➜ Advanced')
			.setDescription('This toggles in which channels logging proxied messages should be disabled or enabled, using the drop-down menu below. Selected channels will have a radio emoji next to them. When it is set to blacklist, logging is *only disabled* in the selected channels. When it is set to whitelist, logging is *only enabled* in the selected channels.')],
		components: [new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(`server-settings_proxying_logging_@${interaction.user.id}`)
				.setLabel('Back')
				.setEmoji('⬅️')
				.setStyle(ButtonStyle.Secondary)]),
		new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(`server-settings_proxying_logging_setTo_@${interaction.user.id}`)
				.setLabel(`Currently set to ${logLimits.setToWhitelist ? 'whitelist' : 'blacklist'}`)
				.setStyle(ButtonStyle.Secondary)]),
		new ActionRowBuilder<StringSelectMenuBuilder>()
			.setComponents([new StringSelectMenuBuilder()
				.setCustomId(`server-settings_proxying_logging_options_@${interaction.user.id}`)
				.setPlaceholder(`Select channels to ${logLimits.setToWhitelist ? 'enable' : 'disable'} logging for`)
				.setOptions(disableSelectMenuOptions)])],
	};
}

async function getProxyingNamerulesMessage(
	interaction: AnySelectMenuInteraction<'cached'> | ButtonInteraction<'cached'> | ModalMessageModalSubmitInteraction<'cached'>,
	server: Server,
	page: number,
): Promise<InteractionReplyOptions & MessageEditOptions & InteractionUpdateOptions> {

	// If ChannelSelects ever allow for default values, then this could be implemented here. Right now, using default values clashes with the "Show more channels" feature
	let ruleSelectMenuOptions: Array<SelectMenuComponentOptionData> = [];

	server.nameRuleSets.forEach((nameRules, value) => {

		const nameRulesArr = nameRules.split('\n');
		ruleSelectMenuOptions.push({
			label: `Ruleset with ${nameRulesArr.length} rules:`,
			description: explainRuleset(nameRules).substring(0, 100),
			value: `${value}`,
		});
	});

	if (ruleSelectMenuOptions.length < 25) {

		ruleSelectMenuOptions.push({
			label: 'Add a ruleset',
			value: 'add',
		});
	}

	if (ruleSelectMenuOptions.length > 25) {

		const pageCount = Math.ceil(ruleSelectMenuOptions.length / 24);
		let adjustedPage = page % pageCount;
		if (adjustedPage < 0) { adjustedPage += pageCount; }

		ruleSelectMenuOptions = ruleSelectMenuOptions.splice(page * 24, 24);
		ruleSelectMenuOptions.push({ label: 'Show more rulesets', value: `nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() ?? undefined })
			.setTitle('Settings ➜ Proxying ➜ Name Rules')
			.setDescription('Name rules are rules a members name must follow for their message to be proxied. Selecting "Add a ruleset" from the drop-down menu opens a pop-up that allows you to type out a new ruleset. Each ruleset consists of one or multiple rules, each of which consists of exact text that must be included in the members name. You can also type @displayname to require one word from the user\'s display name to be present in the members name. To create a new rule, simply make a new line. The members name must include all rules of required text, but it can be in any order.This provides flexibility to users when creating their members name that comply with the rules. Each ruleset is a new way for users to comply, so they only need to follow one set of rules.')],
		components: [new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(`server-settings_proxying_@${interaction.user.id}`)
				.setLabel('Back')
				.setEmoji('⬅️')
				.setStyle(ButtonStyle.Secondary)]),
		new ActionRowBuilder<StringSelectMenuBuilder>()
			.setComponents([new StringSelectMenuBuilder()
				.setCustomId(`server-settings_proxying_namerules_options_@${interaction.user.id}`)
				.setPlaceholder('Add or edit name rulesets')
				.setOptions(ruleSelectMenuOptions)])],
	};
}

async function getProxyingChannelsMessage(
	interaction: AnySelectMenuInteraction<'cached'> | ButtonInteraction<'cached'>,
	channelLimits: ProxyLimits,
	page: number,
): Promise<InteractionReplyOptions & MessageEditOptions & InteractionUpdateOptions> {

	// If ChannelSelects ever allow for default values, then this could be implemented here. Right now, using default values clashes with the "Show more channels" feature
	const listType = channelLimits.setToWhitelist ? 'whitelist' : 'blacklist';
	let disableSelectMenuOptions: RestOrArray<SelectMenuComponentOptionData> = (await interaction.guild.channels.fetch()).filter((c): c is TextChannel => c !== null && c.type === ChannelType.GuildText).map((channel, channelId) => ({ label: channel.name, value: channelId, emoji: channelLimits[listType].includes(channelId) ? '🔘' : undefined }));

	if (disableSelectMenuOptions.length > 25) {

		const pageCount = Math.ceil(disableSelectMenuOptions.length / 24);
		let adjustedPage = page % pageCount;
		if (adjustedPage < 0) { adjustedPage += pageCount; }

		disableSelectMenuOptions = disableSelectMenuOptions.splice(page * 24, 24);
		disableSelectMenuOptions.push({ label: 'Show more channels', value: `nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() ?? undefined })
			.setTitle('Settings ➜ Proxying ➜ Allowed channels')
			.setDescription('This toggles in which channels proxying should be disabled or enabled, using the drop-down menu below. Selected channels will have a radio emoji next to them. When it is set to blacklist, proxying is *only disabled* in the selected channels. When it is set to whitelist, proxying is *only enabled* in the selected channels.')],
		components: [new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(`server-settings_proxying_@${interaction.user.id}`)
				.setLabel('Back')
				.setEmoji('⬅️')
				.setStyle(ButtonStyle.Secondary)]),
		new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(`server-settings_proxying_channel_setTo_@${interaction.user.id}`)
				.setLabel(`Currently set to ${channelLimits.setToWhitelist ? 'whitelist' : 'blacklist'}`)
				.setStyle(ButtonStyle.Secondary)]),
		new ActionRowBuilder<StringSelectMenuBuilder>()
			.setComponents([new StringSelectMenuBuilder()
				.setCustomId(`server-settings_proxying_channel_options_@${interaction.user.id}`)
				.setPlaceholder(`Select channels to ${channelLimits.setToWhitelist ? 'enable' : 'disable'} proxying for`)
				.setOptions(disableSelectMenuOptions)])],
	};
}

async function getProxyingRolesMessage(
	interaction: AnySelectMenuInteraction<'cached'> | ButtonInteraction<'cached'>,
	roleLimits: ProxyLimits,
	page: number,
): Promise<InteractionReplyOptions & MessageEditOptions & InteractionUpdateOptions> {

	// If ChannelSelects ever allow for default values, then this could be implemented here. Right now, using default values clashes with the "Show more channels" feature
	const listType = roleLimits.setToWhitelist ? 'whitelist' : 'blacklist';
	let disableSelectMenuOptions: RestOrArray<SelectMenuComponentOptionData> = (await interaction.guild.roles.fetch()).filter((r): r is Role => r != null).map((role, roleId) => ({ label: role.name, value: roleId, emoji: roleLimits[listType].includes(roleId) ? '🔘' : undefined }));

	if (disableSelectMenuOptions.length > 25) {

		const pageCount = Math.ceil(disableSelectMenuOptions.length / 24);
		let adjustedPage = page % pageCount;
		if (adjustedPage < 0) { adjustedPage += pageCount; }

		disableSelectMenuOptions = disableSelectMenuOptions.splice(page * 24, 24);
		disableSelectMenuOptions.push({ label: 'Show more roles', value: `nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() ?? undefined })
			.setTitle('Settings ➜ Proxying ➜ Allowed roles')
			.setDescription('This toggles for which roles proxying should be disabled or enabled, using the drop-down menu below. Selected roles will have a radio emoji next to them. When it is set to blacklist, proxying is *only disabled* for the selected roles. When it is set to whitelist, proxying is *only enabled* for the selected roles.')],
		components: [new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(`server-settings_proxying_@${interaction.user.id}`)
				.setLabel('Back')
				.setEmoji('⬅️')
				.setStyle(ButtonStyle.Secondary)]),
		new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(`server-settings_proxying_role_setTo_@${interaction.user.id}`)
				.setLabel(`Currently set to ${roleLimits.setToWhitelist ? 'whitelist' : 'blacklist'}`)
				.setStyle(ButtonStyle.Secondary)]),
		new ActionRowBuilder<StringSelectMenuBuilder>()
			.setComponents([new StringSelectMenuBuilder()
				.setCustomId(`server-settings_proxying_role_options_@${interaction.user.id}`)
				.setPlaceholder(`Select roles to ${roleLimits.setToWhitelist ? 'enable' : 'disable'} proxying for`)
				.setOptions(disableSelectMenuOptions)])],
	};
}

async function getDeletionMessage(
	interaction: AnySelectMenuInteraction<'cached'> | ButtonInteraction<'cached'>,
): Promise<InteractionReplyOptions & MessageEditOptions & InteractionUpdateOptions> {


	return {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() ?? undefined })
			.setTitle('Settings ➜ Delete')
			.setDescription('Are you sure you want to delete all information related to this server? This includes things such as settings and user profiles on this server. If you click yes, the bot will delete all information related to this server and leave this server afterwards. If you have an issue or want to delete individual information, you can open a ticket with `/ticket` or join the server (Link is on page 5 of the help command).')],
		components: [new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(`server-settings_mainpage_@${interaction.user.id}`)
				.setLabel('Back')
				.setEmoji('⬅️')
				.setStyle(ButtonStyle.Secondary)]),
		new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(`server-settings_delete_confirm_@${interaction.user.id}`)
				.setLabel('Confirm')
				.setStyle(ButtonStyle.Danger)])],
	};
}