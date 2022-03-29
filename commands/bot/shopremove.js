const config = require('../../config.json');
const serverModel = require('../../models/serverModel');
const { createCommandCollector } = require('../../utils/commandCollector');

module.exports = {
	name: 'shopremove',
	aliases: ['shopdelete'],
	async sendMessage(client, message, argumentsArray, profileData, serverData) {

		if (message.member.permissions.has('ADMINISTRATOR') === false) {

			return await message
				.reply({
					embeds: [{
						color: config.error_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: 'Only administrators of a server can use this command!',
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if (serverData.shop.length === 0) {

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
		const { description, selectMenuOptionsArray } = getMenuOptions(serverData.shop, page);

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
						customId: 'shopdelete-options',
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

			if (interaction.values[0] === 'shopdelete_page') {

				page += 1;
				if (page >= Math.ceil(serverData.shop.length / 24)) {

					page = 0;
				}

				const { description: newDescription, selectMenuOptionsArray: newSelectMenuOptionsArray } = getMenuOptions(serverData.shop, page);

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
								customId: 'shopdelete-options',
								placeholder: 'Select an item',
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

			if (interaction.values[0].startsWith('shopdelete-')) {

				const deleteIndex = interaction.values[0].split('-')[1];
				const deleteItem = serverData.shop.splice(deleteIndex, 1);

				serverData = await serverModel.findOneAndUpdate(
					{ serverId: message.guild.id },
					{ $set: { shop: serverData.shop } },
				);

				setTimeout(async () => {

					await interaction
						.followUp({
							content: `<@&${deleteItem[0].roleId}> with the requirement of ${deleteItem[0].requirement} ${deleteItem[0].wayOfEarning} was deleted from the shop.`,
							ephemeral: true,
							failIfNotExists: false,
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
				}, 500);

				if (serverData.shop.length === 0) {

					return await interaction.message
						.edit({
							embeds: [{
								color: config.error_color,
								title: 'There are currently no roles in the shop!',
							}],
							components: [],
							failIfNotExists: false,
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
				}

				page = 0;
				const { description: newDescription, selectMenuOptionsArray: newSelectMenuOptionsArray } = getMenuOptions(serverData.shop, page);

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
								customId: 'shopdelete-options',
								placeholder: 'Select an item',
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