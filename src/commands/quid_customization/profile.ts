import { ActionRowBuilder, EmbedBuilder, GuildMember, InteractionReplyOptions, RestOrArray, StringSelectMenuBuilder, SelectMenuComponentOptionData, SlashCommandBuilder } from 'discord.js';
import { capitalizeString, respond, userDataServersObject } from '../../utils/helperFunctions';
import { userModel, getUserData } from '../../models/userModel';
import { hasName, hasNameAndSpecies } from '../../utils/checkUserState';
import { checkRoleCatchBlock } from '../../utils/checkRoleRequirements';
import { hasCooldown, checkResting } from '../../utils/checkValidity';
import { getMapData } from '../../utils/helperFunctions';
import { disableCommandComponent } from '../../utils/componentDisabling';
import { hasPermission, missingPermissions } from '../../utils/permissionHandler';
import { client, commonPlantsInfo, materialsInfo, rarePlantsInfo, specialPlantsInfo, speciesInfo, uncommonPlantsInfo } from '../..';
import { SlashCommand } from '../../typings/handle';
import { CurrentRegionType, RankType, UserData } from '../../typings/data/user';
import { constructCustomId, constructSelectOptions, deconstructCustomId, deconstructSelectOptions } from '../../utils/customId';
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
	sendCommand: async (interaction, userData) => {

		/* Getting userData and userData.quid either for mentionedUser if there is one or for interaction user otherwise */
		const mentionedUser = interaction.options.getUser('user');
		const _userData = (() => {
			try { return userModel.findOne(u => Object.keys(u.userIds).includes(!mentionedUser ? interaction.user.id : mentionedUser.id)); }
			catch { return null; }
		})();
		userData = _userData === null ? null : getUserData(_userData, interaction.guildId || 'DMs', _userData.quids[_userData.servers[interaction.guildId || 'DMs']?.currentQuid ?? '']);

		/* Responding if there is no userData */
		if (!userData) {

			if (!mentionedUser) { hasName(userData, interaction); } // This is always a reply
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
		else if (hasNameAndSpecies(userData) && interaction.inCachedGuild() && await hasCooldown(interaction, userData)) { return; } // This is always a reply

		const response = await getProfileMessageOptions(mentionedUser?.id || interaction.user.id, userData, Object.keys(userData.userIds).includes(interaction.user.id));
		const selectMenu = getQuidSelectMenu(userData, mentionedUser?.id || interaction.user.id, interaction.user.id, 0, Object.keys(userData.userIds).includes(interaction.user.id));

		// This is always a reply
		await respond(interaction, {
			...response,
			components: (selectMenu.options.length > 0) ? [new ActionRowBuilder<StringSelectMenuBuilder>().setComponents([selectMenu])] : [],
		});
	},
	async sendMessageComponentResponse(interaction) {

		if (await missingPermissions(interaction, [
			'ViewChannel', // Needed because of disableCommandComponent
		]) === true) { return; }

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (!customId) { return; }

		/* Getting the userData from the customId */
		let _userData = await userModel.findOne(u => Object.keys(u.userIds).includes(customId.args[1]));
		let userData = getUserData(_userData, interaction.guildId || 'DMs', _userData.quids[_userData.servers[interaction.guildId || 'DMs']?.currentQuid ?? '']);

		/* Checking if the user clicked the "Learn more" button, and if they did, copy the message to their DMs, but with the select Menu as a component instead of the button. */
		if (interaction.isButton() && customId.args[0] === 'learnabout') {

			const selectMenu = getQuidSelectMenu(userData, customId.args[1], interaction.user.id, 0, Object.keys(userData.userIds).includes(interaction.user.id));

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

		const selectOptionId = deconstructSelectOptions<SelectOptionArgs>(interaction);

		/* Checking if the user has clicked on the "Show more accounts" button, and if they have, it will increase the page number by 1, and if the page number is greater than the total number of pages, it will set the page number to 0. Then, it will edit the bot reply to show the next page of accounts. */
		if (interaction.isStringSelectMenu() && selectOptionId[0] === 'nextpage') {

			/* Getting the quidsPage from the value Id, incrementing it by one or setting it to zero if the page number is bigger than the total amount of pages. */
			let quidsPage = Number(selectOptionId[1]) + 1;
			if (quidsPage >= Math.ceil((Object.keys(userData.quids).length + 1) / 24)) { quidsPage = 0; }

			// This is always an update to the message with the select menu
			await respond(interaction, {
				components: [new ActionRowBuilder<StringSelectMenuBuilder>().setComponents([getQuidSelectMenu(userData, customId.args[1], interaction.user.id, quidsPage, Object.keys(userData.userIds).includes(interaction.user.id))])],
			}, 'update', '@original');
			return;
		}

		/* Checking if the user has clicked on a switchto button, and if they have, it will switch the user's current quid to the quid they have clicked on. */
		if (interaction.isStringSelectMenu() && selectOptionId[0] === 'switchto') {

			await interaction.deferUpdate();

			/* Checking if the user is on a cooldown, and if they are, it will respond that they can't switch quids. */
			if (userData.serverInfo?.hasCooldown === true) {

				// This is always an editReply to the message with the select menu (due to deferUpdate)
				await respond(interaction, {
					content: 'You can\'t switch quids because your current quid is busy!',
					ephemeral: true,
				}, 'update', '@original');
				return;
			}

			/* It's disabling all components of the previous message. */
			await disableCommandComponent(userData);

			/* Checking if the user is resting, and if they are, it will stop the resting. */
			const oldRoles = [...userData.quid?.profile?.roles || []];
			if (interaction.inCachedGuild() && hasNameAndSpecies(userData)) {

				await checkResting(interaction, userData);
			}

			/* Getting the old quid and the id of the quid the user has clicked on. Then it is updating the user's current quid to the quid they have clicked on. Then it is getting the new quid and profile. */
			const quidId = selectOptionId[1]; // this is either an id, an empty string if empty slot
			_userData = await userModel.findOneAndUpdate(
				u => u._id === _userData._id,
				(u) => {
					u.servers[interaction.guildId || 'DMs'] = {
						...userDataServersObject(u, interaction.guildId || 'DMs'),
						currentQuid: quidId || null,
					};
					if (quidId) {
						// eslint-disable-next-line deprecation/deprecation
						u.currentQuid[interaction.guildId || 'DMs'] = quidId;
					}
					// eslint-disable-next-line deprecation/deprecation
					else { delete u.currentQuid[interaction.guildId || 'DMs']; }
				},
			);
			userData = getUserData(_userData, interaction.guildId || 'DMs', _userData.quids[quidId]);

			/* Getting the new quid data, and then it is checking if the user has clicked on an account, and if they have, it will add the roles of the account to the user. */

			if (interaction.inCachedGuild()) {

				const member = (interaction.member instanceof GuildMember) ? interaction.member : (await interaction.guild.members.fetch(interaction.user.id));

				/* If the new quid isn't empty, create a profile is necessary and add roles the user doesn't have from the new profile if necessary. */
				if (hasName(userData)) {

					/* Checking if there is no profile, and if there isn't, create one. */
					await userData.update(
						(u) => {
							const q = getMapData(u.quids, quidId);
							const p = q.profiles[interaction.guildId];
							if (!p) {
								q.profiles[interaction.guildId] = {
									serverId: interaction.guildId,
									rank: RankType.Youngling,
									levels: 1,
									experience: 0,
									health: 100,
									energy: 100,
									hunger: 100,
									thirst: 100,
									maxHealth: 100,
									maxEnergy: 100,
									maxHunger: 100,
									maxThirst: 100,
									temporaryStatIncrease: {},
									isResting: false,
									hasQuest: false,
									currentRegion: CurrentRegionType.Ruins,
									unlockedRanks: 0,
									tutorials: { play: false, explore: false },
									sapling: { exists: false, health: 50, waterCycles: 0, nextWaterTimestamp: null, lastMessageChannelId: null, sentReminder: false, sentGentleReminder: false },
									injuries: { wounds: 0, infections: 0, cold: false, sprains: 0, poison: false },
									inventory: {
										commonPlants: Object.fromEntries(Object.keys(commonPlantsInfo).map(k => [k, 0]).sort()) as Record<keyof typeof commonPlantsInfo, number>,
										uncommonPlants: Object.fromEntries(Object.keys(uncommonPlantsInfo).map(k => [k, 0]).sort()) as Record<keyof typeof uncommonPlantsInfo, number>,
										rarePlants: Object.fromEntries(Object.keys(rarePlantsInfo).map(k => [k, 0]).sort()) as Record<keyof typeof rarePlantsInfo, number>,
										specialPlants: Object.fromEntries(Object.keys(specialPlantsInfo).map(k => [k, 0]).sort()) as Record<keyof typeof specialPlantsInfo, number>,
										meat: Object.fromEntries(Object.keys(speciesInfo).map(k => [k, 0]).sort()) as Record<keyof typeof speciesInfo, number>,
										materials: Object.fromEntries(Object.keys(materialsInfo).map(k => [k, 0]).sort()) as Record<keyof typeof materialsInfo, number>,
									},
									roles: [],
									skills: { global: {}, personal: {} },
									lastActiveTimestamp: 0,
								};
							}
						},
					);

					/* Checking if the user does not have roles from the new profile, and if they don't, it will add them. */
					try {

						for (const role of (userData.quid.profile?.roles ?? [])) {

							if (await hasPermission(interaction.guild.members.me ?? interaction.client.user.id, interaction.channelId, 'ManageRoles') === false) { break; }
							if (!member.roles.cache.has(role.roleId)) { await member.roles.add(role.roleId); }
						}
					}
					catch (error) {
						await checkRoleCatchBlock(error, interaction, member);
					}
				}

				/* Checking if the user has any roles from the old profile, and if they do, it will remove them. */
				try {

					for (const role of oldRoles) {

						if (await hasPermission(interaction.guild.members.me ?? interaction.client.user.id, interaction.channelId, 'ManageRoles') === false) { break; }
						const isInNewRoles = userData.quid?.profile?.roles.some(r => r.roleId === role.roleId && r.wayOfEarning === role.wayOfEarning && r.requirement === role.requirement) || false;
						if (!isInNewRoles && member.roles.cache.has(role.roleId)) { await member.roles.remove(role.roleId); }
					}
				}
				catch (error) { await checkRoleCatchBlock(error, interaction, member); }
			}

			// This is always an editReply to the message with the select menu (due to deferUpdate)
			await respond(interaction, {
				// we can interaction.user.id because the "switchto" option is only available to yourself
				...await getProfileMessageOptions(interaction.user.id, userData, Object.keys(userData.userIds).includes(interaction.user.id)),
				components: interaction.message.components,
			}, 'update', '@original');

			// This is always a followUp
			await respond(interaction, {
				content: `You successfully switched to \`${userData.quid?.name || 'Empty Slot'}\`!`,
				ephemeral: true,
			});
			return;
		}

		/* Checking if the user has clicked on the view button, and if they have, it will edit the message to show the quid they have clicked on. */
		if (interaction.isStringSelectMenu() && customId.args[0] === 'accountselect' && selectOptionId[0] === 'view') {

			/* Getting the userData from the customId */
			const quidId = selectOptionId[1];
			userData = getUserData(_userData, interaction.guildId || 'DMs', _userData.quids[quidId]);

			// This is always an update to the message with the select menu
			await respond(interaction, {
				...await getProfileMessageOptions(customId.args[1], userData, Object.keys(userData.userIds).includes(interaction.user.id)),
				components: interaction.message.components,
			}, 'update', '@original');
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
	userData: UserData<undefined, ''>,
	isYourself: boolean,
	embedArray: Array<EmbedBuilder> = [],
): Promise<InteractionReplyOptions> {

	const user = await client.users.fetch(userId);

	return {
		content: !userData.quid ? (isYourself ? 'You are on an Empty Slot. Select a quid to switch to below.' : 'Select a quid to view below.') : '',
		embeds: !userData.quid ? embedArray : [...embedArray, new EmbedBuilder()
			.setColor(userData.quid.color)
			.setTitle(userData.quid.name)
			.setAuthor({ name: `Profile - ${user.tag}` })
			.setDescription(userData.quid.description || null)
			.setThumbnail(userData.quid.avatarURL)
			.setFields([
				{ name: '**🏷️ Displayname**', value: userData.quid.getDisplayname() },
				{ name: '**🦑 Species**', value: capitalizeString(userData.quid.getDisplayspecies()) || '/', inline: true },
				{ name: '**🔑 Proxy**', value: !userData.quid.proxy.startsWith && !userData.quid.proxy.endsWith ? 'No proxy set' : `${userData.quid.proxy.startsWith}text${userData.quid.proxy.endsWith}`, inline: true },
				{ name: '**🍂 Pronouns**', value: userData.quid.pronounSets.map(pronounSet => pronounCompromiser(pronounSet)).join('\n') || '/' },
			])
			.setFooter({ text: `Quid ID: ${userData.quid._id}` })],
	};
}

/**
 * Returns a select menu with other quids of the user
 * @param userData - The database entry of the user whose profile is displayed.
 * @param userId - The user ID of the user whose profile is displayed. This is used to get the database entry again when something is selected
 * @param executorId - The user ID of the user who executed the command. This is used to know who whether the person selecting from the select menu can do so.
 * @param quidsPage - The current page of quids the user is on.
 * @param isYourself - Whether the profile belongs to the person requesting the info.
 * @returns A StringSelectMenuBuilder object
 */
function getQuidSelectMenu(
	userData: UserData<undefined, ''>,
	userId: string,
	executorId: string,
	quidsPage: number,
	isYourself: boolean,
): StringSelectMenuBuilder {

	let quidOptions: RestOrArray<SelectMenuComponentOptionData> = userData.quids.map(quid => ({
		label: quid.name,
		value: constructSelectOptions<SelectOptionArgs>([isYourself ? 'switchto' : 'view', quid._id]),
	}));

	if (isYourself) {

		quidOptions.push({
			label: 'Empty Slot',
			value: constructSelectOptions<SelectOptionArgs>(['switchto', '']),
		});
	}

	if (quidOptions.length > 25) {

		quidOptions = quidOptions.splice(quidsPage * 24, 24);
		quidOptions.push({
			label: 'Show more quids',
			value: constructSelectOptions<SelectOptionArgs>(['nextpage', `${quidsPage}`]),
			description: `You are currently on page ${quidsPage + 1}`,
			emoji: '📋',
		});
	}

	return new StringSelectMenuBuilder()
		.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, executorId, ['accountselect', userId]))
		.setPlaceholder(`Select a quid to ${isYourself ? 'switch to' : 'view'}`)
		.setOptions(quidOptions);
}

export function pronounCompromiser(
	pronounSet: Array<string>,
): string { return `${pronounSet[0] === 'none' ? pronounSet[0] : `${pronounSet[0]}/${pronounSet[1]} (${pronounSet[2]}/${pronounSet[3]}/${pronounSet[4]})`}`; }