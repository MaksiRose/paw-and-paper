const config = require('../../config.json');
const profileModel = require('../../models/profileModel');
const { checkRoleCatchBlock } = require('../../utils/checkRoleRequirements');
const { createCommandCollector } = require('../../utils/commandCollector');
const { checkLevelUp } = require('../../utils/levelHandling');

module.exports = {
	name: 'shop',
	async sendMessage(client, message, argumentsArray, profileData, serverData) {

		const shop = serverData.shop.filter(item => item.wayOfEarning === 'experience');

		if (shop.length === 0) {

			return await message
				.reply({
					embeds: [{
						color: config.error_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: 'There are currently no roles in the shop!',
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		let page = 0;
		const { description, selectMenuOptionsArray } = getMenuOptions(shop, page);

		const botReply = await message
			.reply({
				embeds: [{
					color: config.default_color,
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					description: description,
				}],
				components: [{
					type: 'ACTION_ROW',
					components: [{
						type: 'SELECT_MENU',
						customId: 'shopbuy-options',
						placeholder: 'Select an item',
						options: selectMenuOptionsArray,
					}],
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		createCommandCollector(message.author.id, message.guild.id, botReply);
		interactionCollector();

		async function interactionCollector() {

			const filter = i => i.user.id === message.author.id;

			const interaction = await botReply
				.awaitMessageComponent({ filter, time: 120_000 })
				.catch(() => { return null; });

			if (interaction === null) {

				return await botReply
					.edit({
						components: [],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'shopbuy_page') {

				page += 1;
				if (page >= Math.ceil(shop.length / 24)) {

					page = 0;
				}

				const { description: newDescription, selectMenuOptionsArray: newSelectMenuOptionsArray } = getMenuOptions(shop, page);

				await interaction.message
					.edit({
						embeds: [{
							color: config.default_color,
							author: { name: message.guild.name, icon_url: message.guild.iconURL() },
							description: newDescription,
						}],
						components: [{
							type: 'ACTION_ROW',
							components: [{
								type: 'SELECT_MENU',
								customId: 'shopbuy-options',
								placeholder: 'Select a shop',
								options: newSelectMenuOptionsArray,
							}],
						}],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0].startsWith('shopbuy-')) {

				const buyIndex = interaction.values[0].split('-')[1];
				const buyItem = shop[buyIndex];

				profileData = await profileModel.findOne({
					userId: message.author.id,
					serverId: message.guild.id,
				});

				if (profileData.roles.some(role => role.roleId === buyItem.roleId && role.wayOfEarning === 'experience')) {

					try {

						if (message.member.roles.cache.has(buyItem.roleId) === true) {

							await message.member.roles.remove(buyItem.roleId);
						}

						const userRole = profileData.roles.find(role => role.roleId === buyItem.roleId && role.wayOfEarning === 'experience');
						const userRoleIndex = profileData.roles.indexOf(userRole);

						if (userRoleIndex >= 0) { profileData.roles.splice(userRoleIndex, 1); }

						profileData = await profileModel.findOneAndUpdate(
							{ userId: message.author.id, serverId: message.guild.id },
							{
								$inc: { experience: userRole.requirement },
								$set: { roles: profileData.roles } },
						);

						setTimeout(async () => {

							await interaction.message
								.edit({
									embeds: [{
										color: config.default_color,
										author: { name: message.guild.name, icon_url: message.guild.iconURL() },
										description: `You refunded the <@&${buyItem.roleId}> role!`,
									}],
									components: [],
									failIfNotExists: false,
								})
								.catch((error) => {
									if (error.httpStatus !== 404) {
										throw new Error(error);
									}
								});

							profileData = checkLevelUp(message, undefined, profileData, serverData);
						}, 500);
					}
					catch (error) {

						await checkRoleCatchBlock(error, message, message.member);
					}
				}
				else if ((profileData.levels * (profileData.levels - 1) / 2) * 50 + profileData.experience >= buyItem.requirement) {

					try {

						if (message.member.roles.cache.has(buyItem.roleId) === false) {

							await message.member.roles.add(buyItem.roleId);
						}

						profileData.roles.push({
							roleId: buyItem.roleId,
							wayOfEarning: buyItem.wayOfEarning,
							requirement: buyItem.requirement,
						});

						profileData = await profileModel.findOneAndUpdate(
							{ userId: message.author.id, serverId: message.guild.id },
							{ $set: { roles: profileData.roles } },
						);

						let cost = buyItem.requirement;

						while (cost > 0) {

							if (cost <= profileData.experience) {

								profileData = await profileModel.findOneAndUpdate(
									{ userId: message.author.id, serverId: message.guild.id },
									{ $inc: { experience: -cost } },
								);

								cost -= cost;
							}
							else {

								profileData = await profileModel.findOneAndUpdate(
									{ userId: message.author.id, serverId: message.guild.id },
									{
										$inc: {
											experience: (profileData.levels - 1) * 50,
											levels: -1,
										},
									},
								);
							}
						}

						const member = await botReply.guild.members.fetch(profileData.userId);
						const roles = profileData.roles.filter(role => role.wayOfEarning === 'levels' && role.requirement > profileData.levels);

						for (const role of roles) {

							try {

								if (message.member.roles.cache.has(role.roleId) === true && profileData.roles.filter(profilerole => profilerole.roleId === role.roleId).length <= 1) {

									await message.member.roles.remove(role.roleId);
								}

								const userRoleIndex = profileData.roles.indexOf(role);
								if (userRoleIndex >= 0) { profileData.roles.splice(userRoleIndex, 1); }

								await profileModel.findOneAndUpdate(
									{ userId: profileData.userId, serverId: profileData.serverId },
									{ $set: { roles: profileData.roles } },
								);

								await botReply.channel
									.send({
										content: `${member.toString()}, you lost the <@&${role.roleId}> role because of a lack of levels!`,
										failIfNotExists: false,
									})
									.catch((error) => {
										if (error.httpStatus !== 404) {
											throw new Error(error);
										}
									});
							}
							catch (error) {

								await checkRoleCatchBlock(error, botReply, member);
							}
						}

						setTimeout(async () => {

							await interaction.message
								.edit({
									embeds: [{
										color: config.default_color,
										author: { name: message.guild.name, icon_url: message.guild.iconURL() },
										description: `You bought the <@&${buyItem.roleId}> role for ${buyItem.requirement} experience!`,
									}],
									components: [],
									failIfNotExists: false,
								})
								.catch((error) => {
									if (error.httpStatus !== 404) {
										throw new Error(error);
									}
								});
						}, 500);
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
								failIfNotExists: false,
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
	},
};

function getMenuOptions(shop, page) {

	let position = 0;
	const descriptionArray = [];
	const selectMenuOptionsArray = [];

	for (const item of shop.slice((page * 24), 25 + (page * 24))) {

		position += 1;
		descriptionArray.push(`**${position}.:** <@&${item.roleId}> for ${item.requirement} ${item.wayOfEarning}`);
		selectMenuOptionsArray.push({ label: `${position}`, value: `shopbuy-${position - 1}` });
	}

	if (shop.length > 25) {

		descriptionArray.length = 24;
		selectMenuOptionsArray.length = 24;
		selectMenuOptionsArray.push({ label: 'Show more shop options', value: 'shopbuy_page', description: 'You are currently on page 1', emoji: '📋' });
	}

	const description = descriptionArray.join('\n');

	return { description, selectMenuOptionsArray };
}