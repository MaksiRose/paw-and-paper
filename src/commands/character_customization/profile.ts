import { ActionRowBuilder, ButtonInteraction, EmbedBuilder, GuildMember, InteractionReplyOptions, InteractionUpdateOptions, MessageEditOptions, RestOrArray, SelectMenuBuilder, SelectMenuComponentOptionData, SelectMenuInteraction, SlashCommandBuilder } from 'discord.js';
import { hasCooldownMap, respond } from '../../events/interactionCreate';
import userModel from '../../models/userModel';
import { Character, commonPlantsInfo, CurrentRegionType, CustomClient, materialsInfo, RankType, rarePlantsInfo, SlashCommand, specialPlantsInfo, speciesInfo, uncommonPlantsInfo, UserSchema } from '../../typedef';
import { hasName } from '../../utils/checkUserState';
import { checkRoleCatchBlock } from '../../utils/checkRoleRequirements';
import { hasCooldown, isResting } from '../../utils/checkValidity';
const { error_color } = require('../../../config.json');

const name: SlashCommand['name'] = 'profile';
const description: SlashCommand['description'] = 'Look up all the available info about a character or change the character you are using.';
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

		/* Getting userData and characterData either for mentionedUser if there is one or for interaction user otherwise */
		const mentionedUser = interaction.options.getUser('user');
		userData = await userModel.findOne(u => u.userId.includes(!mentionedUser ? interaction.user.id : mentionedUser.id)).catch(() => { return null; });
		const characterData = userData ? userData.characters[userData.currentCharacter[interaction.guildId || 'DM']] : null;

		/* Responding if there is no userData */
		if (!userData) {

			if (!mentionedUser) {

				hasName(interaction, userData);
			}
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
		else if (characterData && interaction.inGuild() && await hasCooldown(interaction, userData, interaction.commandName)) {

			return;
		}

		const response = await getMessageContent(client, userData.userId[0], characterData, !mentionedUser, embedArray);
		const selectMenu = getAccountsPage(userData, 0, !mentionedUser);

		await respond(interaction, {
			...response,
			components: (selectMenu.options.length > 0) ? [new ActionRowBuilder<SelectMenuBuilder>().setComponents([selectMenu])] : [],
		}, true)
			.catch((error) => { throw new Error(error); });
	},
};

/**
 * It takes in a client, userId, characterData, and isYourself, and returns a message object
 * @param client - Discords Client
 * @param userId - The user's ID
 * @param characterData - The character data from the database.
 * @param isYourself - Whether the character is by the user who executed the command
 * @param embedArray
 * @returns The message object.
 */
export async function getMessageContent(client: CustomClient, userId: string, characterData: Character | null, isYourself: boolean, embedArray: Array<EmbedBuilder>): Promise<InteractionReplyOptions & MessageEditOptions & InteractionUpdateOptions> {

	const user = await client.users
		.fetch(userId)
		.catch((error) => {
			throw new Error(error);
		});

	return {
		content: !characterData ? (isYourself ? 'You are on an Empty Slot. Select a character to switch to below.' : 'Select a character to view below.') : null,
		embeds: !characterData ? embedArray : [...embedArray, new EmbedBuilder()
			.setColor(characterData.color)
			.setTitle(characterData.name)
			.setAuthor({ name: `Profile - ${user.tag}` })
			.setDescription(characterData.description || null)
			.setThumbnail(characterData.avatarURL)
			.setFields([
				{ name: '**🦑 Species**', value: characterData.displayedSpecies ? (characterData.displayedSpecies.charAt(0).toUpperCase() + characterData.displayedSpecies.slice(1)) : characterData.species ? (characterData.species.charAt(0).toUpperCase() + characterData.species.slice(1)) : '/', inline: true },
				{ name: '**🔑 Proxy**', value: !characterData.proxy.startsWith && !characterData.proxy.endsWith ? 'No proxy set' : `${characterData.proxy.startsWith}text${characterData.proxy.endsWith}`, inline: true },
				{ name: '**🍂 Pronouns**', value: characterData.pronounSets.map(pronounSet => pronounCompromiser(pronounSet)).join('\n') || '/' },

			])
			.setFooter({ text: `Character ID: ${characterData._id}` })],
	};
}

/**
 * It takes in a profile, a list of inactive profiles, and a page number, and returns a menu with the
 * profile and inactive profiles as options.
 * @param {UserSchema} userData - The user data.
 * @param {number} charactersPage - The current page of accounts the user is on.
 * @param {boolean} isYourself - Whether the character is by the user who executed the command
 * @returns {MessageSelectMenu} A MessageSelectMenu object
 */
function getAccountsPage(userData: UserSchema, charactersPage: number, isYourself: boolean): SelectMenuBuilder {

	let accountMenuOptions: RestOrArray<SelectMenuComponentOptionData> = Object.values(userData.characters).map(character => ({ label: character.name, value: `profile_${isYourself ? 'switchto' : 'view'}_${character._id}` }));

	if (isYourself) { accountMenuOptions.push({ label: 'Empty Slot', value: 'profile_switchto_Empty Slot' }); }

	if (accountMenuOptions.length > 25) {

		accountMenuOptions = accountMenuOptions.splice(charactersPage * 24, 24);
		accountMenuOptions.push({ label: 'Show more characters', value: `profile_nextpage_${charactersPage}`, description: `You are currently on page ${charactersPage + 1}`, emoji: '📋' });
	}

	return new SelectMenuBuilder()
		.setCustomId(`profile_accountselect_${userData.uuid}`)
		.setPlaceholder(`Select a character to ${isYourself ? 'switch to' : 'view'}`)
		.setOptions(accountMenuOptions);
}

export async function profileInteractionCollector(client: CustomClient, interaction: ButtonInteraction | SelectMenuInteraction): Promise<void> {

	/* Checking if the user clicked the "Learn more" button, and if they did, copy the message to their DMs, but with the select Menu as a component instead of the button. */
	if (interaction.isButton() && interaction.customId.includes('learnabout')) {

		/* Getting the userData from the customId */
		const userDataUUID = interaction.customId.split('_')[2];
		const userData = await userModel.findOne(u => u.uuid === userDataUUID);

		/* Getting the DM channel, the select menu, and sending the message to the DM channel. */
		const dmChannel = await interaction.user
			.createDM()
			.catch((error) => { throw new Error(error); });

		const selectMenu = getAccountsPage(userData, 0, userData.userId.includes(interaction.user.id));

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
	if (interaction.isSelectMenu() && interaction.values[0].includes('nextpage')) {

		/* Getting the userData from the customId */
		const userDataUUID = interaction.customId.split('_')[2];
		const userData = await userModel.findOne(u => u.uuid === userDataUUID);

		/* Getting the charactersPage from the value Id, incrementing it by one or setting it to zero if the page number is bigger than the total amount of pages. */
		let charactersPage = Number(interaction.values[0].split('_')[2]) + 1;
		if (charactersPage >= Math.ceil((Object.keys(userData.characters).length + 1) / 24)) { charactersPage = 0; }

		await interaction
			.update({
				components: [new ActionRowBuilder<SelectMenuBuilder>().setComponents([getAccountsPage(userData, charactersPage, userData.userId.includes(interaction.user.id))])],
			})
			.catch((error) => { throw new Error(error); });
		return;
	}

	/* Checking if the user has clicked on a switchto button, and if they have, it will switch the user's current character to the character they have clicked on. */
	if (interaction.isSelectMenu() && interaction.values[0].includes('switchto')) {

		await interaction.deferUpdate();

		/* Getting the userData from the customId */
		const userDataUUID = interaction.customId.split('_')[2];
		let userData = await userModel.findOne(u => u.uuid === userDataUUID);

		/* Checking if the user is on a cooldown, and if they are, it will respond that they can't switch characters. */
		if (hasCooldownMap.get(userData.uuid + interaction.guildId) === true) {

			await respond(interaction, {
				content: 'You can\'t switch characters because your current character is busy!',
				ephemeral: true,
			}, false)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		/* Checking if the user is resting, and if they are, it will stop the resting. */
		if (interaction.inGuild() && userData?.currentCharacter?.[interaction.guildId || 'DM'] !== undefined) { await isResting(interaction, userData, []); }

		/* Getting the old character and the id of the character the user has clicked on. Then it is updating the user's current character to the character they have clicked on. Then it is getting the new character and profile. */
		const oldCharacterData = (userData?.characters?.[userData?.currentCharacter?.[interaction.guildId || 'DM']] || null) as Character | null;
		const _id = interaction.values[0].split('_')[2];
		userData = await userModel.findOneAndUpdate(
			u => u.uuid === userDataUUID,
			(u) => {
				if (_id !== 'Empty Slot') { u.currentCharacter[interaction.guildId || 'DM'] = _id; }
				else { delete u.currentCharacter[interaction.guildId || 'DM']; }
			},
		);
		let newCharacterData = _id !== 'Empty Slot' ? userData.characters[userData.currentCharacter[interaction.guildId || 'DM']] : null;
		let profileData = newCharacterData && interaction.guildId ? newCharacterData.profiles[interaction.guildId] : null;

		/* Getting the new character data, and then it is checking if the user has clicked on an account, and if they have, it will add the roles of the account to the user. */

		if (interaction.inCachedGuild()) {

			const member = (interaction.member instanceof GuildMember) ? interaction.member : (await interaction.guild.members.fetch(interaction.user.id));

			/* If the new character isn't empty,  */
			if (newCharacterData) {

				/* Checking if there is no profile, and if there isn't, create one. */
				if (!profileData) {

					userData = await userModel.findOneAndUpdate(
						u => u.uuid === userDataUUID,
						(u) => {
							u.characters[_id].profiles[interaction.guildId] = {
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
						},
					);
					newCharacterData = userData.characters[userData.currentCharacter[interaction.guildId]];
					profileData = newCharacterData.profiles[interaction.guildId];
				}

				/* Checking if the user does not have roles from the new profile, and if they don't, it will add them. */
				try {

					for (const role of newCharacterData.profiles[interaction.guildId].roles) {

						if (!member.roles.cache.has(role.roleId)) { await member.roles.add(role.roleId); }
					}
				}
				catch (error) {

					await checkRoleCatchBlock(error, interaction, member);
				}
			}

			/* Checking if the user has any roles from the old profile, and if they do, it will remove them. */
			try {

				for (const role of oldCharacterData?.profiles?.[interaction?.guildId]?.roles || []) {

					const isInNewRoles = newCharacterData !== null && newCharacterData.profiles[interaction.guildId].roles.some(r => r.roleId === role.roleId && r.wayOfEarning === role.wayOfEarning && r.requirement === role.requirement);
					if (isInNewRoles === false && member.roles.cache.has(role.roleId)) { await member.roles.remove(role.roleId); }
				}
			}
			catch (error) {

				await checkRoleCatchBlock(error, interaction, member);
			}
		}

		/* This has to be editReply because we do deferUpdate earlier. We do that because sorting out the roles might take a while. */
		await interaction
			.editReply({
				...await getMessageContent(client, userData.userId[0], newCharacterData, userData.userId.includes(interaction.user.id), []),
				components: interaction.message.components,
			})
			.catch((error) => { throw new Error(error); });

		respond(interaction, {
			content: `You successfully switched to \`${newCharacterData?.name || 'Empty Slot'}\`!`,
			ephemeral: true,
		}, false)
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	/* Checking if the user has clicked on the view button, and if they have, it will edit the message to show the character they have clicked on. */
	if (interaction.isSelectMenu() && interaction.values[0].includes('view')) {

		/* Getting the userData from the customId */
		const userDataUUID = interaction.customId.split('_')[2];
		const userData = await userModel.findOne(u => u.uuid === userDataUUID);

		/* Getting the character from the interaction value */
		const _id = interaction.values[0].split('_')[2];
		const characterData = userData.characters[_id];

		await interaction
			.update({
				...await getMessageContent(client, userData.userId[0], characterData, userData.userId.includes(interaction.user.id), []),
				components: interaction.message.components,
			})
			.catch((error) => { throw new Error(error); });
		return;
	}
}

export function pronounCompromiser(pronounSet: Array<string>): string {

	return `${pronounSet[0] === 'none' ? pronounSet[0] : `${pronounSet[0]}/${pronounSet[1]} (${pronounSet[2]}/${pronounSet[3]}/${pronounSet[4]})`}`;
}