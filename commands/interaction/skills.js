// @ts-check
const { MessageActionRow, MessageButton, Modal, MessageSelectMenu, TextInputComponent } = require('discord.js');
const profileModel = require('../../models/profileModel');
const serverModel = require('../../models/serverModel');
const { createCommandCollector } = require('../../utils/commandCollector');
const disableAllComponents = require('../../utils/disableAllComponents');

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

	let characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
	let profileData = characterData?.profiles?.[message.guild.id];
	let isYourself = true;

	if (message.mentions.users.size > 0) {

		userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: message.mentions.users.first().id }));
		characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
		profileData = characterData?.profiles?.[message.guild.id];
		isYourself = false;
	}

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
		})],
	);

	let skillList = '';
	for (const skillCategory of Object.values(profileData?.skills || {})) {

		for (const [skillName, skillAmount] of Object.entries(skillCategory)) {

			skillList += `\n${skillName}: \`${skillAmount}\``;
		}
	}

	const botReply = await message
		.reply({
			content: skillList === '' ? 'There is nothing to show here :(' : skillList,
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

				if (interaction.isSelectMenu() && interaction.customId === 'skills-remove-options') {

					console.log(interaction.values[0]);

					const category = interaction.values[0].split('-')[2];
					const name = interaction.values[0].split('-')[3];

					if (category === 'personal') {

						await profileModel.findOneAndUpdate(
							{ userId: message.author.id },
							(/** @type {import('../../typedef').ProfileSchema} */ p) => {
								delete p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].skills[category][name];
							},
						);
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
					}

					return;
				}

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
				}

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
				}


				interaction.awaitModalSubmit({ filter: i => i.customId.includes('skill'), time: 120_000 })
					.then(async i => {

						const type = i.customId.split('-')[1];
						const category = i.customId.split('-')[2];
						const name = i.customId.split('-')[3];

						if (type === 'add') {

							const newName = i.components[0].components[0].value;
							if (category === 'personal') {

								// add check if name already exists for this persons personal or this servers global names
								await profileModel.findOneAndUpdate(
									{ userId: i.user.id },
									(/** @type {import('../../typedef').ProfileSchema} */ p) => {
										p.characters[p.currentCharacter[i.guild.id]].profiles[i.guild.id].skills.personal[newName] = 0;
									},
								);
							}
							else {

								const allUsers = await profileModel.find();

								// add check if name already exists in any of this servers personal or this servers global names

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
							}
						}
						else if (type === 'edit') {

							const newName = i.components[0].components[0].value;
							if (category === 'personal') {

								// add check if new name already exists for this persons personal or this servers global names
								await profileModel.findOneAndUpdate(
									{ userId: i.user.id },
									(/** @type {import('../../typedef').ProfileSchema} */ p) => {
										p.characters[p.currentCharacter[i.guild.id]].profiles[i.guild.id].skills.personal[newName] = p.characters[p.currentCharacter[i.guild.id]].profiles[i.guild.id].skills.personal[name];
										delete p.characters[p.currentCharacter[i.guild.id]].profiles[i.guild.id].skills.personal[name];
									},
								);
							}
							else {

								const allUsers = await profileModel.find();

								// add check if new name already exists in any of this servers personal or this servers global names

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
							}
						}
						else if (type === 'modify') {

							// this should be changed to understand whether to replace, add or subtract based on whether a + or - is in the value
							const newValue = Number(i.components[0].components[0].value);

							// add check if newValue is NaN

							await profileModel.findOneAndUpdate(
								{ userId: i.user.id },
								(/** @type {import('../../typedef').ProfileSchema} */ p) => {
									p.characters[p.currentCharacter[i.guild.id]].profiles[i.guild.id].skills[category][name] = newValue;
								},
							);
						}
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