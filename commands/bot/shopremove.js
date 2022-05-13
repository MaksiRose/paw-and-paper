// @ts-check
const { error_color, default_color } = require('../../config.json');
const serverModel = require('../../models/serverModel');
const profileModel = require('../../models/profileModel');
const { createCommandCollector } = require('../../utils/commandCollector');
const { checkLevelUp } = require('../../utils/levelHandling');
const { checkRoleCatchBlock } = require('../../utils/checkRoleRequirements');
const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const disableAllComponents = require('../../utils/disableAllComponents');

module.exports.name = 'shopremove';
module.exports.aliases = ['shopdelete'];

/**
 *
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} profileData
 * @param {import('../../typedef').ServerSchema} serverData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, profileData, serverData) => {

	if (message.member.permissions.has('ADMINISTRATOR') === false) {

		await message
			.reply({
				embeds: [{
					color: /** @type {`#${string}`} */ (error_color),
					title: 'Only administrators of a server can use this command!',
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

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
	const { description, selectMenuOptionsArray } = getMenuOptions(serverData.shop, page);

	const botReply = await message
		.reply({
			embeds: [{
				color: /** @type {`#${string}`} */ (default_color),
				author: { name: message.guild.name, icon_url: message.guild.iconURL() },
				description: description,
			}],
			components: [ new MessageActionRow({
				components: [ new MessageSelectMenu({
					customId: 'shopdelete-options',
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

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.user.id === message.author.id && i.customId === 'shopdelete-options';

		/** @type {import('discord.js').SelectMenuInteraction | null} } */
		const interaction = await botReply
			.awaitMessageComponent({ filter, time: 120_000 })
			.catch(() => { return null; });

		if (interaction === null) {

			await botReply
				.edit({
					components: disableAllComponents(botReply.components),
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		if (interaction.values[0] === 'shopdelete_page') {

			page += 1;
			if (page >= Math.ceil(serverData.shop.length / 24)) {

				page = 0;
			}

			const { description: newDescription, selectMenuOptionsArray: newSelectMenuOptionsArray } = getMenuOptions(serverData.shop, page);

			await /** @type {import('discord.js').Message} */ (interaction.message)
				.edit({
					embeds: [{
						color: /** @type {`#${string}`} */ (default_color),
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						description: newDescription,
					}],
					components: [ new MessageActionRow({
						components: [ new MessageSelectMenu({
							customId: 'shopdelete-options',
							placeholder: 'Select an item',
							options: newSelectMenuOptionsArray,
						})],
					})],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}

		if (interaction.values[0].startsWith('shopdelete-')) {

			const deleteIndex = Number(interaction.values[0].split('-')[1]);
			const deleteItem = serverData.shop.splice(deleteIndex, 1);

			serverData = /** @type {import('../../typedef').ServerSchema} */ (await serverModel.findOneAndUpdate(
				{ serverId: message.guild.id },
				(/** @type {import('../../typedef').ServerSchema} */ s) => {
					s.shop = serverData.shop;
				},
			));

			await /** @type {import('discord.js').Message} */ (interaction.message)
				.edit({
					embeds: [{
						color: /** @type {`#${string}`} */ (default_color),
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						description: `<@&${deleteItem[0].roleId}> with the requirement of ${deleteItem[0].requirement} ${deleteItem[0].wayOfEarning} was deleted from the shop.`,
					}],
					components: disableAllComponents(/** @type {import('discord.js').Message} */ (interaction.message).components),
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});

			const allServerUsers = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel.find(
				(/** @type {import('../../typedef').ProfileSchema} */ u) => {
					return Object.values(u.characters).filter(c => c.profiles[message.guild.id] !== undefined).length > 0;
				}));

			for (const u of Object.values(allServerUsers)) {

				for (const c of Object.values(u.characters)) {

					const p = c.profiles[message.guild.id];
					if (p !== undefined) {

						const member = await message.guild.members.fetch(u.userId);

						if (p.roles.some(role => role.roleId === deleteItem[0].roleId && role.wayOfEarning === deleteItem[0].wayOfEarning && role.requirement === deleteItem[0].requirement)) {

							try {

								const userRole = p.roles.find(role => role.roleId === deleteItem[0].roleId && role.wayOfEarning === deleteItem[0].wayOfEarning && role.requirement === deleteItem[0].requirement);
								const userRoleIndex = p.roles.indexOf(userRole);

								if (userRoleIndex >= 0) { p.roles.splice(userRoleIndex, 1); }

								await profileModel.findOneAndUpdate(
									{ userId: u.userId },
									(/** @type {import('../../typedef').ProfileSchema} */ usr) => {
										usr.characters[c._id].profiles[message.guild.id].experience += userRole.wayOfEarning === 'experience' ? /** @type {number} */ (userRole.requirement) : 0;
										usr.characters[c._id].profiles[message.guild.id].roles = p.roles;
									},
								);

								if (message.member.roles.cache.has(deleteItem[0].roleId) === true && p.roles.filter(role => role.roleId === deleteItem[0].roleId).length === 0) {

									await member.roles.remove(deleteItem[0].roleId);

									await message.channel
										.send({
											content: member.toString(),
											embeds: [{
												color: /** @type {`#${string}`} */ (default_color),
												author: { name: botReply.guild.name, icon_url: botReply.guild.iconURL() },
												description: `You lost the <@&${deleteItem[0].roleId}> role because it was removed from the shop!`,
											}],
										})
										.catch((error) => {
											if (error.httpStatus !== 404) { throw new Error(error); }
										});
								}

								checkLevelUp(message, undefined, u, serverData);
							}
							catch (error) {

								await checkRoleCatchBlock(error, message, message.member);
							}
						}
					}
				}
			}

			return;
		}

		return await interactionCollector();
	}
};

/**
 * Creates an embed description and select menu based on the roles available in the server.
 * @param {Array<import('../../typedef').Role>} shop
 * @param {number} page
 * @returns {{description: string, selectMenuOptionsArray: Array<{label: string, value: string, description?: string, emoji?: string}>}}
 */
function getMenuOptions(shop, page) {

	let position = 0 + (page * 24);
	const descriptionArray = [];
	const selectMenuOptionsArray = [];

	for (const item of shop.slice((page * 24), 25 + (page * 24))) {

		position += 1;
		descriptionArray.push(`**${position}.:** <@&${item.roleId}>, acquired through ${item.requirement} ${item.wayOfEarning}`);
		selectMenuOptionsArray.push({ label: `${position}`, value: `shopdelete-${position - 1}` });
	}

	if (shop.length > 25) {

		descriptionArray.length = 24;
		selectMenuOptionsArray.length = 24;
		selectMenuOptionsArray.push({ label: 'Show more shop options', value: 'shopdelete_page', description: 'You are currently on page 1', emoji: '📋' });
	}

	const description = descriptionArray.join('\n');

	return { description, selectMenuOptionsArray };
}