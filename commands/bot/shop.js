// @ts-check
const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const { error_color, default_color } = require('../../config.json');
const profileModel = require('../../models/profileModel');
const { hasNoName } = require('../../utils/checkAccountCompletion');
const { checkRoleCatchBlock } = require('../../utils/checkRoleRequirements');
const { createCommandCollector } = require('../../utils/commandCollector');
const disableAllComponents = require('../../utils/disableAllComponents');
const { checkLevelUp } = require('../../utils/levelHandling');

module.exports.name = 'shop';

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

	const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
	const profileData = characterData?.profiles?.[message.guild.id];

	if (await hasNoName(message, characterData)) {

		return;
	}

	const shop = serverData.shop.filter(item => item.wayOfEarning === 'experience');
	const rankRoles = serverData.shop.filter(item => item.wayOfEarning === 'rank');
	const levelRoles = serverData.shop.filter(item => item.wayOfEarning === 'levels');
	const totalPages = Math.ceil(shop.length / 24) + Math.ceil(rankRoles.length / 24) + Math.ceil(levelRoles.length / 24) - 1;

	if (serverData.shop.length === 0) {

		await message
			.reply({
				embeds: [{
					color: /** @type {`#${string}`} */ (error_color),
					title: 'There are currently no roles in the shop!',
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	let page = 0;
	const { description, selectMenuOptionsArray } = getMenuOptions(page, shop, rankRoles, levelRoles);

	const botReply = await message
		.reply({
			embeds: [{
				color: /** @type {`#${string}`} */ (default_color),
				author: { name: message.guild.name, icon_url: message.guild.iconURL() },
				description: description,
			}],
			components: [ new MessageActionRow({
				components: [ new MessageSelectMenu({
					customId: 'shopbuy-options',
					placeholder: 'Select an item',
					options: selectMenuOptionsArray,
				})],
			})],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	createCommandCollector(message.author.id, message.guild.id, botReply);
	interactionCollector();

	async function interactionCollector() {

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.user.id === message.author.id && i.customId === 'shopbuy-options';

		/** @type {import('discord.js').SelectMenuInteraction | null} } */
		const interaction = await botReply
			.awaitMessageComponent({ filter, time: 120_000 })
			.catch(() => { return null; });

		if (interaction === null) {

			return await botReply
				.edit({
					components: disableAllComponents(botReply.components),
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}

		if (interaction.values[0] === 'shopbuy_page') {

			page += 1;
			if (page > totalPages) {

				page = 0;
			}

			const { description: newDescription, selectMenuOptionsArray: newSelectMenuOptionsArray } = getMenuOptions(page, shop, rankRoles, levelRoles);

			await /** @type {import('discord.js').Message} */ (interaction.message)
				.edit({
					embeds: [{
						color: /** @type {`#${string}`} */ (default_color),
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						description: newDescription,
					}],
					components: [ new MessageActionRow({
						components: [ new MessageSelectMenu({
							customId: 'shopbuy-options',
							placeholder: 'Select a shop',
							options: newSelectMenuOptionsArray,
						})],
					})],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}

		if (interaction.values[0].startsWith('shopbuy-')) {

			const buyIndex = interaction.values[0].split('-')[1];
			/** @type {import('../../typedef').Role} */
			const buyItem = shop[buyIndex];

			userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: message.author.id }));

			if (profileData.roles.some(role => role.roleId === buyItem.roleId && role.wayOfEarning === 'experience')) {

				try {

					const userRole = profileData.roles.find(role => role.roleId === buyItem.roleId && role.wayOfEarning === 'experience');
					const userRoleIndex = profileData.roles.indexOf(userRole);

					if (userRoleIndex >= 0) { profileData.roles.splice(userRoleIndex, 1); }

					userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
						{ uuid: userData.uuid },
						(/** @type {import('../../typedef').ProfileSchema} */ p) => {
							p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].experience += /** @type {number} */ (userRole.requirement);
							p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].roles = profileData.roles;
						},
					));

					if (message.member.roles.cache.has(buyItem.roleId) === true) {

						await message.member.roles.remove(buyItem.roleId);

						await /** @type {import('discord.js').Message} */ (interaction.message)
							.edit({
								embeds: [{
									color: /** @type {`#${string}`} */ (default_color),
									author: { name: message.guild.name, icon_url: message.guild.iconURL() },
									description: `You refunded the <@&${buyItem.roleId}> role!`,
								}],
								components: disableAllComponents(/** @type {import('discord.js').Message} */ (interaction.message).components),
							})
							.catch((error) => {
								if (error.httpStatus !== 404) { throw new Error(error); }
							});
					}

					await checkLevelUp(message, undefined, userData, serverData);
				}
				catch (error) {

					await checkRoleCatchBlock(error, message, message.member);
				}
			}
			else if ((profileData.levels * (profileData.levels - 1) / 2) * 50 + profileData.experience >= buyItem.requirement) {

				try {

					if (message.member.roles.cache.has(buyItem.roleId) === false) {

						await message.member.roles.add(buyItem.roleId);

						await /** @type {import('discord.js').Message} */ (interaction.message)
							.edit({
								embeds: [{
									color: /** @type {`#${string}`} */ (default_color),
									author: { name: message.guild.name, icon_url: message.guild.iconURL() },
									description: `You bought the <@&${buyItem.roleId}> role for ${buyItem.requirement} experience!`,
								}],
								components: disableAllComponents(/** @type {import('discord.js').Message} */ (interaction.message).components),
							})
							.catch((error) => {
								if (error.httpStatus !== 404) { throw new Error(error); }
							});
					}

					profileData.roles.push({
						roleId: buyItem.roleId,
						wayOfEarning: buyItem.wayOfEarning,
						requirement: buyItem.requirement,
					});

					userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
						{ uuid: userData.uuid },
						(/** @type {import('../../typedef').ProfileSchema} */ p) => {
							p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].roles = profileData.roles;
						},
					));

					/** @type {number} */
					let cost = /** @type {number} */ (buyItem.requirement);

					while (cost > 0) {

						if (cost <= profileData.experience) {

							userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
								{ uuid: userData.uuid },
								(/** @type {import('../../typedef').ProfileSchema} */ p) => {
									p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].experience -= cost;
								},
							));

							cost -= cost;
						}
						else {

							userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
								{ uuid: userData.uuid },
								(/** @type {import('../../typedef').ProfileSchema} */ p) => {
									p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].experience += (profileData.levels - 1) * 50;
									p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].levels -= 1;
								},
							));
						}
					}

					const member = await botReply.guild.members.fetch(userData.userId);
					const roles = profileData.roles.filter(role => role.wayOfEarning === 'levels' && role.requirement > profileData.levels);

					for (const role of roles) {

						try {

							const userRoleIndex = profileData.roles.indexOf(role);
							if (userRoleIndex >= 0) { profileData.roles.splice(userRoleIndex, 1); }

							userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
								{ uuid: userData.uuid },
								(/** @type {import('../../typedef').ProfileSchema} */ p) => {
									p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].roles = profileData.roles;
								},
							));

							if (message.member.roles.cache.has(role.roleId) === true && profileData.roles.filter(profilerole => profilerole.roleId === role.roleId).length === 0) {

								await message.member.roles.remove(role.roleId);

								await botReply.channel
									.send({
										content: member.toString(),
										embeds: [{
											color: /** @type {`#${string}`} */ (default_color),
											author: { name: message.guild.name, icon_url: message.guild.iconURL() },
											description: `You lost the <@&${role.roleId}> role because of a lack of levels!`,
										}],
									})
									.catch((error) => {
										if (error.httpStatus !== 404) { throw new Error(error); }
									});
							}
						}
						catch (error) {

							await checkRoleCatchBlock(error, botReply, member);
						}
					}
				}
				catch (error) {

					await checkRoleCatchBlock(error, message, message.member);
				}
			}
			else {

				setTimeout(async () => {

					await interaction
						.followUp({
							content: `You don't have the experience to buy the <@&${buyItem.roleId}> role!`,
							ephemeral: true,
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
				}, 500);
			}

			return;
		}

		return await interactionCollector();
	}
};

/**
 * Creates an embed description and select menu based on the roles available in the server.
 * @param {number} page
 * @param {Array<import('../../typedef').Role>} shop
 * @param {Array<import('../../typedef').Role>} rankRoles
 * @param {Array<import('../../typedef').Role>} levelRoles
 * @returns {{description: string, selectMenuOptionsArray: Array<{label: string, value: string, description?: string, emoji?: string}>}}
 */
function getMenuOptions(page, shop, rankRoles, levelRoles) {

	let position = 0 + (page * 24);
	/** @type {Array<string>} */
	const descriptionArray = [];
	/** @type {Array<{label: string, value: string, description?: string, emoji?: string}>} */
	const selectMenuOptionsArray = [];

	const shopPages = Math.ceil(shop.length / 24);
	const rankRolesPages = Math.ceil(rankRoles.length / 24);
	const levelRolesPages = Math.ceil(levelRoles.length / 24);

	if (shopPages > 0 && page < shopPages) {

		for (const item of shop.slice((page * 24), 25 + (page * 24))) {

			position += 1;
			descriptionArray.push(`**${position}.:** <@&${item.roleId}> for ${item.requirement} ${item.wayOfEarning}`);
			selectMenuOptionsArray.push({ label: `${position}`, value: `shopbuy-${position - 1}` });
		}
	}
	else if (rankRolesPages > 0 && page < shopPages + rankRolesPages) {

		page -= shopPages;
		for (const item of rankRoles.slice((page * 24), 25 + (page * 24))) {

			descriptionArray.push(`<@&${item.roleId}> for ${item.requirement} ${item.wayOfEarning}`);
		}
	}
	else if (levelRolesPages > 0) {

		page -= shopPages + rankRolesPages;
		for (const item of levelRoles.slice((page * 24), 25 + (page * 24))) {

			descriptionArray.push(`<@&${item.roleId}> for ${item.requirement} ${item.wayOfEarning}`);
		}
	}

	if (shopPages + rankRolesPages + levelRolesPages > 1) {

		selectMenuOptionsArray.push({ label: 'Show more shop options', value: 'shopbuy_page', description: 'You are currently on page 1', emoji: '📋' });
	}

	const description = descriptionArray.join('\n');

	return { description, selectMenuOptionsArray };
}