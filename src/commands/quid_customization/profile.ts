import { ActionRowBuilder, EmbedBuilder, InteractionReplyOptions, RestOrArray, StringSelectMenuBuilder, SelectMenuComponentOptionData, SlashCommandBuilder } from 'discord.js';
import { capitalize, deepCopy, respond } from '../../utils/helperFunctions';
import { hasName, hasNameAndSpecies } from '../../utils/checkUserState';
import { hasCooldown, checkResting } from '../../utils/checkValidity';
import { client } from '../..';
import { SlashCommand } from '../../typings/handle';
import { constructCustomId, constructSelectOptions, deconstructCustomId, deconstructSelectOptions } from '../../utils/customId';
import Quid from '../../models/quid';
import { getDisplayname, getDisplayspecies } from '../../utils/getQuidInfo';
import Group from '../../models/group';
import GroupToQuid from '../../models/groupToQuid';
import DiscordUser from '../../models/discordUser';
import User from '../../models/user';
import UserToServer from '../../models/userToServer';
import QuidToServer from '../../models/quidToServer';
import { generateId } from 'crystalid';
const { error_color } = require('../../../config.json');

export type CustomIdArgs = ['accountselect' | 'learnabout', string]
type SelectOptionArgs = ['nextpage', `${number}`] | ['switchto' | 'view', string]

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('profile')
		.setDescription('Look up all the available info about a quid or change the quid you are using.')
		.addUserOption(option =>
			option.setName('user')
				.setDescription('A user that you want to look up the profile of.')
				.setRequired(false))
		.toJSON(),
	category: 'page1',
	position: 9,
	disablePreviousCommand: false, // This command has checks in place that only change something if no other command is active
	modifiesServerProfile: false,
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer, discordUser, server }) => {

		/* Getting userData and quid either for mentionedUser if there is one or for interaction user otherwise */
		const mentionedUser = interaction.options.getUser('user');

		discordUser = (!mentionedUser || mentionedUser.id === interaction.user.id) ? discordUser : await DiscordUser.findByPk(interaction.user.id, {
			include: [{ model: User, as: 'user' }],
		}) ?? undefined;

		const isYourself = (user?.id === discordUser?.user.id);
		user = discordUser?.user;

		userToServer = isYourself ? userToServer : (user && server)
			? (await UserToServer.findOne({
				where: { userId: user.id, serverId: server.id },
				include: [{ model: Quid, as: 'activeQuid' }],
			})) ?? undefined
			: undefined;

		quid = isYourself ? quid : (user && !server)
			? (user.lastGlobalActiveQuidId ? ((await Quid.findByPk(user.lastGlobalActiveQuidId)) ?? undefined) : undefined)
			: (userToServer?.activeQuid ?? undefined);

		quidToServer = isYourself ? quidToServer : (quid && interaction.inGuild())
			? (await QuidToServer.findOne({
				where: { quidId: quid.id, serverId: interaction.guildId },
			})) ?? undefined
			: undefined;

		/* Responding if there is no userData */
		if (!user || !discordUser) {

			if (!mentionedUser) { hasName(undefined, { interaction, hasQuids: false }); } // This is always a reply
			else {

				// Thix is always a reply
				await respond(interaction, {
					embeds: [new EmbedBuilder()
						.setColor(error_color)
						.setTitle('This user has no account!')],
				});
			}
			return;
		}
		/* Checking if the user has a cooldown. */
		else if (hasNameAndSpecies(quid) && interaction.inCachedGuild() && await hasCooldown(interaction, user, userToServer, quid, quidToServer)) { return; } // This is always a reply

		const response = await getProfileMessageOptions(discordUser.id, quid, isYourself, { serverId: interaction.guildId ?? undefined, userToServer, quidToServer, user });
		const selectMenu = await getQuidSelectMenu(user.id, interaction.user.id, 0, quid?.id, isYourself);

		// This is always a reply
		await respond(interaction, {
			...response,
			components: (selectMenu.options.length > 0) ? [new ActionRowBuilder<StringSelectMenuBuilder>().setComponents([selectMenu])] : [],
		});
	},
	async sendMessageComponentResponse(interaction, { user, quid, userToServer, quidToServer, discordUser, server }) {

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (!customId) { return; }


		/* Getting userData and quid either for mentionedUser if there is one or for interaction user otherwise */
		const mentionedUserId = customId.args[1];
		discordUser = mentionedUserId === interaction.user.id ? discordUser : await DiscordUser.findByPk(interaction.user.id, {
			include: [{ model: User, as: 'user' }],
		}) ?? undefined;

		const isYourself = (user?.id === discordUser?.user.id);
		user = discordUser?.user;

		userToServer = isYourself ? userToServer : (user && server)
			? (await UserToServer.findOne({
				where: { userId: user.id, serverId: server.id },
				include: [{ model: Quid, as: 'activeQuid' }],
			})) ?? undefined
			: undefined;

		quid = isYourself ? quid : (user && !server)
			? (user.lastGlobalActiveQuidId ? ((await Quid.findByPk(user.lastGlobalActiveQuidId)) ?? undefined) : undefined)
			: (userToServer?.activeQuid ?? undefined);

		quidToServer = isYourself ? quidToServer : (quid && interaction.inGuild())
			? (await QuidToServer.findOne({
				where: { quidId: quid.id, serverId: interaction.guildId },
			})) ?? undefined
			: undefined;


		/* Checking if the user clicked the "Learn more" button, and if they did, copy the message to their DMs, but with the select Menu as a component instead of the button. */
		if (interaction.isButton() && customId.args[0] === 'learnabout') {

			if (!user) { throw new TypeError('user is undefined'); }

			const selectMenu = await getQuidSelectMenu(user.id, interaction.user.id, 0, quid?.id, isYourself);

			await Promise.all([
				interaction.deferUpdate(),
				interaction.user.send({ // This should automatically call createDM
					content: interaction.message.content || undefined,
					embeds: interaction.message.embeds,
					components: (selectMenu.options.length > 0) ? [new ActionRowBuilder<StringSelectMenuBuilder>().setComponents([selectMenu])] : [],
				}),
			]);
			return;
		}

		if (interaction.isButton()) { return; }

		const selectOptionId = deconstructSelectOptions<SelectOptionArgs>(interaction)[0];
		if (selectOptionId === undefined) { throw new TypeError('selectOptionId is undefined'); }

		/* Checking if the user has clicked on the "Show more accounts" button, and if they have, it will increase the page number by 1, and if the page number is greater than the total number of pages, it will set the page number to 0. Then, it will edit the bot reply to show the next page of accounts. */
		if (interaction.isStringSelectMenu() && selectOptionId[0] === 'nextpage') {

			if (!user) { throw new TypeError('user is undefined'); }

			// This is always an update to the message with the select menu
			await respond(interaction, {
				components: [new ActionRowBuilder<StringSelectMenuBuilder>().setComponents([await getQuidSelectMenu(user.id, interaction.user.id, Number(selectOptionId[1]) + 1, quid?.id, isYourself)])],
			}, 'update', interaction.message.id);
			return;
		}

		/* Checking if the user has clicked on a switchto button, and if they have, it will switch the user's current quid to the quid they have clicked on. */
		if (interaction.isStringSelectMenu() && selectOptionId[0] === 'switchto') {

			await interaction.deferUpdate();

			if (!user) { throw new TypeError('user is undefined'); }

			/* Checking if the user is on a cooldown, and if they are, it will respond that they can't switch quids. */
			if (userToServer?.hasCooldown === true) {

				// This is always an editReply to the message with the select menu (due to deferUpdate)
				await respond(interaction, {
					content: 'You can\'t switch quids because your current quid is busy!',
					ephemeral: true,
				}, 'update', interaction.message.id);
				return;
			}

			/* Checking if the user is resting, and if they are, it will stop the resting. */
			if (interaction.inCachedGuild() && hasNameAndSpecies(quid) && userToServer && quidToServer) {

				await checkResting(interaction, user, userToServer, quid, quidToServer);
			}

			/* Getting the old quid and the id of the quid the user has clicked on. Then it is updating the user's current quid to the quid they have clicked on. Then it is getting the new quid and profile. */
			const quidId = selectOptionId[1]; // this is either an id, an empty string if empty slot
			if (interaction.inGuild()) {

				if (!userToServer) { throw new TypeError('userToServer is undefined'); }
				await userToServer.update({ activeQuidId: quidId || null });
			}
			else { await user.update({ lastGlobalActiveQuidId: quidId || null }); }

			quid = quidId === '' ? undefined : await Quid.findByPk(quidId) ?? undefined;
			quidToServer = (quid === undefined || !interaction.inGuild()) ? undefined : await QuidToServer.findOne({ where: { quidId: quid.id, serverId: interaction.guildId } }) ?? undefined;

			/* Getting the new quid data, and then it is checking if the user has clicked on an account, and if they have, it will add the roles of the account to the user. */
			if (interaction.inGuild()) {

				/* If the new quid isn't empty, create a profile is necessary and add roles the user doesn't have from the new profile if necessary. */
				if (hasName(quid) && !quidToServer) {

					/* Checking if there is no profile, and if there isn't, create one. */
					quidToServer = await QuidToServer.create({ id: generateId(), serverId: interaction.guildId, quidId: quid.id });
				}
			}

			// This is always an editReply to the message with the select menu (due to deferUpdate)
			await respond(interaction, {
				// we can interaction.user.id because the "switchto" option is only available to yourself
				...await getProfileMessageOptions(interaction.user.id, quid, isYourself, { serverId: interaction.guildId ?? undefined, userToServer, quidToServer, user }),
				components: [new ActionRowBuilder<StringSelectMenuBuilder>().setComponents([await getQuidSelectMenu(user.id, interaction.user.id, 0, quid?.id, isYourself)])],
			}, 'update', interaction.message.id);

			// This is always a followUp
			await respond(interaction, {
				content: `You successfully switched to \`${quid?.name || 'Empty Slot'}\`!`,
				ephemeral: true,
			});
			return;
		}

		/* Checking if the user has clicked on the view button, and if they have, it will edit the message to show the quid they have clicked on. */
		if (interaction.isStringSelectMenu() && customId.args[0] === 'accountselect' && selectOptionId[0] === 'view') {

			/* Getting the userData from the customId */
			const quidId = selectOptionId[1];
			quid = await Quid.findByPk(quidId, { rejectOnEmpty: true });

			quidToServer = interaction.inGuild()
				? (await QuidToServer.findOne({
					where: { quidId: quid.id, serverId: interaction.guildId },
				})) ?? undefined
				: undefined;

			// This is always an update to the message with the select menu
			await respond(interaction, {
				...await getProfileMessageOptions(interaction.user.id, quid, isYourself, { serverId: interaction.guildId ?? undefined, userToServer, quidToServer, user }),
				components: interaction.message.components,
			}, 'update', interaction.message.id);
			return;
		}
	},
};

/**
 * Returns the message content and embed(s) that displays the user's profile.
 * @param userId - The user ID of the user whose profile is displayed. This is used to fetch the discord user tag.
 * @param userData - The database entry of the user whose profile is displayed.
 * @param isYourself - Whether the profile belongs to the person requesting the info.
 * @param embedArray - Potential other embeds to display in front of the profile embed
 * @returns - InteractionReplyOptions
 */
export async function getProfileMessageOptions(
	userId: string,
	quid: Quid | undefined,
	isYourself: boolean,
	displaynameOptions: Parameters<typeof getDisplayname>[1],
	embedArray: Array<EmbedBuilder> = [],
): Promise<InteractionReplyOptions> {

	const pronouns = quid ? deepCopy(quid.pronouns_en) : [];
	if (quid && quid.noPronouns_en === true) { pronouns.push(['none']); }

	const user = await client.users.fetch(userId);
	const groupToQuids = quid ? await GroupToQuid.findAll({
		where: { quidId: quid.id },
		include: [{ model: Group }],
	}) : [];
	const groups = groupToQuids.map(gtq => gtq.group);

	return {
		content: !quid ? (isYourself ? 'You are on an Empty Slot. Select a quid to switch to below.' : 'Select a quid to view below.') : '',
		embeds: !quid ? embedArray : [...embedArray, new EmbedBuilder()
			.setColor(quid.color)
			.setTitle(quid.name)
			.setAuthor({ name: `Profile - ${user.tag}` })
			.setDescription(quid.description || null)
			.setThumbnail(quid.avatarURL)
			.setFields([
				{ name: '**🏷️ Displayname**', value: await getDisplayname(quid, displaynameOptions) },
				{ name: '**🦑 Species**', value: capitalize(getDisplayspecies(quid)) || '/', inline: true },
				{ name: '**🔑 Proxy**', value: !quid.proxy_startsWith && !quid.proxy_endsWith ? 'No proxy set' : `${quid.proxy_startsWith}text${quid.proxy_endsWith}`, inline: true },
				{ name: '**🍂 Pronouns**', value: pronouns.map(pronoun => pronoun.length === 1 ? pronoun[0]! : `${pronoun[0]}/${pronoun[1]} (${pronoun[2]}/${pronoun[3]}/${pronoun[4]})`).join('\n') || '/' },
				{
					name: '**🗂️ Groups**',
					value: groups
						.map(g => {

							return `\`${g.name}\`${g.id === quid.mainGroupId ? ' (Main group)' : ''}`;
						})
						.join('\n') || 'Ungrouped',
				},
			])
			.setFooter({ text: `Quid ID: ${quid.id}` })],
	};
}

/**
 * Returns a select menu with other quids of the user
 * @param userData - The database entry of the user whose profile is displayed.
 * @param userId - The user ID of the user whose profile is displayed. This is used to get the database entry again when something is selected
 * @param executorId - The user ID of the user who executed the command. This is used to know who whether the person selecting from the select menu can do so.
 * @param page - The current page of quids the user is on.
 * @param isYourself - Whether the profile belongs to the person requesting the info.
 * @returns A StringSelectMenuBuilder object
 */
async function getQuidSelectMenu(
	userId: string,
	executorId: string,
	page: number,
	selectedQuidId: string | undefined,
	isYourself: boolean,
): Promise<StringSelectMenuBuilder> {

	const quids = await Quid.findAll({ where: { userId: userId } });

	let quidOptions: RestOrArray<SelectMenuComponentOptionData> = quids.map(quid => ({
		label: quid.name,
		value: constructSelectOptions<SelectOptionArgs>([isYourself ? 'switchto' : 'view', quid.id]),
		default: quid.id === selectedQuidId ? true : false,
	}));

	if (isYourself) {

		quidOptions.push({
			label: 'Empty Slot',
			value: constructSelectOptions<SelectOptionArgs>(['switchto', '']),
			default: selectedQuidId === undefined,
		});
	}

	if (quidOptions.length > 25) {

		const pageCount = Math.ceil(quidOptions.length / 24);
		page = page % pageCount;
		if (page < 0) { page += pageCount; }

		quidOptions = quidOptions.splice(page * 24, 24);
		quidOptions.push({
			label: 'Show more quids',
			value: constructSelectOptions<SelectOptionArgs>(['nextpage', `${page}`]),
			description: `You are currently on page ${page + 1}`,
			emoji: '📋',
		});
	}

	return new StringSelectMenuBuilder()
		.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, executorId, ['accountselect', userId]))
		.setPlaceholder(`Select a quid to ${isYourself ? 'switch to' : 'view'}`)
		.setOptions(quidOptions);
}