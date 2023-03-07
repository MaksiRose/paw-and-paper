import { ActionRowBuilder, ButtonBuilder, ButtonStyle, GuildMember, ModalBuilder, PermissionFlagsBits, RestOrArray, StringSelectMenuBuilder, SelectMenuComponentOptionData, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { capitalize, getArrayElement, respond } from '../../utils/helperFunctions';
import serverModel from '../../oldModels/serverModel';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { saveCommandDisablingInfo } from '../../utils/componentDisabling';
import { getMapData } from '../../utils/helperFunctions';
import { missingPermissions } from '../../utils/permissionHandler';
import { SlashCommand } from '../../typings/handle';
import { userModel, getUserData } from '../../oldModels/userModel';
import { UserData } from '../../typings/data/user';
import { ServerSchema } from '../../typings/data/server';

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('skills')
		.setDescription('Show a list of or edit custom skills/ability scores.')
		.addUserOption(option =>
			option.setName('user')
				.setDescription('A user that you want to look up the skills of')
				.setRequired(false))
		.setDMPermission(false)
		.toJSON(),
	category: 'page4',
	position: 8,
	disablePreviousCommand: true,
	modifiesServerProfile: false,
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer, server }) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', // Needed because of createCommandComponentDisabler
		]) === true) { return; }

		if (!isInGuild(interaction) || !serverData) { return; } // This is always a reply

		/* Check if the user wants their own or someone elses skills, and redefine userData if so. */
		let isYourself = true;
		const mentionedUser = interaction.options.getUser('user');
		if (mentionedUser) {

			isYourself = false;
			const _userData = (() => {
				try { return userModel.findOne(u => Object.keys(u.userIds).includes(mentionedUser.id)); }
				catch { return null; }
			})();
			userData = _userData === null ? null : getUserData(_userData, interaction.guildId, _userData?.quids[_userData.servers[interaction.guildId]?.currentQuid || '']);
		}

		/* Allign the users global skills with the ones defined in the serverData. */
		if (hasNameAndSpecies(userData)) {

			const newGlobalSkills: { [x: string]: number; } = {};
			for (const skill of serverData.skills) { newGlobalSkills[skill] = userData?.quid?.profile.skills.global[skill] ?? 0; }
			await userData.update(
				(u) => {
					const p = getMapData(getMapData(u.quids, userData!.quid!.id).profiles, userData!.quid!.profile!.serverId);
					p.skills.global = newGlobalSkills;
				},
			);
		}

		// This is always a reply
		const botReply = await respond(interaction, {
			content: getSkillList(userData),
			components: isYourself ? [getOriginalComponents(userData, serverData, interaction.member)] : [],
			fetchReply: userData !== null ? true : false,
		});
		if (userData !== null) { saveCommandDisablingInfo(userData, interaction.guildId, interaction.channelId, botReply.id, interaction); }
	},
	async sendMessageComponentResponse(interaction, { user, quid, userToServer, quidToServer, server }) {

		if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild'); }
		if (serverData === null) { throw new TypeError('serverData is null'); }

		/* Make interaction.values[0] its own variable so its existence can be checked in an if-statement */
		const selectOptionId = interaction.isAnySelectMenu() ? interaction.values[0] : undefined;

		/* Refresh the skills list. */
		if (interaction.isButton() && interaction.customId.includes('refresh')) {

			// This is always an update to the message with the button
			await respond(interaction, {
				content: getSkillList(userData),
				components: interaction.message.components,
			}, 'update', interaction.message.id);
			return;
		}
		/* Creating a modal that allows the user to add a skill. */
		else if (interaction.isButton() && interaction.customId.includes('add') && interaction.customId.includes('modal')) {

			const category = getArrayElement(interaction.customId.split('_'), 3);

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
		else if (interaction.isButton() && (interaction.customId.includes('personal') || interaction.customId.includes('global'))) {

			const type = getArrayElement(interaction.customId.split('_'), 1) as 'edit' | 'remove';
			const category = getArrayElement(interaction.customId.split('_'), 3) as 'global' | 'personal';

			// This is always an update to the message with the button
			await respond(interaction, {
				components: [
					getOriginalComponents(userData, serverData, interaction.member),
					type === 'edit' ? getEditMenu(userData?.id ?? interaction.user.id, userData, serverData, category, 0) : getRemoveMenu(userData?.id ?? interaction.user.id, userData, serverData, category, 0),
				],
			}, 'update', interaction.message.id);
			return;
		}
		/* Add two buttons "personal" and "global". */
		else if (interaction.isButton() && (interaction.customId.includes('add') || interaction.customId.includes('edit') || interaction.customId.includes('remove'))) {

			// This is always an update to the message with the button
			await respond(interaction, {
				components: [
					getOriginalComponents(userData, serverData, interaction.member),
					new ActionRowBuilder<ButtonBuilder>()
						.setComponents(
							[new ButtonBuilder()
								.setCustomId(`${interaction.customId}_personal${interaction.customId.includes('add') ? '_modal' : ''}`)
								.setLabel('Personal')
								.setEmoji('👤')
								.setDisabled(userData?.quid?.profile === undefined || (interaction.customId.includes('add') === false && Object.keys(userData?.quid?.profile.skills.personal).length <= 0))
								.setStyle(ButtonStyle.Secondary),
							new ButtonBuilder()
								.setCustomId(`${interaction.customId}_global${interaction.customId.includes('add') ? '_modal' : ''}`)
								.setLabel('Global (server-wide)')
								.setEmoji('👥')
								.setDisabled(interaction.member.permissions.has(PermissionFlagsBits.Administrator) === false)
								.setStyle(ButtonStyle.Secondary),
							]),
				],
			}, 'update', interaction.message.id);
			return;
		}
		/* Add a new select menu to select a skill to modify. */
		else if (interaction.isButton() && interaction.customId.includes('modify')) {

			// This is always an update to the message with the button
			await respond(interaction, {
				components: [
					getOriginalComponents(userData, serverData, interaction.member),
					getModifyMenu(userData?.id ?? interaction.user.id, userData, 0),
				],
			}, 'update', interaction.message.id);
			return;
		}
		/* Change the page of the select menu. */
		else if (interaction.isStringSelectMenu() && selectOptionId && selectOptionId.includes('nextpage')) {

			if (selectOptionId.startsWith('skills_modify_')) {

				let page = Number(selectOptionId.split('_')[3] ?? 0) + 1;
				const totalPages = Math.ceil((Object.keys(userData?.quid?.profile?.skills.global || {}).length + Object.keys(userData?.quid?.profile?.skills.personal || {}).length) / 24);
				if (page >= totalPages) { page = 0; }

				// This is always an update to the message with the button
				await respond(interaction, {
					components: [
						getOriginalComponents(userData, serverData, interaction.member),
						getModifyMenu(userData?.id ?? interaction.user.id, userData, page),
					],
				}, 'update', interaction.message.id);
				return;
			}

			if (selectOptionId.startsWith('skills_edit_')) {

				let page = Number(selectOptionId.split('_')[4] ?? 0) + 1;
				const category = getArrayElement(selectOptionId.split('_'), 2) as 'global' | 'personal';
				const totalPages = Math.ceil(((category === 'global' ? (serverData?.skills || []) : Object.keys(userData?.quid?.profile?.skills.personal || {})).length) / 24);
				if (page >= totalPages) { page = 0; }

				// This is always an update to the message with the button
				await respond(interaction, {
					components: [
						getOriginalComponents(userData, serverData, interaction.member),
						getEditMenu(userData?.id ?? interaction.user.id, userData, serverData, category, page),
					],
				}, 'update', interaction.message.id);
				return;
			}

			if (selectOptionId.startsWith('skills_remove_')) {

				let page = Number(selectOptionId.split('_')[4] ?? 0) + 1;
				const category = getArrayElement(selectOptionId.split('_'), 2) as 'global' | 'personal';
				const totalPages = Math.ceil(((category === 'global' ? (serverData?.skills || []) : Object.keys(userData?.quid?.profile?.skills.personal || {})).length) / 24);
				if (page >= totalPages) { page = 0; }

				// This is always an update to the message with the button
				await respond(interaction, {
					components: [
						getOriginalComponents(userData, serverData, interaction.member),
						getRemoveMenu(userData?.id ?? interaction.user.id, userData, serverData, category, page),
					],
				}, 'update', interaction.message.id);
				return;
			}
			return;
		}
		/* Creating a modal that allows the user to edit or modify a skill. */
		else if (interaction.isStringSelectMenu() && selectOptionId && interaction.customId.includes('modal')) {

			const type = getArrayElement(selectOptionId.split('_'), 1) as 'modify' | 'edit';
			const category = getArrayElement(selectOptionId.split('_'), 2) as 'personal' | 'global';
			const skillName = getArrayElement(selectOptionId.split('_'), 3);

			await interaction.showModal(new ModalBuilder()
				.setCustomId(`skills_${type}_${category}_${skillName}`)
				.setTitle(`${capitalize(type)} ${category} skill "${skillName}"`)
				.addComponents(
					new ActionRowBuilder<TextInputBuilder>()
						.setComponents(new TextInputBuilder()
							.setCustomId(`skills_${type}_textinput`)
							.setLabel(type === 'edit' ? 'New name' : 'New value')
							.setStyle(TextInputStyle.Short)
							.setMaxLength(25)
							.setRequired(true)
							.setValue(type === 'modify' ? `${userData?.quid?.profile?.skills[category][skillName] || 0}` : skillName),
						),
				),
			);
			return;
		}
		/* Removing a skill. */
		else if (interaction.isStringSelectMenu() && selectOptionId && interaction.customId.includes('skills_remove_options')) {

			const category = getArrayElement(selectOptionId.split('_'), 2) as 'global' | 'personal' ;
			const skillName = getArrayElement(selectOptionId.split('_'), 3);

			if (category === 'personal' && userData) {

				await userData.update(
					(u) => {
						const p = getMapData(getMapData(u.quids, getMapData(u.servers, interaction.guildId).currentQuid ?? '').profiles, interaction.guildId);
						delete p.skills[category][skillName];
					},
				);
			}
			else {

				const allServerUsers = await userModel.find(
					(u) => Object.values(u.quids).filter(q => Object.keys(q.profiles).includes(interaction.guildId)).length > 0,
				);

				for (const _user of allServerUsers) {

					const user = userData && _user.id === userData.id ? userData : getUserData(_user, interaction.guildId, undefined);
					await user.update(
						(u) => {
							for (const q of Object.values(u.quids)) {
								if (q.profiles[interaction.guildId] !== undefined) {
									const p = getMapData(getMapData(u.quids, getMapData(u.servers, interaction.guildId).currentQuid ?? '').profiles, interaction.guildId);
									delete p.skills[category][skillName];
								}
							}
						},
					);
				}

				serverData = await serverModel.findOneAndUpdate(
					s => s.id === serverData?.id,
					(s) => {
						s.skills = s.skills.filter(n => n !== skillName);
					},
				);
			}

			// This is always an update to the message with the button
			await respond(interaction, {
				content: getSkillList(userData),
				components: [getOriginalComponents(userData, serverData, interaction.member)],
			}, 'update', interaction.message.id);

			// This is always a followUp
			await respond(interaction, {
				content: `You removed the ${category} skill \`${skillName}\`!`,
			});
			return;
		}

	},
	async sendModalResponse(interaction, userData, serverData) {

		if (!interaction.isFromMessage()) { return; }
		if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild'); }
		if (serverData === null) { throw new TypeError('serverData is null'); }

		const type = getArrayElement(interaction.customId.split('_'), 1) as 'modify' | 'edit' | 'add';
		const category = getArrayElement(interaction.customId.split('_'), 2) as 'personal' | 'global';
		const skillName = interaction.customId.split('_')[3]; // This can be undefined if type is add

		if (type === 'add') {

			const newName = interaction.fields.getTextInputValue('skills_add_textinput');
			if (category === 'personal' && userData) {

				if ([...Object.keys(userData?.quid?.profile?.skills?.personal || {}), ...serverData.skills].includes(newName)) {

					// This is always a reply
					await respond(interaction, {
						content: `I can't add the personal skill \`${newName}\` since the name interferes with another skills name!`,
						ephemeral: true,
					});
					return;
				}

				await userData.update(
					(u) => {
						const p = getMapData(getMapData(u.quids, getMapData(u.servers, interaction.guildId).currentQuid ?? '').profiles, interaction.guildId);
						p.skills[category][newName] = 0;
					},
				);
			}
			else {

				const allServerUsers = await userModel.find(
					(u) => Object.values(u.quids).filter(q => Object.keys(q.profiles).includes(interaction.guildId)).length > 0,
				);

				const allSkillNamesList = [...new Set(allServerUsers.map(u => Object.values(u.quids).map(q => Object.keys(q.profiles[interaction.guildId]?.skills.personal || {}))).map(array1 => array1.filter(array2 => array2.length > 0)).filter(array => array.length > 0).flat(2)), ...serverData.skills];

				if (allSkillNamesList.includes(newName)) {

					// This is always a reply
					await respond(interaction, {
						content: `I can't add the global skill \`${newName}\` since the name interferes with another skills name!`,
						ephemeral: true,
					});
					return;
				}

				for (const _user of allServerUsers) {

					const user = userData && _user.id === userData.id ? userData : getUserData(_user, interaction.guildId, undefined);
					await user.update(
						(u) => {
							for (const q of Object.values(u.quids)) {
								if (q.profiles[interaction.guildId] !== undefined) {
									const p = getMapData(getMapData(u.quids, getMapData(u.servers, interaction.guildId).currentQuid ?? '').profiles, interaction.guildId);
									p.skills.global[newName] = 0;
								}
							}
						},
					);
				}

				serverData = await serverModel.findOneAndUpdate(
					s => s.id === serverData?.id,
					(s) => {
						s.skills.push(newName);
					},
				);
			}

			// This is always an update to the message the modal comes from
			await respond(interaction, {
				content: getSkillList(userData),
				components: [getOriginalComponents(userData, serverData, interaction.member)],
			}, 'update', interaction.message.id);

			// This is always a followUp
			await respond(interaction, {
				content: `You added the ${category} skill \`${newName}\`!`,
			});
			return;
		}
		else if (type === 'edit') {

			if (skillName === undefined) { throw new TypeError('skillName is undefined'); }
			const newName = interaction.fields.getTextInputValue('skills_edit_textinput');
			if (category === 'personal' && userData) {

				if ([...Object.keys(userData?.quid?.profile?.skills?.personal || {}), ...serverData.skills].includes(newName)) {

					// This is always a reply
					await respond(interaction, {
						content: `I can't edit the personal skill \`${skillName}\` to be called \`${newName}\` since the name interferes with another skills name!`,
						ephemeral: true,
					});
					return;
				}

				await userData.update(
					(u) => {
						const p = getMapData(getMapData(u.quids, getMapData(u.servers, interaction.guildId).currentQuid ?? '').profiles, interaction.guildId);
						p.skills.personal[newName] = p.skills.personal[skillName] ?? 0;
						delete p.skills.personal[skillName];
					},
				);
			}
			else {

				const allServerUsers = await userModel.find(
					(u) => Object.values(u.quids).filter(q => Object.keys(q.profiles).includes(interaction.guildId)).length > 0,
				);

				const allSkillNamesList = [...new Set(allServerUsers.map(u => Object.values(u.quids).map(q => Object.keys(q.profiles[interaction.guildId]?.skills.personal || {}))).map(array1 => array1.filter(array2 => array2.length > 0)).filter(array => array.length > 0).flat(2)), ...serverData.skills];

				if (allSkillNamesList.includes(newName)) {

					// This is always a reply
					await respond(interaction, {
						content: `I can't edit the global skill \`${skillName}\` to be called \`${newName}\` since the new name interferes with another skills name!`,
						ephemeral: true,
					});
					return;
				}

				for (const _user of allServerUsers) {

					const user = userData && _user.id === userData.id ? userData : getUserData(_user, interaction.guildId, undefined);
					await user.update(
						(u) => {
							for (const q of Object.values(u.quids)) {
								if (q.profiles[interaction.guildId] !== undefined) {
									const p = getMapData(getMapData(u.quids, getMapData(u.servers, interaction.guildId).currentQuid ?? '').profiles, interaction.guildId);
									p.skills.global[newName] = p.skills.global[skillName] ?? 0;
									delete p.skills.global[skillName];
								}
							}
						},
					);
				}

				serverData = await serverModel.findOneAndUpdate(
					s => s.id === serverData?.id,
					(s) => {
						s.skills.push(newName);
						s.skills = s.skills.filter(n => n !== skillName);
					},
				);
			}

			// This is always an update to the message the modal comes from
			await respond(interaction, {
				content: getSkillList(userData),
				components: [getOriginalComponents(userData, serverData, interaction.member)],
			}, 'update', interaction.message.id);

			// This is always a followUp
			await respond(interaction, {
				content: `You changed the name of the ${category} skill \`${skillName}\` to \`${newName}\`!`,
			});
			return;
		}
		else if (type === 'modify' && userData && userData?.quid && userData?.quid?.profile) {

			if (skillName === undefined) { throw new TypeError('skillName is undefined'); }
			const plusOrMinus = interaction.fields.getTextInputValue('skills_modify_textinput').startsWith('+') ? '+' : interaction.fields.getTextInputValue('skills_modify_textinput').startsWith('-') ? '-' : '';
			const newValue = Number(interaction.fields.getTextInputValue('skills_modify_textinput').replace(plusOrMinus, '').replace(/\s/g, ''));
			const oldValue = userData?.quid?.profile.skills[category][skillName] ?? 0;

			if (isNaN(newValue)) {

				// This is always a reply
				await respond(interaction, {
					content: 'Please enter a valid number!',
					ephemeral: true,
				});
				return;
			}

			await userData.update(
				(u) => {
					const p = getMapData(getMapData(u.quids, getMapData(u.servers, interaction.guildId).currentQuid ?? '').profiles, interaction.guildId);
					if (plusOrMinus === '+') { p.skills[category][skillName] += newValue; }
					else if (plusOrMinus === '-') { p.skills[category][skillName] -= newValue; }
					else { p.skills[category][skillName] = newValue; }
				},
			);

			// This is always an update to the message the modal comes from
			await respond(interaction, {
				content: getSkillList(userData),
				components: [getOriginalComponents(userData, serverData, interaction.member)],
			}, 'update', interaction.message.id);

			// This is always a followUp
			await respond(interaction, {
				content: `You changed the value of the ${category} skill \`${skillName}\` from \`${oldValue}\` to \`${userData?.quid?.profile.skills[category][skillName]}\`!`,
			});
		}

	},
};

/**
 * It returns an Action Row with 5 Buttons
 * @param userData?.quid?.profile - This is the profile data that is being used to build the menu.
 * @param serverData - The server data from the database
 * @param member - The member that is currently using the menu.
 * @returns An Action Row with Buttons
 */
function getOriginalComponents(
	userData: UserData<undefined, ''> | null,
	serverData: ServerSchema,
	member: GuildMember,
): ActionRowBuilder<ButtonBuilder> {

	return new ActionRowBuilder<ButtonBuilder>()
		.setComponents(
			[new ButtonBuilder()
				.setCustomId(`skills_add_@${member.id}`)
				.setLabel('Add')
				.setEmoji('✏️')
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId(`skills_edit_@${member.id}`)
				.setLabel('Edit')
				.setEmoji('📝')
				.setDisabled(([...Object.keys(userData?.quid?.profile?.skills?.personal || {}), ...Object.keys(userData?.quid?.profile?.skills?.global || {})].length <= 0) && (!member.permissions.has(PermissionFlagsBits.Administrator) || serverData.skills.length <= 0))
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId(`skills_remove_@${member.id}`)
				.setLabel('Delete')
				.setEmoji('🗑️')
				.setDisabled((Object.keys(userData?.quid?.profile?.skills.personal || {}).length <= 0) && (!member.permissions.has(PermissionFlagsBits.Administrator) || serverData.skills.length <= 0))
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId(`skills_modify_@${member.id}`)
				.setLabel('Modify')
				.setEmoji('↕️')
				.setDisabled([...Object.keys(userData?.quid?.profile?.skills?.personal || {}), ...Object.keys(userData?.quid?.profile?.skills?.global || {})].length <= 0)
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId(`skills_refresh_@${member.id}`)
				.setEmoji('🔁')
				.setStyle(ButtonStyle.Secondary),
			]);
}

/**
 * It takes a profile data object and returns a string of all the skills in the profile data object
 * @param userData?.quid?.profile - The profile data of the user.
 * @returns A string of all the skills and their amounts.
 */
function getSkillList(
	userData: UserData<undefined, ''> | null,
) {

	let skillList = '';
	for (const skillCategory of Object.values(userData?.quid?.profile?.skills || {})) {

		for (const [skillName, skillAmount] of Object.entries(skillCategory)) { skillList += `\n${skillName}: \`${skillAmount}\``; }
	}
	if (skillList === '') { skillList = 'There is nothing to show here :('; }
	return skillList;
}

/**
 * It takes a profile and a page number, and returns a menu that shows the skills on that page
 * @param userData?.quid?.profile - The profile data of the user.
 * @param page - The page number of the modify menu.
 * @returns An Action Row with a select menu of skills
 */
function getModifyMenu(
	_id: string,
	userData: UserData<undefined, ''> | null,
	page: number,
): ActionRowBuilder<StringSelectMenuBuilder> {

	let modifyMenuOptions: RestOrArray<SelectMenuComponentOptionData> = Object.entries(userData?.quid?.profile?.skills || {}).map(([skillCategoryName, skillCategory]) => Object.keys(skillCategory).map(skillName => ({ label: skillName, value: `skills_modify_${skillCategoryName}_${skillName}` }))).flat();

	if (modifyMenuOptions.length > 25) {

		modifyMenuOptions = modifyMenuOptions.splice(page * 24, 24);
		modifyMenuOptions.push({ label: 'Show more skills', value: `skills_modify_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return new ActionRowBuilder<StringSelectMenuBuilder>()
		.setComponents(new StringSelectMenuBuilder()
			.setCustomId(`skills_modify_options_modal_@${_id}`)
			.setPlaceholder('Select a skill to modify')
			.setOptions(modifyMenuOptions));
}

/**
 * It takes in a profile, server, category, and page number, and returns a menu that allows you to edit skills
 * @param userData?.quid?.profile - The profile data of the user.
 * @param serverData - The server data of the server.
 * @param category - The category of skills that are edited. This is either "personal" or "global".
 * @param {number} page - The page number of the menu.
 * @returns An Action Row with a select menu of skills
 */
function getEditMenu(
	_id: string,
	userData: UserData<undefined, ''> | null,
	serverData: ServerSchema | undefined,
	category: 'personal' | 'global',
	page: number,
): ActionRowBuilder<StringSelectMenuBuilder> {

	let editMenuOptions: RestOrArray<SelectMenuComponentOptionData> = (category === 'global' ? (serverData?.skills || []) : Object.keys(userData?.quid?.profile?.skills.personal || {})).map(skillName => ({ label: skillName, value: `skills_edit_${category}_${skillName}` }));

	if (editMenuOptions.length > 25) {

		editMenuOptions = editMenuOptions.splice(page * 24, 24);
		editMenuOptions.push({ label: 'Show more skills', value: `skills_edit_${category}_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return new ActionRowBuilder<StringSelectMenuBuilder>()
		.setComponents(new StringSelectMenuBuilder()
			.setCustomId(`skills_edit_options_modal_@${_id}`)
			.setPlaceholder('Select a skill to edit')
			.setOptions(editMenuOptions));
}

/**
 * It takes in a profile, a server, a category, and a page number, and returns an action row with a select menu that has options for each skill in the category
 * @param userData?.quid?.profile - The profile data of the user.
 * @param {ServerSchema | undefined} serverData - The server data of the server.
 * @param {'personal' | 'global'} category - The category of skills that are edited. This is either "personal" or "global".
 * @param {number} page - The page number of the menu.
 * @returns An Action Row with a select menu of skills
 */
function getRemoveMenu(
	_id: string,
	userData: UserData<undefined, ''> | null,
	serverData: ServerSchema | undefined,
	category: 'personal' | 'global',
	page: number,
): ActionRowBuilder<StringSelectMenuBuilder> {

	let removeMenuOptions: RestOrArray<SelectMenuComponentOptionData> = (category === 'global' ? (serverData?.skills || []) : Object.keys(userData?.quid?.profile?.skills.personal || {})).map(skillName => ({ label: skillName, value: `skills_remove_${category}_${skillName}` }));

	if (removeMenuOptions.length > 25) {

		removeMenuOptions = removeMenuOptions.splice(page * 24, 24);
		removeMenuOptions.push({ label: 'Show more skills', value: `skills_remove_${category}_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return new ActionRowBuilder<StringSelectMenuBuilder>()
		.setComponents(new StringSelectMenuBuilder()
			.setCustomId(`skills_remove_options_@${_id}`)
			.setPlaceholder('Select a skill to remove')
			.setOptions(removeMenuOptions));
}