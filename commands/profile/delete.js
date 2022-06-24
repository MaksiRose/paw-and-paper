// @ts-check
const { MessageActionRow, MessageButton, MessageEmbed, MessageSelectMenu } = require('discord.js');
const { error_color } = require('../../config.json');
const profileModel = require('../../models/profileModel');
const serverModel = require('../../models/serverModel');
const { createCommandCollector } = require('../../utils/commandCollector');
const disableAllComponents = require('../../utils/disableAllComponents');

module.exports.name = 'delete';
module.exports.aliases = ['purge', 'remove', 'reset'];

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema | null} userData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData) => {

	/* Checking if the user has an account. If they do not, it will send a message saying they have no
	accounts. */
	if (!userData) {

		await message
			.reply({
				embeds: [new MessageEmbed({
					color: /** @type {`#${string}`} */ (error_color),
					title: 'You have no account!',
				})],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	await startCollector(message, userData);
};

/**
 *
 * @param {import('discord.js').Message} message
 * @param {import('../../typedef').ProfileSchema} userData
 * @returns
 */
async function startCollector(message, userData) {

	/** @type {import('discord.js').MessageOptions} */
	const originalMessage = {
		embeds: [new MessageEmbed({
			color: /** @type {`#${string}`} */ (error_color),
			title: 'Please select what you want to delete.',
		})],
		components: [new MessageActionRow({
			components: [new MessageButton({
				customId: 'delete-individual',
				label: 'A character',
				style: 'DANGER',
			}), new MessageButton({
				customId: 'delete-server',
				label: 'All information on one server',
				style: 'DANGER',
			}), new MessageButton({
				customId: 'delete-all',
				label: 'Everything',
				style: 'DANGER',
			})],
		})],
	};

	let botReply = await message
		.reply({
			...originalMessage,
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	let deletePage = 0;

	createCommandCollector(message.author.id, message.guild?.id || '', botReply);

	const collector = message.channel.createMessageComponentCollector({
		filter: (i) => i.user.id === message.author.id && i.message.id === botReply.id,
		time: 600000,
	});

	collector.on('collect', async (interaction) => {

		/* Creating a new page for the user to select an account to delete. */
		if (interaction.isButton() && interaction.customId === 'delete-individual') {

			deletePage = 0;

			botReply = await botReply
				.edit({
					embeds: [new MessageEmbed({
						color: /** @type {`#${string}`} */ (error_color),
						title: 'Please select a character that you want to delete.',
					})],
					components: [botReply.components[0], new MessageActionRow({
						components: [getAccountsPage(deletePage, userData)],
					})],
				})
				.catch((error) => { throw new Error(error); });
			return;
		}

		/* Checking if the interaction is a select menu and if the value is delete-individual_page. If it is,
				it increments the page number, and if the page number is greater than the number of pages,
				it sets the page number to 0. It will then edit the reply to have the new page of accounts. */
		if (interaction.isSelectMenu() && interaction.values[0] === 'delete-individual_page') {

			deletePage++;
			if (deletePage >= Math.ceil(Object.keys(userData.characters).length / 24)) {

				deletePage = 0;
			}

			botReply = await botReply
				.edit({
					components: [botReply.components[0], new MessageActionRow({
						components: [getAccountsPage(deletePage, userData)],
					})],
				})
				.catch((error) => { throw new Error(error); });
			return;
		}

		/* Checking if the interaction is a select menu and if the account exists. If it does, it will edit
				the message to ask the user if they are sure they want to delete the account. */
		if (interaction.isSelectMenu() && Object.keys(userData.characters).includes(interaction.values[0].replace('delete-individual_', ''))) {

			const _id = interaction.values[0].replace('delete-individual_', '');
			const character = userData.characters[_id];

			botReply = await botReply
				.edit({
					embeds: [new MessageEmbed({
						color: /** @type {`#${string}`} */ (error_color),
						title: `Are you sure you want to delete the character named "${character.name}" ? This will be **permanent**!!!`,
					})],
					components: [...disableAllComponents([botReply.components[0], botReply.components[1]]), new MessageActionRow({
						components: [new MessageButton({
							customId: `delete-confirm_individual_${_id}`,
							label: 'Confirm',
							emoji: '✔',
							style: 'DANGER',
						}), new MessageButton({
							customId: 'delete-cancel',
							label: 'Cancel',
							emoji: '✖',
							style: 'SECONDARY',
						})],
					})],
				})
				.catch((error) => { throw new Error(error); });
			return;
		}

		/* Creating a new page for the user to select their accounts on a server to delete. */
		if (interaction.isButton() && interaction.customId === 'delete-server') {

			deletePage = 0;

			botReply = await botReply
				.edit({
					embeds: [new MessageEmbed({
						color: /** @type {`#${string}`} */ (error_color),
						title: 'Please select a server that you want to delete.',
					})],
					components: [botReply.components[0], new MessageActionRow({
						components: [await getServersPage(deletePage, userData)],
					})],
				})
				.catch((error) => { throw new Error(error); });
			return;
		}

		/* Checking if the interaction is a select menu and if the value is delete-server_page. If it is,
				it increments the page number, and if the page number is greater than the number of pages,
				it sets the page number to 0. It will then edit the reply to have the new page of servers. */
		if (interaction.isSelectMenu() && interaction.values[0] === 'delete-server_page') {

			deletePage++;
			if (deletePage >= Math.ceil([...new Set(Object.values(userData.characters).map(c => Object.keys(c.profiles)).flat())].length / 24)) {

				deletePage = 0;
			}

			botReply = await botReply
				.edit({
					components: [botReply.components[0], new MessageActionRow({
						components: [await getServersPage(deletePage, userData)],
					})],
				})
				.catch((error) => { throw new Error(error); });
			return;
		}

		/* Checking if the interaction is a select menu and if the server ID is in the array of all
				servers. If it is, it will edit the message to ask the user if they are sure they want to delete
				all their accounts on the server. */
		if (interaction.isSelectMenu() && [...new Set([...Object.values(userData.characters).map(c => Object.keys(c.profiles)), ...Object.keys(userData.currentCharacter)].flat())].includes(interaction.values[0].replace('delete-server_', ''))) {

			const server = /** @type {import('../../typedef').ServerSchema} */ (await serverModel.findOne({ serverId: interaction.values[0].replace('delete-server_', '') }));
			const accountsOnServer = Object.values(userData.characters).map(c => c.profiles[server.serverId]).filter(p => p !== undefined);

			botReply = await botReply
				.edit({
					embeds: [new MessageEmbed({
						color: /** @type {`#${string}`} */ (error_color),
						title: `Are you sure you want to delete all the data of ${accountsOnServer.length} characters on the server ${server.name}? This will be **permanent**!!!`,
					})],
					components: [...disableAllComponents([botReply.components[0], botReply.components[1]]), new MessageActionRow({
						components: [new MessageButton({
							customId: `delete-confirm_server_${interaction.values[0].replace('delete-server_', '')}`,
							label: 'Confirm',
							emoji: '✔',
							style: 'DANGER',
						}), new MessageButton({
							customId: 'delete-cancel',
							label: 'Cancel',
							emoji: '✖',
							style: 'SECONDARY',
						})],
					})],
				})
				.catch((error) => { throw new Error(error); });
			return;
		}

		/* Creating a new message asking the user if they are sure that they want to delete all their data. */
		if (interaction.isButton() && interaction.customId === 'delete-all') {

			botReply = await botReply
				.edit({
					embeds: [new MessageEmbed({
						color: /** @type {`#${string}`} */ (error_color),
						title: 'Are you sure you want to delete all your data? This will be **permanent**!!!',
						description: 'Are you unhappy with your experience, or have other concerns? You can leave criticism and feedback using `rp ticket` (an account is not needed).',
					})],
					components: [...disableAllComponents([botReply.components[0]]), new MessageActionRow({
						components: [new MessageButton({
							customId: 'delete-confirm_all',
							label: 'Confirm',
							emoji: '✔',
							style: 'DANGER',
						}), new MessageButton({
							customId: 'delete-cancel',
							label: 'Cancel',
							emoji: '✖',
							style: 'SECONDARY',
						})],
					})],
				})
				.catch((error) => { throw new Error(error); });
			return;
		}

		/* Deleting the data of the user. */
		if (interaction.customId.includes('delete-confirm')) {

			const type = /** @type {'individual' | 'server' | 'all'} */ (interaction.customId.split('_')[1]);

			/* Deleting a user from the database. */
			if (type === 'individual') {

				const _id = interaction.customId.replace('delete-confirm_individual_', '');
				const character = userData.characters[_id];

				await profileModel.findOneAndUpdate(
					{ uuid: userData.uuid },
					(/** @type {import('../../typedef').ProfileSchema} */ p) => {
						delete p.characters[_id];
						for (const curchar of Object.keys(p.currentCharacter)) {
							if (p.currentCharacter[curchar] === _id) { delete p.currentCharacter[curchar]; }
						}
					},
				);

				await botReply
					.reply({
						embeds: [new MessageEmbed({
							color: /** @type {`#${string}`} */ (error_color),
							title: `The character \`${character.name}\` was deleted permanently!`,
						})],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
			}

			/* Deleting all accounts by a user on a server. */
			if (type === 'server') {

				const serverId = interaction.customId.replace('delete-confirm_server_', '');
				const server = /** @type {import('../../typedef').ServerSchema} */ (await serverModel.findOne({ serverId: serverId }));
				const accountsOnServer = Object.values(userData.characters).map(c => c.profiles[server.serverId]).filter(p => p !== undefined);

				await profileModel.findOneAndUpdate(
					{ uuid: userData.uuid },
					(/** @type {import('../../typedef').ProfileSchema} */ p) => {
						for (const c of Object.values(p.characters)) {
							if (c.profiles[serverId] !== undefined) { delete c.profiles[serverId]; }
						}
						delete p.currentCharacter[serverId];
					},
				);

				await botReply
					.reply({
						embeds: [new MessageEmbed({
							color: /** @type {`#${string}`} */ (error_color),
							title: `All the data of ${accountsOnServer.length} characters on the server \`${server.name}\` was deleted permanently!`,
						})],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
			}

			/* Deleting all the data of the user. */
			if (type === 'all') {

				await profileModel.findOneAndDelete({ uuid: userData.uuid });

				await botReply
					.reply({
						embeds: [new MessageEmbed({
							color: /** @type {`#${string}`} */ (error_color),
							title: 'All your data was deleted permanently!',
						})],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});

				botReply = await botReply
					.edit({
						components: disableAllComponents(botReply.components),
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
						return botReply;
					});

				collector.stop();
				return;
			}

			userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ uuid: userData.uuid }));

			botReply = await botReply
				.edit({
					... /** @type {import('discord.js').MessageEditOptions} */(originalMessage),
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
					return botReply;
				});
			return;
		}

		/* Editing the message to the original message. */
		if (interaction.customId === 'delete-cancel') {

			await /** @type {import('discord.js').Message} */ (interaction.message)
				.edit({
					... /** @type {import('discord.js').MessageEditOptions} */(originalMessage),
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}
	});

	collector.on('end', async () => {

		await botReply
			.edit({
				components: disableAllComponents(botReply.components),
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
	});
	return { botReply, deletePage, userData };
}

/**
 * Creates a select menu with the users accounts
 * @param {number} deletePage
 * @param {import('../../typedef').ProfileSchema} userData
 * @returns {import('discord.js').MessageSelectMenu}
 */
function getAccountsPage(deletePage, userData) {

	const accountsMenu = new MessageSelectMenu({
		customId: 'delete-individual-options',
		placeholder: 'Select a character',
	});

	for (const character of Object.values(userData.characters)) {

		accountsMenu.addOptions({ label: `${character.name}`, value: `delete-individual_${character._id}` });
	}

	if (accountsMenu.options.length > 25) {

		accountsMenu.options = accountsMenu.options.splice(deletePage * 24, (deletePage + 1) * 24);
		accountsMenu.addOptions({ label: 'Show more accounts', value: 'delete-individual_page', description: `You are currently on page ${deletePage + 1}`, emoji: '📋' });
	}

	return accountsMenu;
}

/**
 * Creates a select menu with the servers that have accounts with this user
 * @param {number} deletePage
 * @param {import('../../typedef').ProfileSchema} userData
 * @returns {Promise<import('discord.js').MessageSelectMenu>}
 */
async function getServersPage(deletePage, userData) {

	const accountsMenu = new MessageSelectMenu({
		customId: 'delete-server-options',
		placeholder: 'Select a server',
	});

	/** @type {Array<string>} */
	const serverIdList = [...new Set([...Object.values(userData.characters).map(c => Object.keys(c.profiles)), ...Object.keys(userData.currentCharacter)].flat())];

	for (const serverId of serverIdList) {

		const server = /** @type {import('../../typedef').ServerSchema} */ (await serverModel.findOne({ serverId: serverId }));
		accountsMenu.addOptions({ label: server.name, value: `delete-server_${server.serverId}` });
	}

	if (accountsMenu.options.length > 25) {

		accountsMenu.options = accountsMenu.options.splice(deletePage * 24, (deletePage + 1) * 24);
		accountsMenu.addOptions({ label: 'Show more servers', value: 'delete-server_page', description: `You are currently on page ${deletePage + 1}`, emoji: '📋' });
	}

	return accountsMenu;
}