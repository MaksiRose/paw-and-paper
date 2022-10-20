import { ActionRowBuilder, ButtonInteraction, EmbedBuilder, GuildMember, InteractionReplyOptions, RestOrArray, SelectMenuBuilder, SelectMenuComponentOptionData, SelectMenuInteraction, SlashCommandBuilder } from 'discord.js';
import { cooldownMap } from '../../events/interactionCreate';
import { capitalizeString, getArrayElement, respond, update } from '../../utils/helperFunctions';
import userModel, { getUserData } from '../../models/userModel';
import { hasName, hasNameAndSpecies } from '../../utils/checkUserState';
import { checkRoleCatchBlock } from '../../utils/checkRoleRequirements';
import { hasCooldown, checkResting } from '../../utils/checkValidity';
import { getMapData } from '../../utils/helperFunctions';
import { disableCommandComponent } from '../../utils/componentDisabling';
import { hasPermission, missingPermissions } from '../../utils/permissionHandler';
import { client, commonPlantsInfo, materialsInfo, rarePlantsInfo, specialPlantsInfo, speciesInfo, uncommonPlantsInfo } from '../..';
import { SlashCommand } from '../../typings/handle';
import { CurrentRegionType, RankType, UserData } from '../../typings/data/user';
const { error_color } = require('../../../config.json');

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
		const _userData = await userModel.findOne(u => u.userId.includes(!mentionedUser ? interaction.user.id : mentionedUser.id)).catch(() => { return null; });
		userData = _userData === null ? null : getUserData(_userData, interaction.guildId || 'DM', _userData.quids[_userData.currentQuid[interaction.guildId || 'DM'] || '']);

		/* Responding if there is no userData */
		if (!userData) {

			if (!mentionedUser) { hasName(userData, interaction); }
			else {

				await respond(interaction, {
					embeds: [new EmbedBuilder()
						.setColor(error_color)
						.setTitle('This user has no account!')],
				}, true);
			}
			return;
		}
		/* Checking if the user has a cooldown. */
		else if (hasNameAndSpecies(userData) && interaction.inCachedGuild() && await hasCooldown(interaction, userData)) { return; }

		const response = await getMessageContent(mentionedUser?.id || interaction.user.id, userData, !mentionedUser);
		const selectMenu = getAccountsPage(userData, mentionedUser?.id || interaction.user.id, interaction.user.id, 0, !mentionedUser);

		await respond(interaction, {
			...response,
			components: (selectMenu.options.length > 0) ? [new ActionRowBuilder<SelectMenuBuilder>().setComponents([selectMenu])] : [],
		}, true);
	},
};

/**
 * It takes in a client, userId, userData.quid, and isYourself, and returns a message object
 * @param client - Discords Client
 * @param userId - The user's ID
 * @param userData.quid - The quid data from the database.
 * @param isYourself - Whether the quid is by the user who executed the command
 * @param embedArray
 * @returns The message object.
 */
export async function getMessageContent(
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
 * It takes in a profile, a list of inactive profiles, and a page number, and returns a menu with the
 * profile and inactive profiles as options.
 * @param userData - The user data.
 * @param userId - The userId of the user the userData belongs to
 * @param quidsPage - The current page of accounts the user is on.
 * @param isYourself - Whether the quid is by the user who executed the command
 * @returns A MessageSelectMenu object
 */
function getAccountsPage(
	userData: UserData<undefined, ''>,
	userId: string,
	executorId: string,
	quidsPage: number,
	isYourself: boolean,
): SelectMenuBuilder {

	let accountMenuOptions: RestOrArray<SelectMenuComponentOptionData> = userData.quids.map(quid => ({ label: quid.name, value: `profile_${isYourself ? 'switchto' : 'view'}_${quid._id}` }));

	if (isYourself) { accountMenuOptions.push({ label: 'Empty Slot', value: 'profile_switchto_' }); }

	if (accountMenuOptions.length > 25) {

		accountMenuOptions = accountMenuOptions.splice(quidsPage * 24, 24);
		accountMenuOptions.push({ label: 'Show more quids', value: `profile_nextpage_${quidsPage}`, description: `You are currently on page ${quidsPage + 1}`, emoji: '📋' });
	}

	return new SelectMenuBuilder()
		.setCustomId(`profile_accountselect_${userId}_@${executorId}`)
		.setPlaceholder(`Select a quid to ${isYourself ? 'switch to' : 'view'}`)
		.setOptions(accountMenuOptions);
}

export async function profileInteractionCollector(
	interaction: ButtonInteraction | SelectMenuInteraction,
): Promise<void> {

	if (await missingPermissions(interaction, [
		'ViewChannel', // Needed because of disableCommandComponent
	]) === true) { return; }

	const selectOptionId = interaction.isSelectMenu() ? interaction.values[0] : undefined;

	/* Checking if the user clicked the "Learn more" button, and if they did, copy the message to their DMs, but with the select Menu as a component instead of the button. */
	if (interaction.isButton() && interaction.customId.includes('learnabout')) {

		/* Getting the userData from the customId */
		const userId = getArrayElement(interaction.customId.split('_'), 2);
		const _userData = await userModel.findOne(u => u.userId.includes(userId));
		const userData = getUserData(_userData, interaction.guildId || 'DM', _userData.quids[_userData.currentQuid[interaction.guildId || 'DM'] || '']);

		/* Getting the DM channel, the select menu, and sending the message to the DM channel. */
		const dmChannel = await interaction.user.createDM();

		const selectMenu = getAccountsPage(userData, userId, interaction.user.id, 0, userData.userId.includes(interaction.user.id));

		dmChannel.send({
			content: interaction.message.content || undefined,
			embeds: interaction.message.embeds,
			components: (selectMenu.options.length > 0) ? [new ActionRowBuilder<SelectMenuBuilder>().setComponents([selectMenu])] : [],
		});

		await interaction.deferUpdate();
		return;
	}

	/* Checking if the user has clicked on the "Show more accounts" button, and if they have, it will increase the page number by 1, and if the page number is greater than the total number of pages, it will set the page number to 0. Then, it will edit the bot reply to show the next page of accounts. */
	if (interaction.isSelectMenu() && selectOptionId && selectOptionId.includes('nextpage')) {

		/* Getting the userData from the customId */
		const userId = getArrayElement(interaction.customId.split('_'), 2);
		const _userData = await userModel.findOne(u => u.userId.includes(userId));
		const userData = getUserData(_userData, interaction.guildId || 'DM', _userData.quids[_userData.currentQuid[interaction.guildId || 'DM'] || '']);

		/* Getting the quidsPage from the value Id, incrementing it by one or setting it to zero if the page number is bigger than the total amount of pages. */
		let quidsPage = Number(selectOptionId.split('_')[2]) + 1;
		if (quidsPage >= Math.ceil((Object.keys(userData.quids).length + 1) / 24)) { quidsPage = 0; }

		await update(interaction, {
			components: [new ActionRowBuilder<SelectMenuBuilder>().setComponents([getAccountsPage(userData, userId, interaction.user.id, quidsPage, userData.userId.includes(interaction.user.id))])],
		});
		return;
	}

	/* Checking if the user has clicked on a switchto button, and if they have, it will switch the user's current quid to the quid they have clicked on. */
	if (interaction.isSelectMenu() && selectOptionId && selectOptionId.includes('switchto')) {

		await interaction.deferUpdate();

		/* Getting the userData from the customId */
		const userId = getArrayElement(interaction.customId.split('_'), 2);
		const _userData = await userModel.findOne(u => u.userId.includes(userId));
		const userData = getUserData(_userData, interaction.guildId || 'DM', _userData.quids[_userData.currentQuid[interaction.guildId || 'DM'] || '']);

		/* Checking if the user is on a cooldown, and if they are, it will respond that they can't switch quids. */
		if (cooldownMap.get(userData._id + interaction.guildId) === true) {

			await respond(interaction, {
				content: 'You can\'t switch quids because your current quid is busy!',
				ephemeral: true,
			}, false);
			return;
		}

		/* It's disabling all components of the previous message. */
		await disableCommandComponent[userData._id + (interaction.guildId || 'DM')]?.();

		/* Checking if the user is resting, and if they are, it will stop the resting. */
		const oldRoles = [...userData.quid?.profile?.roles || []];
		if (interaction.inCachedGuild() && hasNameAndSpecies(userData)) {

			await checkResting(interaction, userData);
		}

		/* Getting the old quid and the id of the quid the user has clicked on. Then it is updating the user's current quid to the quid they have clicked on. Then it is getting the new quid and profile. */
		const _id = selectOptionId.split('_')[2] || ''; // this is either an id, an empty string if empty slot
		await userData.update(
			(u) => {
				if (_id) {
					u.currentQuid[interaction.guildId || 'DM'] = _id;

				}
				else { delete u.currentQuid[interaction.guildId || 'DM']; }
			},
		);

		/* Getting the new quid data, and then it is checking if the user has clicked on an account, and if they have, it will add the roles of the account to the user. */

		if (interaction.inCachedGuild()) {

			const member = (interaction.member instanceof GuildMember) ? interaction.member : (await interaction.guild.members.fetch(interaction.user.id));

			/* If the new quid isn't empty, create a profile is necessary and add roles the user doesn't have from the new profile if necessary. */
			if (hasName(userData)) {

				/* Checking if there is no profile, and if there isn't, create one. */
				await userData.update(
					(u) => {
						const q = getMapData(u.quids, _id);
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

		/* This has to be editReply because we do deferUpdate earlier. We do that because sorting out the roles might take a while. */
		await interaction
			.editReply({
				// we can interaction.user.id because the "switchto" option is only available to yourself
				...await getMessageContent(interaction.user.id, userData, userData.userId.includes(interaction.user.id)),
				components: interaction.message.components,
			});

		respond(interaction, {
			content: `You successfully switched to \`${userData.quid?.name || 'Empty Slot'}\`!`,
			ephemeral: true,
		}, false);
		return;
	}

	/* Checking if the user has clicked on the view button, and if they have, it will edit the message to show the quid they have clicked on. */
	if (interaction.isSelectMenu() && selectOptionId && selectOptionId.includes('view')) {

		/* Getting the userData from the customId */
		const userId = getArrayElement(interaction.customId.split('_'), 2);
		const _userData = await userModel.findOne(u => u.userId.includes(userId));
		const _id = selectOptionId.split('_')[2] || '';
		const userData = getUserData(_userData, interaction.guildId || 'DM', _userData.quids[_id]);

		await update(interaction, {
			...await getMessageContent(userId, userData, userData.userId.includes(interaction.user.id)),
			components: interaction.message.components,
		});
		return;
	}
}

export function pronounCompromiser(
	pronounSet: Array<string>,
): string { return `${pronounSet[0] === 'none' ? pronounSet[0] : `${pronounSet[0]}/${pronounSet[1]} (${pronounSet[2]}/${pronounSet[3]}/${pronounSet[4]})`}`; }