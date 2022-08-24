import { ActionRowBuilder, ButtonInteraction, EmbedBuilder, GuildMember, InteractionReplyOptions, InteractionUpdateOptions, MessageEditOptions, RestOrArray, SelectMenuBuilder, SelectMenuComponentOptionData, SelectMenuInteraction, SlashCommandBuilder } from 'discord.js';
import { hasCooldownMap } from '../../events/interactionCreate';
import { respond } from '../../utils/helperFunctions';
import userModel from '../../models/userModel';
import { Quid, commonPlantsInfo, CurrentRegionType, CustomClient, materialsInfo, RankType, rarePlantsInfo, SlashCommand, specialPlantsInfo, speciesInfo, uncommonPlantsInfo, UserSchema } from '../../typedef';
import { hasName } from '../../utils/checkUserState';
import { checkRoleCatchBlock } from '../../utils/checkRoleRequirements';
import { hasCooldown, isResting } from '../../utils/checkValidity';
import { getMapData } from '../../utils/helperFunctions';
import { disableCommandComponent } from '../../utils/componentDisabling';
const { error_color } = require('../../../config.json');

const name: SlashCommand['name'] = 'profile';
const description: SlashCommand['description'] = 'Look up all the available info about a quid or change the quid you are using.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.addUserOption(option =>
			option.setName('user')
				.setDescription('A user that you want to look up the profile of.')
				.setRequired(false))
		.toJSON(),
	disablePreviousCommand: false, // This command has checks in place that only change something if no other command is active
	sendCommand: async (client, interaction, userData, serverData, embedArray) => {

		/* Getting userData and quidData either for mentionedUser if there is one or for interaction user otherwise */
		const mentionedUser = interaction.options.getUser('user');
		userData = await userModel.findOne(u => u.userId.includes(!mentionedUser ? interaction.user.id : mentionedUser.id)).catch(() => { return null; });
		const quidData = userData?.quids[userData.currentQuid[interaction.guildId || 'DM'] || ''];

		/* Responding if there is no userData */
		if (!userData) {

			if (!mentionedUser) { hasName(interaction, userData); }
			else {

				await respond(interaction, {
					embeds: [{
						color: error_color,
						title: 'This user has no account!',
					}],
				}, true)
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
			}
			return;
		}
		/* Checking if the user has a cooldown. */
		else if (quidData && interaction.inCachedGuild() && await hasCooldown(interaction, userData, quidData, interaction.commandName)) { return; }

		const response = await getMessageContent(client, mentionedUser?.id || interaction.user.id, quidData, !mentionedUser, embedArray);
		const selectMenu = getAccountsPage(userData, mentionedUser?.id || interaction.user.id, 0, !mentionedUser);

		await respond(interaction, {
			...response,
			components: (selectMenu.options.length > 0) ? [new ActionRowBuilder<SelectMenuBuilder>().setComponents([selectMenu])] : [],
		}, true)
			.catch((error) => { throw new Error(error); });
	},
};

/**
 * It takes in a client, userId, quidData, and isYourself, and returns a message object
 * @param client - Discords Client
 * @param userId - The user's ID
 * @param quidData - The quid data from the database.
 * @param isYourself - Whether the quid is by the user who executed the command
 * @param embedArray
 * @returns The message object.
 */
export async function getMessageContent(
	client: CustomClient,
	userId: string,
	quidData: Quid | undefined,
	isYourself: boolean,
	embedArray: Array<EmbedBuilder>,
): Promise<InteractionReplyOptions & MessageEditOptions & InteractionUpdateOptions> {

	const user = await client.users
		.fetch(userId)
		.catch((error) => {
			throw new Error(error);
		});

	return {
		content: !quidData ? (isYourself ? 'You are on an Empty Slot. Select a quid to switch to below.' : 'Select a quid to view below.') : null,
		embeds: !quidData ? embedArray : [...embedArray, new EmbedBuilder()
			.setColor(quidData.color)
			.setTitle(quidData.name)
			.setAuthor({ name: `Profile - ${user.tag}` })
			.setDescription(quidData.description || null)
			.setThumbnail(quidData.avatarURL)
			.setFields([
				{ name: '**🦑 Species**', value: quidData.displayedSpecies ? (quidData.displayedSpecies.charAt(0).toUpperCase() + quidData.displayedSpecies.slice(1)) : quidData.species ? (quidData.species.charAt(0).toUpperCase() + quidData.species.slice(1)) : '/', inline: true },
				{ name: '**🔑 Proxy**', value: !quidData.proxy.startsWith && !quidData.proxy.endsWith ? 'No proxy set' : `${quidData.proxy.startsWith}text${quidData.proxy.endsWith}`, inline: true },
				{ name: '**🍂 Pronouns**', value: quidData.pronounSets.map(pronounSet => pronounCompromiser(pronounSet)).join('\n') || '/' },

			])
			.setFooter({ text: `Quid ID: ${quidData._id}` })],
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
	userData: UserSchema,
	userId: string,
	quidsPage: number,
	isYourself: boolean,
): SelectMenuBuilder {

	let accountMenuOptions: RestOrArray<SelectMenuComponentOptionData> = Object.values(userData.quids).map(quid => ({ label: quid.name, value: `profile_${isYourself ? 'switchto' : 'view'}_${quid._id}` }));

	if (isYourself) { accountMenuOptions.push({ label: 'Empty Slot', value: 'profile_switchto_' }); }

	if (accountMenuOptions.length > 25) {

		accountMenuOptions = accountMenuOptions.splice(quidsPage * 24, 24);
		accountMenuOptions.push({ label: 'Show more quids', value: `profile_nextpage_${quidsPage}`, description: `You are currently on page ${quidsPage + 1}`, emoji: '📋' });
	}

	return new SelectMenuBuilder()
		.setCustomId(`profile_accountselect_${userId}`)
		.setPlaceholder(`Select a quid to ${isYourself ? 'switch to' : 'view'}`)
		.setOptions(accountMenuOptions);
}

export async function profileInteractionCollector(
	client: CustomClient,
	interaction: ButtonInteraction | SelectMenuInteraction,
): Promise<void> {

	const selectOptionId = interaction.isSelectMenu() ? interaction.values[0] : undefined;

	/* Checking if the user clicked the "Learn more" button, and if they did, copy the message to their DMs, but with the select Menu as a component instead of the button. */
	if (interaction.isButton() && interaction.customId.includes('learnabout')) {

		/* Getting the userData from the customId */
		const userId = interaction.customId.split('_')[2] || '';
		const userData = await userModel.findOne(u => u.userId.includes(userId));

		/* Getting the DM channel, the select menu, and sending the message to the DM channel. */
		const dmChannel = await interaction.user
			.createDM()
			.catch((error) => { throw new Error(error); });

		const selectMenu = getAccountsPage(userData, userId, 0, userData.userId.includes(interaction.user.id));

		dmChannel
			.send({
				content: interaction.message.content || null,
				embeds: interaction.message.embeds,
				components: (selectMenu.options.length > 0) ? [new ActionRowBuilder<SelectMenuBuilder>().setComponents([selectMenu])] : [],
			})
			.catch((error) => { throw new Error(error); });

		await interaction.deferUpdate();
		return;
	}

	/* Checking if the user has clicked on the "Show more accounts" button, and if they have, it will increase the page number by 1, and if the page number is greater than the total number of pages, it will set the page number to 0. Then, it will edit the bot reply to show the next page of accounts. */
	if (interaction.isSelectMenu() && selectOptionId && selectOptionId.includes('nextpage')) {

		/* Getting the userData from the customId */
		const userId = interaction.customId.split('_')[2] || '';
		const userData = await userModel.findOne(u => u.userId.includes(userId));

		/* Getting the quidsPage from the value Id, incrementing it by one or setting it to zero if the page number is bigger than the total amount of pages. */
		let quidsPage = Number(selectOptionId.split('_')[2]) + 1;
		if (quidsPage >= Math.ceil((Object.keys(userData.quids).length + 1) / 24)) { quidsPage = 0; }

		await interaction
			.update({
				components: [new ActionRowBuilder<SelectMenuBuilder>().setComponents([getAccountsPage(userData, userId, quidsPage, userData.userId.includes(interaction.user.id))])],
			})
			.catch((error) => { throw new Error(error); });
		return;
	}

	/* Checking if the user has clicked on a switchto button, and if they have, it will switch the user's current quid to the quid they have clicked on. */
	if (interaction.isSelectMenu() && selectOptionId && selectOptionId.includes('switchto')) {

		await interaction.deferUpdate();

		/* Getting the userData from the customId */
		const userId = interaction.customId.split('_')[2] || '';
		let userData = await userModel.findOne(u => u.userId.includes(userId));

		/* Checking if the user is on a cooldown, and if they are, it will respond that they can't switch quids. */
		if (hasCooldownMap.get(userData.uuid + interaction.guildId) === true) {

			await respond(interaction, {
				content: 'You can\'t switch quids because your current quid is busy!',
				ephemeral: true,
			}, false)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		/* It's disabling all components of the previous message. */
		await disableCommandComponent[userData.uuid + (interaction.guildId || 'DM')]?.();

		/* Checking if the user is resting, and if they are, it will stop the resting. */
		const oldQuidData = userData.quids[userData.currentQuid[interaction.guildId || 'DM'] || ''];
		if (interaction.inCachedGuild() && oldQuidData) {

			const oldProfileData = oldQuidData?.profiles[interaction.guildId];
			if (oldProfileData) { await isResting(interaction, userData, oldQuidData, oldProfileData, []); }
		}

		/* Getting the old quid and the id of the quid the user has clicked on. Then it is updating the user's current quid to the quid they have clicked on. Then it is getting the new quid and profile. */
		const _id = selectOptionId.split('_')[2] || ''; // this is either an id, an empty string if empty slot
		userData = await userModel.findOneAndUpdate(
			u => u.userId.includes(userId),
			(u) => {
				if (_id) {
					u.currentQuid[interaction.guildId || 'DM'] = _id;

				}
				else { delete u.currentQuid[interaction.guildId || 'DM']; }
			},
		);
		let newQuidData = userData.quids[_id];

		/* Getting the new quid data, and then it is checking if the user has clicked on an account, and if they have, it will add the roles of the account to the user. */

		if (interaction.inCachedGuild()) {

			const member = (interaction.member instanceof GuildMember) ? interaction.member : (await interaction.guild.members.fetch(interaction.user.id));

			/* If the new quid isn't empty, create a profile is necessary and add rolees the user doesn't have from the new profile if necessary. */
			if (newQuidData) {

				/* Checking if there is no profile, and if there isn't, create one. */
				userData = await userModel.findOneAndUpdate(
					u => u.userId.includes(userId),
					(u) => {
						let p = u.quids[_id]?.profiles[interaction.guildId];
						if (!p) {
							p = {
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
							};
						}
					},
				);
				newQuidData = getMapData(userData.quids, _id);
				const newProfileData = getMapData(newQuidData.profiles, interaction.guildId);

				/* Checking if the user does not have roles from the new profile, and if they don't, it will add them. */
				try {

					for (const role of newProfileData.roles) {

						if (!member.roles.cache.has(role.roleId)) { await member.roles.add(role.roleId); }
					}
				}
				catch (error) {
					await checkRoleCatchBlock(error, interaction, member);
				}
			}

			/* Checking if the user has any roles from the old profile, and if they do, it will remove them. */
			try {

				for (const role of oldQuidData?.profiles?.[interaction?.guildId]?.roles || []) {

					const isInNewRoles = newQuidData?.profiles[interaction.guildId]?.roles.some(r => r.roleId === role.roleId && r.wayOfEarning === role.wayOfEarning && r.requirement === role.requirement) || false;
					if (!isInNewRoles && member.roles.cache.has(role.roleId)) { await member.roles.remove(role.roleId); }
				}
			}
			catch (error) { await checkRoleCatchBlock(error, interaction, member); }
		}

		/* This has to be editReply because we do deferUpdate earlier. We do that because sorting out the roles might take a while. */
		await interaction
			.editReply({
				// we can interaction.user.id because the "switchto" option is only available to yourself
				...await getMessageContent(client, interaction.user.id, newQuidData, userData.userId.includes(interaction.user.id), []),
				components: interaction.message.components,
			})
			.catch((error) => { throw new Error(error); });

		respond(interaction, {
			content: `You successfully switched to \`${newQuidData?.name || 'Empty Slot'}\`!`,
			ephemeral: true,
		}, false)
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	/* Checking if the user has clicked on the view button, and if they have, it will edit the message to show the quid they have clicked on. */
	if (interaction.isSelectMenu() && selectOptionId && selectOptionId.includes('view')) {

		/* Getting the userData from the customId */
		const userId = interaction.customId.split('_')[2] || '';
		const userData = await userModel.findOne(u => u.userId.includes(userId));

		/* Getting the quid from the interaction value */
		const _id = selectOptionId.split('_')[2] || '';
		const quidData = userData.quids[_id];

		await interaction
			.update({
				...await getMessageContent(client, userId, quidData, userData.userId.includes(interaction.user.id), []),
				components: interaction.message.components,
			})
			.catch((error) => { throw new Error(error); });
		return;
	}
}

export function pronounCompromiser(
	pronounSet: Array<string>,
): string { return `${pronounSet[0] === 'none' ? pronounSet[0] : `${pronounSet[0]}/${pronounSet[1]} (${pronounSet[2]}/${pronounSet[3]}/${pronounSet[4]})`}`; }