// @ts-check
const { MessageActionRow, MessageButton, Modal, MessageSelectMenu, TextInputComponent } = require('discord.js');
const profileModel = require('../../models/profileModel');
const serverModel = require('../../models/serverModel');
const { createCommandCollector } = require('../../utils/commandCollector');
const disableAllComponents = require('../../utils/disableAllComponents');
let hasModalCollector = false;

module.exports.name = 'skills';
module.exports.aliases = ['abilityscores', 'ability', 'scores'];

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').ServerSchema} serverData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData, serverData) => {

	/* Checking if the user has a character, if they do, it checks if they have a profile, if they do, it
	sets the isYourself variable to true. */
	let characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
	let profileData = characterData?.profiles?.[message.guild.id];
	let isYourself = true;

	/* Checking if the message mentions a user. If it does, it will get the user's data from the database. */
	if (message.mentions.users.size > 0) {

		userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: message.mentions.users.first().id }));
		characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
		profileData = characterData?.profiles?.[message.guild.id];
		isYourself = false;
	}


	/* Creating a message with 4 buttons and a skill list. */
	const basicButtons = new MessageActionRow().addComponents(
		[ new MessageButton({
			customId: 'skills-add',
			label: 'Add',
			emoji: '✏️',
			style: 'SECONDARY',
		}), new MessageButton({
			customId: 'skills-edit',
			label: 'Edit',
			emoji: '📝',
			disabled: [...Object.keys(profileData?.skills?.personal || {}), ...Object.keys(profileData?.skills?.global || {})].length <= 0,
			style: 'SECONDARY',
		}), new MessageButton({
			customId: 'skills-remove',
			label: 'Delete',
			emoji: '🗑️',
			disabled: !(Object.keys(profileData?.skills?.personal || {}).length > 0 || (message.member.permissions.has('ADMINISTRATOR') && serverData?.skills?.length > 0)),
			style: 'SECONDARY',
		}), new MessageButton({
			customId: 'skills-modify',
			label: 'Modify',
			emoji: '↕️',
			disabled: [...Object.keys(profileData?.skills?.personal || {}), ...Object.keys(profileData?.skills?.global || {})].length <= 0,
			style: 'SECONDARY',
		}), new MessageButton({
			customId: 'skills-refresh',
			emoji: '🔁',
			style: 'SECONDARY',
		})],
	);
	let botReply = await message
		.reply({
			content: getSkillList(profileData),
			components: isYourself ? [basicButtons] : [],
		})
		.catch((error) => { throw new Error(error); });

	createCommandCollector(message.author.id, message.guild.id, botReply);
	interactionCollector();

	async function interactionCollector() {

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => (i.customId.includes('skills')) && i.user.id === message.author.id;

		/** @type {import('discord.js').MessageComponentInteraction | null} */
		await botReply
			.awaitMessageComponent({ filter, time: 120_000 })
			.then(async interaction => {

				/* Checking if the interaction is a button and if the customId is skills-refresh. If it is, it will
				refresh the skills list. */
				if (interaction.isButton() && interaction.customId === 'skills-refresh') {

					userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: userData.userId }));
					characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
					profileData = characterData?.profiles?.[message.guild.id];
					botReply = await botReply
						.edit({
							content: getSkillList(profileData),
							components: isYourself ? [basicButtons] : [],
						})
						.catch((error) => { throw new Error(error); });

					return await interactionCollector();
				}

				/* Editing the message to add a new row of buttons for adding/editing/removing a skill. */
				if (interaction.isButton() && (interaction.customId === 'skills-add' || interaction.customId === 'skills-edit' || interaction.customId === 'skills-remove')) {

					await /** @type {import('discord.js').Message} */ (interaction.message)
						.edit({
							components: [
								basicButtons,
								new MessageActionRow().addComponents(
									[new MessageButton({
										customId: `${interaction.customId}-personal${interaction.customId === 'skills-add' ? '-modal' : ''}`,
										label: 'Personal',
										emoji: '👤',
										style: 'SECONDARY',
									}), new MessageButton({
										customId: `${interaction.customId}-global${interaction.customId === 'skills-add' ? '-modal' : ''}`,
										label: 'Global',
										emoji: '👥',
										disabled: message.member.permissions.has('ADMINISTRATOR') === false,
										style: 'SECONDARY',
									})],
								),
							],
						})
						.catch((error) => {
							if (error.httpStatus !== 404) { throw new Error(error); }
						});

					return await interactionCollector();
				}

				/* Editing the message to add a new select menu to select a skill to modify. */
				if (interaction.isButton() && interaction.customId === 'skills-modify') {

					const modifyMenu = new MessageSelectMenu({
						customId: 'skills-modify-options-modal',
						placeholder: 'Select a skill to modify',
					});
					for (const [skillCategoryName, skillCategory] of Object.entries(profileData?.skills || {})) {

						for (const skillName of Object.keys(skillCategory)) {

							modifyMenu.addOptions({ label: skillName, value: `skills-modify-${skillCategoryName}-${skillName}` });
						}
					}
					if (modifyMenu.options.length > 25) { modifyMenu.options.length = 25; }

					await /** @type {import('discord.js').Message} */ (interaction.message)
						.edit({
							components: [
								basicButtons,
								new MessageActionRow().addComponents([modifyMenu]),
							],
						})
						.catch((error) => {
							if (error.httpStatus !== 404) { throw new Error(error); }
						});

					return await interactionCollector();
				}

				/* Editing the message to add a new select menu to select a skill to edit/remove. */
				if (interaction.isButton() && (interaction.customId === 'skills-edit-personal' || interaction.customId === 'skills-edit-global' || interaction.customId === 'skills-remove-personal' || interaction.customId === 'skills-remove-global')) {

					const type = interaction.customId.split('-')[1];
					const category = interaction.customId.split('-')[2];

					const modifyMenu = new MessageSelectMenu({
						customId: `skills-${type}-options${type === 'edit' ? '-modal' : ''}`,
						placeholder: `Select a skill to ${type}`,
					});
					for (const skillName of Object.keys(profileData?.skills?.[category] || {})) {

						modifyMenu.addOptions({ label: skillName, value: `skills-${type}-${category}-${skillName}` });
					}
					if (modifyMenu.options.length > 25) { modifyMenu.options.length = 25; }

					await /** @type {import('discord.js').Message} */ (interaction.message)
						.edit({
							components: [
								basicButtons,
								new MessageActionRow().addComponents([modifyMenu]),
							],
						})
						.catch((error) => {
							if (error.httpStatus !== 404) { throw new Error(error); }
						});

					return await interactionCollector();
				}

				/* Removing a skill from the user's profile. */
				if (interaction.isSelectMenu() && interaction.customId === 'skills-remove-options') {

					const category = interaction.values[0].split('-')[2];
					const name = interaction.values[0].split('-')[3];

					if (category === 'personal') {

						userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
							{ userId: message.author.id },
							(/** @type {import('../../typedef').ProfileSchema} */ p) => {
								delete p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].skills[category][name];
							},
						));
					}
					else {

						const allUsers = await profileModel.find();

						for (const user of allUsers) {

							await profileModel.findOneAndUpdate(
								{ userId: user.userId },
								(/** @type {import('../../typedef').ProfileSchema} */ p) => {
									for (const c of Object.values(p.characters)) {
										if (c.profiles[message.guild.id] !== undefined) {
											delete p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].skills[category][name];
										}
									}
								},
							);
						}

						await serverModel.findOneAndUpdate(
							{ serverId: message.guild.id },
							(/** @type {import('../../typedef').ServerSchema} */ s) => {
								s.skills = s.skills.filter(n => n !== name);
							},
						);

						userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: userData.userId }));
					}

					characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
					profileData = characterData?.profiles?.[message.guild.id];
					botReply = await botReply
						.edit({
							content: getSkillList(profileData),
							components: isYourself ? [basicButtons] : [],
						})
						.catch((error) => { throw new Error(error); });

					await interaction
						.followUp({
							content: `You removed the ${category} skill \`${name}\`!`,
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});

					return await interactionCollector();
				}

				/* Creating a modal that allows the user to add a skill. */
				if (interaction.isButton() && (interaction.customId === 'skills-add-personal-modal' || interaction.customId === 'skills-add-global-modal')) {

					const category = interaction.customId.split('-')[2];

					interaction.showModal(new Modal()
						.setCustomId(`skills-add-${category}`)
						.setTitle(`Add ${category} skill`)
						.addComponents(
							new MessageActionRow({
								components: [new TextInputComponent()
									.setCustomId(`skills-add-${category}-textinput`)
									.setLabel('Name')
									.setStyle('SHORT')
									.setMaxLength(25)
									.setRequired(true),
								],
							}),
						),
					);

					interactionCollector();
				}

				/* Creating a modal that allows the user to edit or modify a skill. */
				if (interaction.isSelectMenu() && (interaction.customId === 'skills-modify-options-modal' || interaction.customId === 'skills-edit-options-modal')) {

					const type = interaction.values[0].split('-')[1];
					const category = interaction.values[0].split('-')[2];
					const name = interaction.values[0].split('-')[3];

					interaction.showModal(new Modal()
						.setCustomId(`skills-${type}-${category}-${name}`)
						.setTitle(`${type.charAt(0).toUpperCase() + type.slice(1)} ${category} skill "${name}"`)
						.addComponents(
							new MessageActionRow({
								components: [ new TextInputComponent()
									.setCustomId(`skills-${type}-${category}-${name}-textinput`)
									.setLabel(type === 'edit' ? 'New name' : 'New value')
									.setStyle('SHORT')
									.setMaxLength(25)
									.setRequired(true)
									.setValue(type === 'modify' ? `${profileData.skills[category][name]}` : name),
								],
							}),
						),
					);

					interactionCollector();
				}


				if (hasModalCollector) {

					return;
				}
				hasModalCollector = true;

				interaction.awaitModalSubmit({ filter: i => i.customId.includes('skill'), time: 120_000 })
					.then(async i => {

						hasModalCollector = false;

						const type = i.customId.split('-')[1];
						const category = i.customId.split('-')[2];
						const name = i.customId.split('-')[3];

						if (type === 'add') {

							const newName = i.components[0].components[0].value;
							if (category === 'personal') {

								if ([...Object.keys(profileData?.skills?.personal || {}), ...serverData.skills].includes(newName)) {

									await botReply
										.reply({
											content: `I can't add the personal skill \`${newName}\` since the name interferes with another skills name!`,
										})
										.catch((error) => {
											if (error.httpStatus !== 404) {
												throw new Error(error);
											}
										});
									return;
								}

								userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
									{ userId: i.user.id },
									(/** @type {import('../../typedef').ProfileSchema} */ p) => {
										p.characters[p.currentCharacter[i.guild.id]].profiles[i.guild.id].skills.personal[newName] = 0;
									},
								));
							}
							else {

								const allUsers = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel.find());

								const allSkillNamesList = [...new Set(allUsers.map(u => Object.values(u.characters).map(c => Object.keys(c.profiles[message.guild.id]?.skills?.personal || {}))).map(array1 => array1.filter(array2 => array2.length > 0)).filter(array => array.length > 0).flat(2)), ...serverData.skills];
								if (allSkillNamesList.includes(newName)) {

									await botReply
										.reply({
											content: `I can't add the global skill \`${newName}\` since the name interferes with another skills name!`,
										})
										.catch((error) => {
											if (error.httpStatus !== 404) {
												throw new Error(error);
											}
										});
									return;
								}

								for (const user of allUsers) {

									await profileModel.findOneAndUpdate(
										{ userId: user.userId },
										(/** @type {import('../../typedef').ProfileSchema} */ p) => {
											for (const c of Object.values(p.characters)) {
												if (c.profiles[i.guild.id] !== undefined) {
													p.characters[c._id].profiles[i.guild.id].skills.global[newName] = 0;
												}
											}
										},
									);
								}

								await serverModel.findOneAndUpdate(
									{ serverId: i.guild.id },
									(/** @type {import('../../typedef').ServerSchema} */ s) => {
										s.skills.push(newName);
									},
								);

								userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: userData.userId }));
							}

							characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
							profileData = characterData?.profiles?.[message.guild.id];
							botReply = await botReply
								.edit({
									content: getSkillList(profileData),
									components: isYourself ? [basicButtons] : [],
								})
								.catch((error) => { throw new Error(error); });

							await botReply
								.reply({
									content: `You added the ${category} skill \`${newName}\`!`,
								})
								.catch((error) => {
									if (error.httpStatus !== 404) {
										throw new Error(error);
									}
								});
						}
						else if (type === 'edit') {

							const newName = i.components[0].components[0].value;
							if (category === 'personal') {

								if ([...Object.keys(profileData?.skills?.personal || {}), ...serverData.skills].includes(newName)) {

									await botReply
										.reply({
											content: `I can't edit the personal skill \`${name}\` to be called ${newName} since the name interferes with another skills name!`,
										})
										.catch((error) => {
											if (error.httpStatus !== 404) {
												throw new Error(error);
											}
										});
									return;
								}
								userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
									{ userId: i.user.id },
									(/** @type {import('../../typedef').ProfileSchema} */ p) => {
										p.characters[p.currentCharacter[i.guild.id]].profiles[i.guild.id].skills.personal[newName] = p.characters[p.currentCharacter[i.guild.id]].profiles[i.guild.id].skills.personal[name];
										delete p.characters[p.currentCharacter[i.guild.id]].profiles[i.guild.id].skills.personal[name];
									},
								));
							}
							else {

								const allUsers = await profileModel.find();

								const allSkillNamesList = [...new Set(allUsers.map(u => Object.values(u.characters).map(c => Object.keys(c.profiles[message.guild.id]?.skills?.personal || {}))).map(array1 => array1.filter(array2 => array2.length > 0)).filter(array => array.length > 0).flat(2)), ...serverData.skills];
								if (allSkillNamesList.includes(newName)) {

									await botReply
										.reply({
											content: `I can't edit the global skill \`${name}\` to be called ${newName} since the name interferes with another skills name!`,
										})
										.catch((error) => {
											if (error.httpStatus !== 404) {
												throw new Error(error);
											}
										});
									return;
								}

								for (const user of allUsers) {

									await profileModel.findOneAndUpdate(
										{ userId: user.userId },
										(/** @type {import('../../typedef').ProfileSchema} */ p) => {
											for (const c of Object.values(p.characters)) {
												if (c.profiles[i.guild.id] !== undefined) {
													p.characters[c._id].profiles[i.guild.id].skills.global[newName] = p.characters[c._id].profiles[i.guild.id].skills.global[name];
													delete p.characters[c._id].profiles[i.guild.id].skills.global[name];
												}
											}
										},
									);
								}

								await serverModel.findOneAndUpdate(
									{ serverId: i.guild.id },
									(/** @type {import('../../typedef').ServerSchema} */ s) => {
										s.skills.push(newName);
										s.skills = s.skills.filter(n => n !== name);
									},
								);

								userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: userData.userId }));
							}

							characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
							profileData = characterData?.profiles?.[message.guild.id];
							botReply = await botReply
								.edit({
									content: getSkillList(profileData),
									components: isYourself ? [basicButtons] : [],
								})
								.catch((error) => { throw new Error(error); });

							await botReply
								.reply({
									content: `You changed the name of the ${category} skill \`${name}\` to \`${newName}\`!`,
								})
								.catch((error) => {
									if (error.httpStatus !== 404) {
										throw new Error(error);
									}
								});
						}
						else if (type === 'modify') {

							const plusOrMinus = i.components[0].components[0].value.includes('+') ? '+' : i.components[0].components[0].value.includes('-') ? '-' : '';
							const newValue = Number(i.components[0].components[0].value.replace(plusOrMinus, '').replace(/\s/g, ''));
							const oldValue = profileData.skills[category][name];

							if (isNaN(newValue)) {

								await botReply
									.reply({
										content: 'Please enter a valid number!',
									})
									.catch((error) => {
										if (error.httpStatus !== 404) {
											throw new Error(error);
										}
									});
								return;
							}

							userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
								{ userId: i.user.id },
								(/** @type {import('../../typedef').ProfileSchema} */ p) => {
									if (plusOrMinus === '+') { p.characters[p.currentCharacter[i.guild.id]].profiles[i.guild.id].skills[category][name] += newValue; }
									else if (plusOrMinus === '-') { p.characters[p.currentCharacter[i.guild.id]].profiles[i.guild.id].skills[category][name] -= newValue; }
									else { p.characters[p.currentCharacter[i.guild.id]].profiles[i.guild.id].skills[category][name] = newValue; }
								},
							));
							characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
							profileData = characterData?.profiles?.[message.guild.id];
							botReply = await botReply
								.edit({
									content: getSkillList(profileData),
									components: isYourself ? [basicButtons] : [],
								})
								.catch((error) => { throw new Error(error); });

							await botReply
								.reply({
									content: `You changed the value of the ${category} skill \`${name}\` from \`${oldValue}\` to \`${profileData.skills[category][name]}\`!`,
								})
								.catch((error) => {
									if (error.httpStatus !== 404) {
										throw new Error(error);
									}
								});
						}
					})
					.catch(() => {
						hasModalCollector = false;
					});
			})
			.catch(async () => {

				await botReply
					.edit({
						components: disableAllComponents(botReply.components),
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
				return;
			});
	}
};

/**
 * It takes a profile data object and returns a string of all the skills in the profile data object
 * @param {import('../../typedef').Profile} profileData - The profile data of the user.
 * @returns A string of all the skills and their amounts.
 */
function getSkillList(profileData) {

	let skillList = '';
	for (const skillCategory of Object.values(profileData?.skills || {})) {

		for (const [skillName, skillAmount] of Object.entries(skillCategory)) {

			skillList += `\n${skillName}: \`${skillAmount}\``;
		}
	}
	if (skillList === '') { skillList = 'There is nothing to show here :('; }
	return skillList;
}