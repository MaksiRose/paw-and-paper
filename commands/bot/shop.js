const config = require('../../config.json');
const profileModel = require('../../models/profileModel');
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

				if (message.member.roles.cache.has(buyItem.roleId)) {

					try {

						await message.member.roles.remove(buyItem.roleId);

						profileData = await profileModel.findOneAndUpdate(
							{ userId: message.author.id, serverId: message.guild.id },
							{ $inc: { experience: buyItem.requirement } },
						);

						setTimeout(async () => {

							await interaction
								.followUp({
									content: `Refunded the <@&${buyItem.roleId}> role!`,
									ephemeral: true,
									failIfNotExists: false,
								})
								.catch((error) => {
									if (error.httpStatus !== 404) {
										throw new Error(error);
									}
								});

							profileData = checkLevelUp(profileData, undefined);
						}, 500);
					}
					catch (error) {

						if (error.httpStatus === 403) {

							return await interaction.message
								.reply({
									embeds: [{
										color: config.error_color,
										author: { name: message.guild.name, icon_url: message.guild.iconURL() },
										title: 'I don\'t have permission to manage roles, or the role is above my highest role. Please ask an admin to edit my permissions or move the wanted role below mine.',
									}],
									failIfNotExists: false,
								})
								.catch((err) => {
									if (err.httpStatus !== 404) {
										throw new Error(err);
									}
								});
						}
						else {

							console.error(error);
							return await interaction.message
								.reply({
									embeds: [{
										color: config.error_color,
										author: { name: message.guild.name, icon_url: message.guild.iconURL() },
										title: 'There was an error trying to add the role :(',
									}],
									failIfNotExists: false,
								})
								.catch((err) => {
									if (err.httpStatus !== 404) {
										throw new Error(err);
									}
								});
						}
					}
				}
				else if ((profileData.levels * (profileData.levels - 1) / 2) * 50 + profileData.experience >= buyItem.requirement) {

					try {

						await message.member.roles.add(buyItem.roleId);let cost = buyItem.requirement;

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

						setTimeout(async () => {

							await interaction
								.followUp({
									content: `You bought the <@&${buyItem.roleId}> role for ${buyItem.requirement} experience!`,
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
					catch (error) {

						if (error.httpStatus === 403) {

							await interaction.message
								.reply({
									embeds: [{
										color: config.error_color,
										author: { name: message.guild.name, icon_url: message.guild.iconURL() },
										title: 'I don\'t have permission to manage roles, or the role is above my highest role. Please ask an admin to edit my permissions or move the wanted role below mine.',
									}],
									failIfNotExists: false,
								})
								.catch((err) => {
									if (err.httpStatus !== 404) {
										throw new Error(err);
									}
								});
						}
						else {

							console.error(error);
							await interaction.message
								.reply({
									embeds: [{
										color: config.error_color,
										author: { name: message.guild.name, icon_url: message.guild.iconURL() },
										title: 'There was an error trying to add the role :(',
									}],
									failIfNotExists: false,
								})
								.catch((err) => {
									if (err.httpStatus !== 404) {
										throw new Error(err);
									}
								});
						}
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

				await interaction.message
					.edit({ components: interaction.message.components })
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
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