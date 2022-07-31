import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, GuildMember, ModalBuilder, ModalMessageModalSubmitInteraction, PermissionFlagsBits, RestOrArray, SelectMenuBuilder, SelectMenuComponentOptionData, SelectMenuInteraction, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { respond } from '../../events/interactionCreate';
import serverModel from '../../models/serverModel';
import userModel from '../../models/userModel';
import { Profile, ServerSchema, SlashCommand, UserSchema } from '../../typedef';
import { isInGuild } from '../../utils/checkUserState';
import { createCommandComponentDisabler } from '../../utils/componentDisabling';
import { getMapData } from '../../utils/getInfo';

const name: SlashCommand['name'] = 'skills';
const description: SlashCommand['description'] = 'Show a list of or edit custom skills/ability scores.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.addUserOption(option =>
			option.setName('user')
				.setDescription('A user that you want to look up the skills of')
				.setRequired(false))
		.setDMPermission(false)
		.toJSON(),
	disablePreviousCommand: true,
	sendCommand: async (client, interaction, userData, serverData) => {

		if (!isInGuild(interaction) || !serverData) { return; }

		/* Check if the user wants their own or someone elses skills, and redefine userData if so. */
		let isYourself = true;
		const mentionedUser = interaction.options.getUser('user');
		if (mentionedUser) {

			isYourself = false;
			userData = await userModel.findOne(u => u.userId.includes(mentionedUser.id)).catch(() => { return null; });
		}

		/* Define the users character and profile based on their userData. */
		let characterData = userData?.characters[userData?.currentCharacter[interaction.guildId] || ''];
		let profileData = characterData?.profiles[interaction.guildId];

		/* Allign the users global skills with the ones defined in the serverData. */
		if (userData && characterData && profileData) {

			const newGlobalSkills: { [x: string]: number; } = {};
			for (const skill of serverData.skills) { newGlobalSkills[skill] = profileData?.skills.global[skill] ?? 0; }
			userData = await userModel.findOneAndUpdate(
				(u => u.uuid === userData?.uuid),
				(u) => {
					const p = getMapData(getMapData(u.characters, characterData!._id).profiles, profileData!.serverId);
					p.skills.global = newGlobalSkills;
				},
			);
			characterData = getMapData(userData.characters, getMapData(userData.currentCharacter, interaction.guildId));
			profileData = getMapData(characterData.profiles, interaction.guildId);
		}

		/* Creating a message with 4 buttons and a skill list. */
		const botReply = await respond(interaction, {
			content: getSkillList(profileData),
			components: isYourself ? [getOriginalComponents(profileData, serverData, interaction.member)] : [],
		}, true)
			.catch((error) => { throw new Error(error); });
		if (userData) { createCommandComponentDisabler(userData.uuid, interaction.guildId, botReply); }
	},
};

export const skillsInteractionCollector = async (
	interaction: ButtonInteraction | SelectMenuInteraction,
	serverData: ServerSchema | null,
	userData: UserSchema | null,
): Promise<void> => {

	if (!interaction.inCachedGuild() || !serverData) { throw new Error('Interaction is not in cached guild'); }

	/* Make interaction.values[0] its own variable so its existence can be checked in an if-statement */
	const selectOptionId = interaction.isSelectMenu() ? interaction.values[0] : undefined;

	/* Define the users character and profile based on their userData. */
	let characterData = userData?.characters[userData?.currentCharacter[interaction.guildId] || ''];
	let profileData = characterData?.profiles[interaction.guildId];

	/* Refresh the skills list. */
	if (interaction.isButton() && interaction.customId === 'skills_refresh') {

		await interaction
			.update({
				content: getSkillList(profileData),
				components: interaction.message.components,
			})
			.catch((error) => { throw new Error(error); });
		return;
	}

	/* Add two buttons "personal" and "global". */
	if (interaction.isButton() && (interaction.customId === 'skills_add' || interaction.customId === 'skills_edit' || interaction.customId === 'skills_remove')) {

		await interaction
			.update({
				components: [
					getOriginalComponents(profileData, serverData, interaction.member),
					new ActionRowBuilder<ButtonBuilder>()
						.setComponents(
							[new ButtonBuilder()
								.setCustomId(`${interaction.customId}_personal${interaction.customId === 'skills_add' ? '_modal' : ''}`)
								.setLabel('Personal')
								.setEmoji('👤')
								.setDisabled(!profileData)
								.setStyle(ButtonStyle.Secondary),
							new ButtonBuilder()
								.setCustomId(`${interaction.customId}-global${interaction.customId === 'skills_add' ? '_modal' : ''}`)
								.setLabel('Global')
								.setEmoji('👥')
								.setDisabled(!interaction.member.permissions?.has(PermissionFlagsBits.Administrator))
								.setStyle(ButtonStyle.Secondary),
							]),
				],
			})
			.catch((error) => { throw new Error(error); });
		return;
	}

	/* Add a new select menu to select a skill to modify. */
	if (interaction.isButton() && interaction.customId === 'skills_modify') {

		await interaction
			.update({
				components: [
					getOriginalComponents(profileData, serverData, interaction.member),
					getModifyMenu(profileData, 0),
				],
			})
			.catch((error) => { throw new Error(error); });
		return;
	}

	/* Creating a modal that allows the user to add a skill. */
	if (interaction.isButton() && (interaction.customId === 'skills_add_personal_modal' || interaction.customId === 'skills_add_global_modal')) {

		const category = interaction.customId.split('_')[2];
		if (!category) { throw new TypeError('category is undefined'); }

		await interaction.showModal(new ModalBuilder()
			.setCustomId(`skills_add_${category}`)
			.setTitle(`Add ${category} skill`)
			.addComponents(
				new ActionRowBuilder<TextInputBuilder>()
					.setComponents([new TextInputBuilder()
						.setCustomId('skills_add_textinput')
						.setLabel('Name')
						.setStyle(TextInputStyle.Short)
						.setMaxLength(25)
						.setRequired(true),
					]),
			));
		return;
	}

	/* Add a new select menu to select a skill to edit/remove. */
	if (interaction.isButton() && (interaction.customId === 'skills_edit_personal' || interaction.customId === 'skills_edit_global' || interaction.customId === 'skills_remove_personal' || interaction.customId === 'skills_remove_global')) {

		const type = interaction.customId.split('_')[1] as 'edit' | 'remove' | undefined;
		const category = interaction.customId.split('_')[2] as 'global' | 'personal' | undefined;
		if (!type) { throw new TypeError('type is undefined'); }
		if (!category) { throw new TypeError('category is undefined'); }

		await interaction
			.update({
				components: [
					getOriginalComponents(profileData, serverData, interaction.member),
					type === 'edit' ? getEditMenu(profileData, serverData, category, 0) : getRemoveMenu(profileData, serverData, category, 0),
				],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	/* Change the page of the select menu. */
	if (interaction.isSelectMenu() && selectOptionId && selectOptionId.includes('nextpage')) {

		if (selectOptionId.startsWith('skills_modify_')) {

			let page = Number(selectOptionId.split('_')[3] ?? 0) + 1;
			const totalPages = Math.ceil((Object.keys(profileData?.skills.global || {}).length + Object.keys(profileData?.skills.personal || {}).length) / 24);
			if (page >= totalPages) { page = 0; }
			await interaction
				.update({
					components: [
						getOriginalComponents(profileData, serverData, interaction.member),
						getModifyMenu(profileData, page),
					],
				})
				.catch((error) => { throw new Error(error); });
			return;
		}

		if (selectOptionId.startsWith('skills_edit_')) {

			let page = Number(selectOptionId.split('_')[4] ?? 0) + 1;
			const category = selectOptionId.split('_')[2] as 'global' | 'personal' | undefined;
			if (!category) { throw new TypeError('category is undefined'); }
			const totalPages = Math.ceil(((category === 'global' ? (serverData?.skills || []) : Object.keys(profileData?.skills.personal || {})).length) / 24);
			if (page >= totalPages) { page = 0; }
			await interaction
				.update({
					components: [
						getOriginalComponents(profileData, serverData, interaction.member),
						getEditMenu(profileData, serverData, category, page),
					],
				})
				.catch((error) => { throw new Error(error); });
			return;
		}

		if (selectOptionId.startsWith('skills_remove_')) {

			let page = Number(selectOptionId.split('_')[4] ?? 0) + 1;
			const category = selectOptionId.split('_')[2] as 'global' | 'personal' | undefined;
			if (!category) { throw new TypeError('category is undefined'); }
			const totalPages = Math.ceil(((category === 'global' ? (serverData?.skills || []) : Object.keys(profileData?.skills.personal || {})).length) / 24);
			if (page >= totalPages) { page = 0; }
			await interaction
				.update({
					components: [
						getOriginalComponents(profileData, serverData, interaction.member),
						getRemoveMenu(profileData, serverData, category, page),
					],
				})
				.catch((error) => { throw new Error(error); });
			return;
		}
		return;
	}

	/* Creating a modal that allows the user to edit or modify a skill. */
	if (interaction.isSelectMenu() && selectOptionId && (interaction.customId === 'skills_modify_options_modal' || interaction.customId === 'skills_edit_options_modal')) {

		const type = selectOptionId.split('_')[1] as 'modify' | 'edit' | undefined;
		const category = selectOptionId.split('_')[2] as 'personal' | 'global' | undefined;
		const skillName = selectOptionId.split('_')[3];
		if (!type) { throw new TypeError('type is undefined'); }
		if (!category) { throw new TypeError('category is undefined'); }
		if (!skillName) { throw new TypeError('skillName is undefined'); }

		await interaction.showModal(new ModalBuilder()
			.setCustomId(`skills_${type}_${category}_${skillName}`)
			.setTitle(`${type.charAt(0).toUpperCase() + type.slice(1)} ${category} skill "${skillName}"`)
			.addComponents(
				new ActionRowBuilder<TextInputBuilder>()
					.setComponents(new TextInputBuilder()
						.setCustomId(`skills_${type}_textinput`)
						.setLabel(type === 'edit' ? 'New name' : 'New value')
						.setStyle(TextInputStyle.Short)
						.setMaxLength(25)
						.setRequired(true)
						.setValue(type === 'modify' ? `${profileData?.skills[category][skillName] || 0}` : skillName),
					),
			),
		);
		return;
	}

	/* Removing a skill. */
	if (interaction.isSelectMenu() && selectOptionId && interaction.customId === 'skills_remove_options') {

		const category = selectOptionId.split('_')[2] as 'global' | 'personal' | undefined;
		const skillName = selectOptionId.split('_')[3];
		if (!category) { throw new TypeError('category is undefined'); }
		if (!skillName) { throw new TypeError('skillName is undefined'); }

		if (category === 'personal' && userData) {

			userData = await userModel.findOneAndUpdate(
				(u => u.uuid === userData!.uuid),
				(u) => {
					const p = getMapData(getMapData(u.characters, getMapData(u.currentCharacter, interaction.guildId)).profiles, interaction.guildId);
					delete p.skills[category][skillName];
				},
			);
		}
		else {

			const allServerUsers = await userModel.find(
				(u) => Object.values(u.characters).filter(c => Object.keys(c.profiles).includes(interaction.guildId)).length > 0,
			);

			for (const user of allServerUsers) {

				await userModel.findOneAndUpdate(
					u => u.uuid === user.uuid,
					(u) => {
						for (const c of Object.values(u.characters)) {
							if (c.profiles[interaction.guildId] !== undefined) {
								const p = getMapData(getMapData(u.characters, getMapData(u.currentCharacter, interaction.guildId)).profiles, interaction.guildId);
								delete p.skills[category][skillName];
							}
						}
					},
				);
			}

			await serverModel.findOneAndUpdate(
				s => s.serverId === interaction.guildId,
				(s) => {
					s.skills = s.skills.filter(n => n !== skillName);
				},
			);

			userData = await userModel.findOne(u => u.uuid === userData?.uuid).catch(() => { return null; });
		}

		characterData = userData?.characters[userData?.currentCharacter[interaction.guildId] || ''];
		profileData = characterData?.profiles[interaction.guildId];
		await interaction
			.update({
				content: getSkillList(profileData),
				components: [getOriginalComponents(profileData, serverData, interaction.member)],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		await respond(interaction, {
			content: `You removed the ${category} skill \`${skillName}\`!`,
		}, false)
			.catch((error) => { throw new Error(error); });
		return;
	}
};

export const sendEditSkillsModalResponse = async (
	interaction: ModalMessageModalSubmitInteraction,
	serverData: ServerSchema | null,
	userData: UserSchema | null,
): Promise<void> => {

	if (!interaction.inCachedGuild() || !serverData) { throw new Error('Interaction is not in cached guild'); }

	/* Define the users character and profile based on their userData. */
	let characterData = userData?.characters[userData?.currentCharacter[interaction.guildId] || ''];
	let profileData = characterData?.profiles[interaction.guildId];

	const type = interaction.customId.split('_')[1] as 'modify' | 'edit' | 'add' | undefined;
	const category = interaction.customId.split('_')[2] as 'personal' | 'global' | undefined;
	const skillName = interaction.customId.split('_')[3];
	if (!type) { throw new TypeError('type is undefined'); }
	if (!category) { throw new TypeError('category is undefined'); }
	if (type !== 'add' && !skillName) { throw new TypeError('skillName is undefined'); }

	if (type === 'add') {

		const newName = interaction.fields.getTextInputValue('skills_add_textinput');
		if (category === 'personal' && userData) {

			if ([...Object.keys(profileData?.skills?.personal || {}), ...serverData.skills].includes(newName)) {

				await respond(interaction, {
					content: `I can't add the personal skill \`${newName}\` since the name interferes with another skills name!`,
					ephemeral: true,
				}, false)
					.catch((error) => { throw new Error(error); });
				return;
			}

			userData = await userModel.findOneAndUpdate(
				(u => u.uuid === userData!.uuid),
				(u) => {
					const p = getMapData(getMapData(u.characters, getMapData(u.currentCharacter, interaction.guildId)).profiles, interaction.guildId);
					p.skills[category][newName] = 0;
				},
			);
		}
		else {

			const allServerUsers = await userModel.find(
				(u) => Object.values(u.characters).filter(c => Object.keys(c.profiles).includes(interaction.guildId)).length > 0,
			);

			const allSkillNamesList = [...new Set(allServerUsers.map(u => Object.values(u.characters).map(c => Object.keys(c.profiles[interaction.guildId]?.skills.personal || {}))).map(array1 => array1.filter(array2 => array2.length > 0)).filter(array => array.length > 0).flat(2)), ...serverData.skills];

			if (allSkillNamesList.includes(newName)) {

				await respond(interaction, {
					content: `I can't add the global skill \`${newName}\` since the name interferes with another skills name!`,
					ephemeral: true,
				}, false)
					.catch((error) => { throw new Error(error); });
				return;
			}

			for (const user of allServerUsers) {

				await userModel.findOneAndUpdate(
					u => u.uuid === user.uuid,
					(u) => {
						for (const c of Object.values(u.characters)) {
							if (c.profiles[interaction.guildId] !== undefined) {
								const p = getMapData(getMapData(u.characters, getMapData(u.currentCharacter, interaction.guildId)).profiles, interaction.guildId);
								p.skills.global[newName] = 0;
							}
						}
					},
				);
			}

			await serverModel.findOneAndUpdate(
				s => s.serverId === interaction.guildId,
				(s) => {
					s.skills.push(newName);
				},
			);

			userData = await userModel.findOne(u => u.uuid === userData?.uuid).catch(() => { return null; });
		}

		characterData = userData?.characters[userData?.currentCharacter[interaction.guildId] || ''];
		profileData = characterData?.profiles[interaction.guildId];
		await interaction
			.update({
				content: getSkillList(profileData),
				components: [getOriginalComponents(profileData, serverData, interaction.member)],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		await respond(interaction, {
			content: `You added the ${category} skill \`${newName}\`!`,
		}, false)
			.catch((error) => { throw new Error(error); });
		return;
	}
	else if (type === 'edit') {

		const newName = interaction.fields.getTextInputValue('skills_edit_textinput');
		if (category === 'personal' && userData) {

			if ([...Object.keys(profileData?.skills?.personal || {}), ...serverData.skills].includes(newName)) {

				await respond(interaction, {
					content: `I can't edit the personal skill \`${name}\` to be called \`${newName}\` since the name interferes with another skills name!`,
					ephemeral: true,
				}, false)
					.catch((error) => { throw new Error(error); });
				return;
			}

			userData = await userModel.findOneAndUpdate(
				(u => u.uuid === userData!.uuid),
				(u) => {
					const p = getMapData(getMapData(u.characters, getMapData(u.currentCharacter, interaction.guildId)).profiles, interaction.guildId);
					p.skills.personal[newName] = p.skills.personal[name] ?? 0;
					delete p.skills.personal[name];
				},
			);
		}
		else {

			const allServerUsers = await userModel.find(
				(u) => Object.values(u.characters).filter(c => Object.keys(c.profiles).includes(interaction.guildId)).length > 0,
			);

			const allSkillNamesList = [...new Set(allServerUsers.map(u => Object.values(u.characters).map(c => Object.keys(c.profiles[interaction.guildId]?.skills.personal || {}))).map(array1 => array1.filter(array2 => array2.length > 0)).filter(array => array.length > 0).flat(2)), ...serverData.skills];

			if (allSkillNamesList.includes(newName)) {

				await respond(interaction, {
					content: `I can't edit the global skill \`${name}\` to be called \`${newName}\` since the new name interferes with another skills name!`,
					ephemeral: true,
				}, false)
					.catch((error) => { throw new Error(error); });
				return;
			}

			for (const user of allServerUsers) {

				await userModel.findOneAndUpdate(
					u => u.uuid === user.uuid,
					(u) => {
						for (const c of Object.values(u.characters)) {
							if (c.profiles[interaction.guildId] !== undefined) {
								const p = getMapData(getMapData(u.characters, getMapData(u.currentCharacter, interaction.guildId)).profiles, interaction.guildId);
								p.skills.global[newName] = p.skills.global[name] ?? 0;
								delete p.skills.global[name];
							}
						}
					},
				);
			}

			await serverModel.findOneAndUpdate(
				s => s.serverId === interaction.guildId,
				(s) => {
					s.skills.push(newName);
					s.skills = s.skills.filter(n => n !== name);
				},
			);

			userData = await userModel.findOne(u => u.uuid === userData?.uuid).catch(() => { return null; });
		}

		characterData = userData?.characters[userData?.currentCharacter[interaction.guildId] || ''];
		profileData = characterData?.profiles[interaction.guildId];
		await interaction
			.update({
				content: getSkillList(profileData),
				components: [getOriginalComponents(profileData, serverData, interaction.member)],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		await respond(interaction, {
			content: `You changed the name of the ${category} skill \`${name}\` to \`${newName}\`!`,
		}, false)
			.catch((error) => { throw new Error(error); });
		return;
	}
	else if (type === 'modify' && userData && characterData && profileData) {

		const plusOrMinus = interaction.fields.getTextInputValue('skills_modify_textinput').startsWith('+') ? '+' : interaction.fields.getTextInputValue('skills_modify_textinput').startsWith('-') ? '-' : '';
		const newValue = Number(interaction.fields.getTextInputValue('skills_modify_textinput').replace(plusOrMinus, '').replace(/\s/g, ''));
		const oldValue = profileData.skills[category][name] ?? 0;

		if (isNaN(newValue)) {

			await respond(interaction, {
				content: 'Please enter a valid number!',
				ephemeral: true,
			}, false)
				.catch((error) => { throw new Error(error); });
			return;
		}

		userData = await userModel.findOneAndUpdate(
			u => u.uuid === userData!.uuid,
			(u) => {
				const p = getMapData(getMapData(u.characters, getMapData(u.currentCharacter, interaction.guildId)).profiles, interaction.guildId);
				if (plusOrMinus === '+') { p.skills[category][name] += newValue; }
				else if (plusOrMinus === '-') { p.skills[category][name] -= newValue; }
				else { p.skills[category][name] = newValue; }
			},
		);
		characterData = getMapData(userData.characters, getMapData(userData.currentCharacter, interaction.guildId));
		profileData = getMapData(characterData.profiles, interaction.guildId);
		await interaction
			.update({
				content: getSkillList(profileData),
				components: [getOriginalComponents(profileData, serverData, interaction.member)],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		await respond(interaction, {
			content: `You changed the value of the ${category} skill \`${name}\` from \`${oldValue}\` to \`${profileData.skills[category][name]}\`!`,
		}, false)
			.catch((error) => { throw new Error(error); });
	}
};

/**
 * It returns an Action Row with 5 Buttons
 * @param profileData - This is the profile data that is being used to build the menu.
 * @param serverData - The server data from the database
 * @param member - The member that is currently using the menu.
 * @returns An Action Row with Buttons
 */
const getOriginalComponents = (
	profileData: Profile | undefined,
	serverData: ServerSchema,
	member: GuildMember,
): ActionRowBuilder<ButtonBuilder> => {

	return new ActionRowBuilder<ButtonBuilder>()
		.setComponents(
			[new ButtonBuilder()
				.setCustomId('skills_add')
				.setLabel('Add')
				.setEmoji('✏️')
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('skills_edit')
				.setLabel('Edit')
				.setEmoji('📝')
				.setDisabled(([...Object.keys(profileData?.skills?.personal || {}), ...Object.keys(profileData?.skills?.global || {})].length <= 0) && (!member.permissions.has(PermissionFlagsBits.Administrator) || serverData.skills.length <= 0))
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('skills_remove')
				.setLabel('Delete')
				.setEmoji('🗑️')
				.setDisabled((Object.keys(profileData?.skills.personal || {}).length <= 0) && (!member.permissions.has(PermissionFlagsBits.Administrator) || serverData.skills.length <= 0))
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('skills_modify')
				.setLabel('Modify')
				.setEmoji('↕️')
				.setDisabled([...Object.keys(profileData?.skills?.personal || {}), ...Object.keys(profileData?.skills?.global || {})].length <= 0)
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('skills_refresh')
				.setEmoji('🔁')
				.setStyle(ButtonStyle.Secondary),
			]);
};

/**
 * It takes a profile data object and returns a string of all the skills in the profile data object
 * @param profileData - The profile data of the user.
 * @returns A string of all the skills and their amounts.
 */
const getSkillList = (
	profileData: Profile | undefined,
) => {

	let skillList = '';
	for (const skillCategory of Object.values(profileData?.skills || {})) {

		for (const [skillName, skillAmount] of Object.entries(skillCategory)) { skillList += `\n${skillName}: \`${skillAmount}\``; }
	}
	if (skillList === '') { skillList = 'There is nothing to show here :('; }
	return skillList;
};

/**
 * It takes a profile and a page number, and returns a menu that shows the skills on that page
 * @param profileData - The profile data of the user.
 * @param page - The page number of the modify menu.
 * @returns An Action Row with a select menu of skills
 */
const getModifyMenu = (
	profileData: Profile | undefined,
	page: number,
): ActionRowBuilder<SelectMenuBuilder> => {

	let modifyMenuOptions: RestOrArray<SelectMenuComponentOptionData> = Object.entries(profileData?.skills || {}).map(([skillCategoryName, skillCategory]) => Object.keys(skillCategory).map(skillName => ({ label: skillName, value: `skills_modify_${skillCategoryName}_${skillName}` }))).flat();

	if (modifyMenuOptions.length > 25) {

		modifyMenuOptions = modifyMenuOptions.splice(page * 24, 24);
		modifyMenuOptions.push({ label: 'Show more skills', value: `skills_modify_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return new ActionRowBuilder<SelectMenuBuilder>()
		.setComponents(new SelectMenuBuilder()
			.setCustomId('skills_modify_options_modal')
			.setPlaceholder('Select a skill to modify')
			.setOptions(modifyMenuOptions));
};

/**
 * It takes in a profile, server, category, and page number, and returns a menu that allows you to edit skills
 * @param profileData - The profile data of the user.
 * @param serverData - The server data of the server.
 * @param category - The category of skills that are edited. This is either "personal" or "global".
 * @param {number} page - The page number of the menu.
 * @returns An Action Row with a select menu of skills
 */
const getEditMenu = (
	profileData: Profile | undefined,
	serverData: ServerSchema | undefined,
	category: 'personal' | 'global',
	page: number,
): ActionRowBuilder<SelectMenuBuilder> => {

	let editMenuOptions: RestOrArray<SelectMenuComponentOptionData> = (category === 'global' ? (serverData?.skills || []) : Object.keys(profileData?.skills.personal || {})).map(skillName => ({ label: skillName, value: `skills_edit_${category}_${skillName}` }));

	if (editMenuOptions.length > 25) {

		editMenuOptions = editMenuOptions.splice(page * 24, 24);
		editMenuOptions.push({ label: 'Show more skills', value: `skills_edit_${category}_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return new ActionRowBuilder<SelectMenuBuilder>()
		.setComponents(new SelectMenuBuilder()
			.setCustomId('skills_edit_options_modal')
			.setPlaceholder('Select a skill to edit')
			.setOptions(editMenuOptions));
};

/**
 * It takes in a profile, a server, a category, and a page number, and returns an action row with a select menu that has options for each skill in the category
 * @param profileData - The profile data of the user.
 * @param {ServerSchema | undefined} serverData - The server data of the server.
 * @param {'personal' | 'global'} category - The category of skills that are edited. This is either "personal" or "global".
 * @param {number} page - The page number of the menu.
 * @returns An Action Row with a select menu of skills
 */
const getRemoveMenu = (
	profileData: Profile | undefined,
	serverData: ServerSchema | undefined,
	category: 'personal' | 'global',
	page: number,
): ActionRowBuilder<SelectMenuBuilder> => {

	let removeMenuOptions: RestOrArray<SelectMenuComponentOptionData> = (category === 'global' ? (serverData?.skills || []) : Object.keys(profileData?.skills.personal || {})).map(skillName => ({ label: skillName, value: `skills_remove_${category}_${skillName}` }));

	if (removeMenuOptions.length > 25) {

		removeMenuOptions = removeMenuOptions.splice(page * 24, 24);
		removeMenuOptions.push({ label: 'Show more skills', value: `skills_remove_${category}_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return new ActionRowBuilder<SelectMenuBuilder>()
		.setComponents(new SelectMenuBuilder()
			.setCustomId('skills_remove_options')
			.setPlaceholder('Select a skill to remove')
			.setOptions(removeMenuOptions));
};