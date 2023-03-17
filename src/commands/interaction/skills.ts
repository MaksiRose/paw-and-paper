import { ActionRowBuilder, ButtonBuilder, ButtonStyle, GuildMember, ModalBuilder, PermissionFlagsBits, RestOrArray, StringSelectMenuBuilder, SelectMenuComponentOptionData, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { capitalize, deepCopy, getArrayElement, respond } from '../../utils/helperFunctions';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { SlashCommand } from '../../typings/handle';
import DiscordUser from '../../models/discordUser';
import User from '../../models/user';
import UserToServer from '../../models/userToServer';
import Quid from '../../models/quid';
import QuidToServer from '../../models/quidToServer';
import Server from '../../models/server';

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

		if (!isInGuild(interaction) || !server) { return; } // This is always a reply

		/* Check if the user wants their own or someone elses skills, and redefine userData if so. */
		let isYourself = true;
		const mentionedUser = interaction.options.getUser('user');
		if (mentionedUser) {

			const discordUser2 = await DiscordUser.findByPk(mentionedUser.id);
			if (!discordUser2) {

				user = undefined;
				userToServer = undefined;
				quid = undefined;
				quidToServer = undefined;
			}
			else if (discordUser2.userId !== user?.id) {

				isYourself = false;
				user = await User.findByPk(discordUser2.userId) ?? undefined;
				userToServer = user ? await UserToServer.findOne({ where: { userId: user.id, serverId: server.id } }) ?? undefined : undefined;
				quid = userToServer?.activeQuidId ? await Quid.findByPk(userToServer.activeQuidId) ?? undefined : undefined;
				quidToServer = quid ? await QuidToServer.findOne({ where: { quidId: quid.id, serverId: server.id } }) ?? undefined : undefined;
			}
		}

		/* Allign the users global skills with the ones defined in the serverData. */
		if (hasNameAndSpecies(quid) && quidToServer) {

			const newGlobalSkills: { [x: string]: number; } = {};
			const qtsSkillsGlobal = JSON.parse(quidToServer.skills_global) as { [x: string]: number; };
			for (const skill of server.skills) { newGlobalSkills[skill] = qtsSkillsGlobal[skill] ?? 0; }
			await quidToServer.update({ skills_global: JSON.stringify(newGlobalSkills) });
		}

		// This is always a reply
		await respond(interaction, {
			content: getSkillList(quidToServer),
			components: isYourself ? [getOriginalComponents(quidToServer, server, interaction.member)] : [],
		});
	},
	async sendMessageComponentResponse(interaction, { user, quidToServer, server }) {

		if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild'); }
		if (server === undefined) { throw new TypeError('server is undefined'); }

		/* Make interaction.values[0] its own variable so its existence can be checked in an if-statement */
		const selectOptionId = interaction.isAnySelectMenu() ? interaction.values[0] : undefined;

		/* Refresh the skills list. */
		if (interaction.isButton() && interaction.customId.includes('refresh')) {

			// This is always an update to the message with the button
			await respond(interaction, {
				content: getSkillList(quidToServer),
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
					getOriginalComponents(quidToServer, server, interaction.member),
					type === 'edit' ? getEditMenu(user?.id ?? interaction.user.id, quidToServer, server, category, 0) : getRemoveMenu(user?.id ?? interaction.user.id, quidToServer, server, category, 0),
				],
			}, 'update', interaction.message.id);
			return;
		}
		/* Add two buttons "personal" and "global". */
		else if (interaction.isButton() && (interaction.customId.includes('add') || interaction.customId.includes('edit') || interaction.customId.includes('remove'))) {

			// This is always an update to the message with the button
			await respond(interaction, {
				components: [
					getOriginalComponents(quidToServer, server, interaction.member),
					new ActionRowBuilder<ButtonBuilder>()
						.setComponents(
							[new ButtonBuilder()
								.setCustomId(`${interaction.customId}_personal${interaction.customId.includes('add') ? '_modal' : ''}`)
								.setLabel('Personal')
								.setEmoji('👤')
								.setDisabled(quidToServer === undefined || (interaction.customId.includes('add') === false && Object.keys(quidToServer.skills_personal).length <= 0))
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
					getOriginalComponents(quidToServer, server, interaction.member),
					getModifyMenu(user?.id ?? interaction.user.id, quidToServer, 0),
				],
			}, 'update', interaction.message.id);
			return;
		}
		/* Change the page of the select menu. */
		else if (interaction.isStringSelectMenu() && selectOptionId && selectOptionId.includes('nextpage')) {

			if (selectOptionId.startsWith('skills_modify_')) {

				let page = Number(selectOptionId.split('_')[3] ?? 0) + 1;
				const totalPages = Math.ceil((Object.keys(quidToServer?.skills_global || {}).length + Object.keys(quidToServer?.skills_personal || {}).length) / 24);
				if (page >= totalPages) { page = 0; }

				// This is always an update to the message with the button
				await respond(interaction, {
					components: [
						getOriginalComponents(quidToServer, server, interaction.member),
						getModifyMenu(user?.id ?? interaction.user.id, quidToServer, page),
					],
				}, 'update', interaction.message.id);
				return;
			}

			if (selectOptionId.startsWith('skills_edit_')) {

				let page = Number(selectOptionId.split('_')[4] ?? 0) + 1;
				const category = getArrayElement(selectOptionId.split('_'), 2) as 'global' | 'personal';
				const totalPages = Math.ceil(((category === 'global' ? server.skills : Object.keys(quidToServer?.skills_personal || {})).length) / 24);
				if (page >= totalPages) { page = 0; }

				// This is always an update to the message with the button
				await respond(interaction, {
					components: [
						getOriginalComponents(quidToServer, server, interaction.member),
						getEditMenu(user?.id ?? interaction.user.id, quidToServer, server, category, page),
					],
				}, 'update', interaction.message.id);
				return;
			}

			if (selectOptionId.startsWith('skills_remove_')) {

				let page = Number(selectOptionId.split('_')[4] ?? 0) + 1;
				const category = getArrayElement(selectOptionId.split('_'), 2) as 'global' | 'personal';
				const totalPages = Math.ceil(((category === 'global' ? server.skills : Object.keys(quidToServer?.skills_personal || {})).length) / 24);
				if (page >= totalPages) { page = 0; }

				// This is always an update to the message with the button
				await respond(interaction, {
					components: [
						getOriginalComponents(quidToServer, server, interaction.member),
						getRemoveMenu(user?.id ?? interaction.user.id, quidToServer, server, category, page),
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
			const cat = `skills_${category}` as 'skills_personal' | 'skills_global';
			const skillName = getArrayElement(selectOptionId.split('_'), 3);

			const qtsSkills = JSON.parse(quidToServer?.[cat] ?? '{}') as { [x: string]: number; };

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
							.setValue(type === 'modify' ? `${qtsSkills[skillName] || 0}` : skillName),
						),
				),
			);
			return;
		}
		/* Removing a skill. */
		else if (interaction.isStringSelectMenu() && selectOptionId && interaction.customId.includes('skills_remove_options')) {

			const category = getArrayElement(selectOptionId.split('_'), 2) as 'global' | 'personal' ;
			const skillName = getArrayElement(selectOptionId.split('_'), 3);

			if (category === 'personal' && quidToServer) {

				const qtsSkillsPersonal = JSON.parse(quidToServer.skills_personal) as { [x: string]: number; };
				delete qtsSkillsPersonal[skillName];
				await quidToServer.update({ skills_personal: JSON.stringify(qtsSkillsPersonal) });
			}
			else {

				const quidsToServer = await QuidToServer.findAll({ where: { serverId: server.id } });

				for (const qts of quidsToServer) {

					const qtsSkillsGlobal = JSON.parse(qts.skills_global) as { [x: string]: number; };
					delete qtsSkillsGlobal[skillName];
					qts.update({ skills_global: JSON.stringify(qtsSkillsGlobal) });
				}

				await server.update({ skills: server.skills.filter(n => n !== skillName) });
			}

			// This is always an update to the message with the button
			await respond(interaction, {
				content: getSkillList(quidToServer),
				components: [getOriginalComponents(quidToServer, server, interaction.member)],
			}, 'update', interaction.message.id);

			// This is always a followUp
			await respond(interaction, {
				content: `You removed the ${category} skill \`${skillName}\`!`,
			});
			return;
		}

	},
	async sendModalResponse(interaction, { quidToServer, server }) {

		if (!interaction.isFromMessage()) { return; }
		if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild'); }
		if (server === undefined) { throw new TypeError('server is undefined'); }

		const type = getArrayElement(interaction.customId.split('_'), 1) as 'modify' | 'edit' | 'add';
		const category = getArrayElement(interaction.customId.split('_'), 2) as 'personal' | 'global';
		const skillName = interaction.customId.split('_')[3]; // This can be undefined if type is add

		if (type === 'add') {

			const newName = interaction.fields.getTextInputValue('skills_add_textinput');
			if (category === 'personal' && quidToServer) {

				if ([...Object.keys(quidToServer?.skills_personal || {}), ...server.skills].includes(newName)) {

					// This is always a reply
					await respond(interaction, {
						content: `I can't add the personal skill \`${newName}\` since the name interferes with another skills name!`,
						ephemeral: true,
					});
					return;
				}

				const qtsSkillsPersonal = JSON.parse(quidToServer.skills_personal) as { [x: string]: number; };
				qtsSkillsPersonal[newName] = 0;
				await quidToServer.update({ skills_personal: JSON.stringify(qtsSkillsPersonal) });
			}
			else {

				const quidsToServer = await QuidToServer.findAll({ where: { serverId: server.id } });

				const allSkillNamesList = [...new Set(quidsToServer.map(qts => Object.keys(qts.skills_personal || {}).filter(array => array.length > 0)).filter(array => array.length > 0).flat()), ...server.skills];

				if (allSkillNamesList.includes(newName)) {

					// This is always a reply
					await respond(interaction, {
						content: `I can't add the global skill \`${newName}\` since the name interferes with another skills name (This includes quids' personal skills in this server)!`,
						ephemeral: true,
					});
					return;
				}

				for (const qts of quidsToServer) {

					const qtsSkillsGlobal = JSON.parse(qts.skills_global) as { [x: string]: number; };
					qtsSkillsGlobal[newName] = 0;
					qts.update({ skills_global: JSON.stringify(qtsSkillsGlobal) });
				}

				const newSkills = deepCopy(server.skills);
				newSkills.push(newName);
				await server.update({ skills: newSkills });
			}

			// This is always an update to the message the modal comes from
			await respond(interaction, {
				content: getSkillList(quidToServer),
				components: [getOriginalComponents(quidToServer, server, interaction.member)],
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
			if (category === 'personal' && quidToServer) {

				if ([...Object.keys(quidToServer?.skills_personal || {}), ...server.skills].includes(newName)) {

					// This is always a reply
					await respond(interaction, {
						content: `I can't edit the personal skill \`${skillName}\` to be called \`${newName}\` since the name interferes with another skills name!`,
						ephemeral: true,
					});
					return;
				}

				const qtsSkillsPersonal = JSON.parse(quidToServer.skills_personal) as { [x: string]: number; };
				qtsSkillsPersonal[newName] = qtsSkillsPersonal[skillName] ?? 0;
				delete qtsSkillsPersonal[skillName];
				await quidToServer.update({ skills_personal: JSON.stringify(qtsSkillsPersonal) });
			}
			else {

				const quidsToServer = await QuidToServer.findAll({ where: { serverId: server.id } });

				const allSkillNamesList = [...new Set(quidsToServer.map(qts => Object.keys(qts.skills_personal || {}).filter(array => array.length > 0)).filter(array => array.length > 0).flat()), ...server.skills];

				if (allSkillNamesList.includes(newName)) {

					// This is always a reply
					await respond(interaction, {
						content: `I can't edit the global skill \`${skillName}\` to be called \`${newName}\` since the new name interferes with another skills name (This includes quids' personal skills in this server)!`,
						ephemeral: true,
					});
					return;
				}

				for (const qts of quidsToServer) {

					const qtsSkillsGlobal = JSON.parse(qts.skills_global) as { [x: string]: number; };
					qtsSkillsGlobal[newName] = qtsSkillsGlobal[skillName] ?? 0;
					delete qtsSkillsGlobal[skillName];
					qts.update({ skills_global: JSON.stringify(qtsSkillsGlobal) });
				}

				const newSkills = deepCopy(server.skills);
				newSkills.push(newName);
				await server.update({ skills: newSkills.filter(n => n !== skillName) });
			}

			// This is always an update to the message the modal comes from
			await respond(interaction, {
				content: getSkillList(quidToServer),
				components: [getOriginalComponents(quidToServer, server, interaction.member)],
			}, 'update', interaction.message.id);

			// This is always a followUp
			await respond(interaction, {
				content: `You changed the name of the ${category} skill \`${skillName}\` to \`${newName}\`!`,
			});
			return;
		}
		else if (type === 'modify' && quidToServer) {

			const cat = 'skills_' + category as 'skills_personal' | 'skills_global';
			const qtsSkills = JSON.parse(quidToServer[cat]) as { [x: string]: number; };

			if (skillName === undefined) { throw new TypeError('skillName is undefined'); }
			const plusOrMinus = interaction.fields.getTextInputValue('skills_modify_textinput').startsWith('+') ? '+' : interaction.fields.getTextInputValue('skills_modify_textinput').startsWith('-') ? '-' : '';
			const newValue = Number(interaction.fields.getTextInputValue('skills_modify_textinput').replace(plusOrMinus, '').replace(/\s/g, ''));
			const oldValue = qtsSkills[skillName] ?? 0;

			if (isNaN(newValue)) {

				// This is always a reply
				await respond(interaction, {
					content: 'Please enter a valid number!',
					ephemeral: true,
				});
				return;
			}

			if (plusOrMinus === '+') { qtsSkills[skillName] += newValue; }
			else if (plusOrMinus === '-') { qtsSkills[skillName] -= newValue; }
			else { qtsSkills[skillName] = newValue; }

			await quidToServer.update({ [cat]: JSON.stringify(qtsSkills) });

			// This is always an update to the message the modal comes from
			await respond(interaction, {
				content: getSkillList(quidToServer),
				components: [getOriginalComponents(quidToServer, server, interaction.member)],
			}, 'update', interaction.message.id);

			// This is always a followUp
			await respond(interaction, {
				content: `You changed the value of the ${category} skill \`${skillName}\` from \`${oldValue}\` to \`${qtsSkills[skillName]}\`!`,
			});
		}
	},
};

/**
 * It returns an Action Row with 5 Buttons
 * @param quidToServer - This is the profile data that is being used to build the menu.
 * @param serverData - The server data from the database
 * @param member - The member that is currently using the menu.
 * @returns An Action Row with Buttons
 */
function getOriginalComponents(
	quidToServer: QuidToServer | null | undefined,
	server: Server,
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
				.setDisabled(([...Object.keys(quidToServer?.skills_personal || {}), ...Object.keys(quidToServer?.skills_global || {})].length <= 0) && (!member.permissions.has(PermissionFlagsBits.Administrator) || server.skills.length <= 0))
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId(`skills_remove_@${member.id}`)
				.setLabel('Delete')
				.setEmoji('🗑️')
				.setDisabled((Object.keys(quidToServer?.skills_personal || {}).length <= 0) && (!member.permissions.has(PermissionFlagsBits.Administrator) || server.skills.length <= 0))
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId(`skills_modify_@${member.id}`)
				.setLabel('Modify')
				.setEmoji('↕️')
				.setDisabled([...Object.keys(quidToServer?.skills_personal || {}), ...Object.keys(quidToServer?.skills_global || {})].length <= 0)
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId(`skills_refresh_@${member.id}`)
				.setEmoji('🔁')
				.setStyle(ButtonStyle.Secondary),
			]);
}

/**
 * It takes a profile data object and returns a string of all the skills in the profile data object
 * @param quidToServer - The profile data of the user.
 * @returns A string of all the skills and their amounts.
 */
function getSkillList(
	quidToServer: QuidToServer | null | undefined,
) {

	let skillList = '';

	const qtsSkillsGlobal = JSON.parse(quidToServer?.skills_global || '{}') as { [x: string]: number; };
	const qtsSkillsPersonal = JSON.parse(quidToServer?.skills_personal || '{}') as { [x: string]: number; };
	for (const skillCategory of Object.values({ ...qtsSkillsGlobal, ...qtsSkillsPersonal })) {

		for (const [skillName, skillAmount] of Object.entries(skillCategory)) { skillList += `\n${skillName}: \`${skillAmount}\``; }
	}

	if (skillList === '') { skillList = 'There is nothing to show here :('; }
	return skillList;
}

/**
 * It takes a profile and a page number, and returns a menu that shows the skills on that page
 * @param quidToServer - The profile data of the user.
 * @param page - The page number of the modify menu.
 * @returns An Action Row with a select menu of skills
 */
function getModifyMenu(
	id: string,
	quidToServer: QuidToServer | null | undefined,
	page: number,
): ActionRowBuilder<StringSelectMenuBuilder> {

	let modifyMenuOptions: RestOrArray<SelectMenuComponentOptionData> = Object.entries({ global: (quidToServer?.skills_global || {}), personal: (quidToServer?.skills_personal || {}) }).map(([skillCategoryName, skillCategory]) => Object.keys(skillCategory).map(skillName => ({ label: skillName, value: `skills_modify_${skillCategoryName}_${skillName}` }))).flat();

	if (modifyMenuOptions.length > 25) {

		modifyMenuOptions = modifyMenuOptions.splice(page * 24, 24);
		modifyMenuOptions.push({ label: 'Show more skills', value: `skills_modify_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return new ActionRowBuilder<StringSelectMenuBuilder>()
		.setComponents(new StringSelectMenuBuilder()
			.setCustomId(`skills_modify_options_modal_@${id}`)
			.setPlaceholder('Select a skill to modify')
			.setOptions(modifyMenuOptions));
}

/**
 * It takes in a profile, server, category, and page number, and returns a menu that allows you to edit skills
 * @param quidToServer - The profile data of the user.
 * @param serverData - The server data of the server.
 * @param category - The category of skills that are edited. This is either "personal" or "global".
 * @param {number} page - The page number of the menu.
 * @returns An Action Row with a select menu of skills
 */
function getEditMenu(
	id: string,
	quidToServer: QuidToServer | null | undefined,
	server: Server,
	category: 'personal' | 'global',
	page: number,
): ActionRowBuilder<StringSelectMenuBuilder> {

	let editMenuOptions: RestOrArray<SelectMenuComponentOptionData> = (category === 'global' ? server.skills : Object.keys(quidToServer?.skills_personal || {})).map(skillName => ({ label: skillName, value: `skills_edit_${category}_${skillName}` }));

	if (editMenuOptions.length > 25) {

		editMenuOptions = editMenuOptions.splice(page * 24, 24);
		editMenuOptions.push({ label: 'Show more skills', value: `skills_edit_${category}_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return new ActionRowBuilder<StringSelectMenuBuilder>()
		.setComponents(new StringSelectMenuBuilder()
			.setCustomId(`skills_edit_options_modal_@${id}`)
			.setPlaceholder('Select a skill to edit')
			.setOptions(editMenuOptions));
}

/**
 * It takes in a profile, a server, a category, and a page number, and returns an action row with a select menu that has options for each skill in the category
 * @param quidToServer - The profile data of the user.
 * @param {ServerSchema | undefined} serverData - The server data of the server.
 * @param {'personal' | 'global'} category - The category of skills that are edited. This is either "personal" or "global".
 * @param {number} page - The page number of the menu.
 * @returns An Action Row with a select menu of skills
 */
function getRemoveMenu(
	id: string,
	quidToServer: QuidToServer | null | undefined,
	server: Server,
	category: 'personal' | 'global',
	page: number,
): ActionRowBuilder<StringSelectMenuBuilder> {

	let removeMenuOptions: RestOrArray<SelectMenuComponentOptionData> = (category === 'global' ? server.skills : Object.keys(quidToServer?.skills_personal || {})).map(skillName => ({ label: skillName, value: `skills_remove_${category}_${skillName}` }));

	if (removeMenuOptions.length > 25) {

		removeMenuOptions = removeMenuOptions.splice(page * 24, 24);
		removeMenuOptions.push({ label: 'Show more skills', value: `skills_remove_${category}_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return new ActionRowBuilder<StringSelectMenuBuilder>()
		.setComponents(new StringSelectMenuBuilder()
			.setCustomId(`skills_remove_options_@${id}`)
			.setPlaceholder('Select a skill to remove')
			.setOptions(removeMenuOptions));
}