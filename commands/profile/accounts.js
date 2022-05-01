// @ts-check
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const startCooldown = require('../../utils/startCooldown');
const { profileModel, otherProfileModel } = require('../../models/profileModel');
const { renameSync } = require('fs');
const { createCommandCollector } = require('../../utils/commandCollector');
const { checkRoleCatchBlock } = require('../../utils/checkRoleRequirements');
const { hasCooldown } = require('../../utils/checkValidity');
const { stopResting } = require('../../utils/executeResting');
const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const disableAllComponents = require('../../utils/disableAllComponents');

module.exports.name = 'accounts';
module.exports.aliases = ['switch'];

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} profileData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, profileData) => {

	const inactiveUserProfiles = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await otherProfileModel.find({
		userId: message.author.id,
		serverId: message.guild.id,
	}));

	if (inactiveUserProfiles.length === 0 && await hasNotCompletedAccount(message, /** @type {import('../../typedef').ProfileSchema} */ (profileData))) {

		return;
	}

	let accountsPage = 0;

	if (profileData !== null) {

		if (await hasCooldown(message, profileData, [module.exports.name])) {

			return;
		}

		if (profileData.isResting === true) {

			profileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { isResting: false } },
			));

			stopResting(message.author.id, message.guild.id);
		}

		profileData = await startCooldown(message, profileData);
	}

	let botReply = await message
		.reply({
			content: `Please choose an account that you want to switch to. You are currently on \`${profileData?.name || 'Empty Slot'}\`.`,
			components: [new MessageActionRow({ components: [getAccountsPage(profileData, inactiveUserProfiles, accountsPage)] })],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	createCommandCollector(message.author.id, message.guild.id, botReply);

	interactionCollector();

	async function interactionCollector() {

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.isSelectMenu() && i.customId === 'accounts-options' && i.user.id === message.author.id;

		/** @type {import('discord.js').MessageComponentInteraction | null} } */
		const interaction = await botReply
			.awaitMessageComponent({ filter, time: 120_000 })
			.catch(() => { return null; });

		await botReply
			.edit({
				components: disableAllComponents(botReply.components),
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		if (interaction === null) {

			return;
		}

		if (interaction.isSelectMenu() && interaction.values[0] === 'accounts_page') {

			accountsPage++;
			if (accountsPage >= Math.ceil(((profileData === null ? 1 : 2) + inactiveUserProfiles.length) / 24)) {

				accountsPage = 0;
			}

			botReply = await botReply
				.edit({
					components: [new MessageActionRow({ components: [getAccountsPage(profileData, inactiveUserProfiles, accountsPage)] })],
				})
				.catch((error) => { throw new Error(error); });

			await interactionCollector();
			return;
		}

		if (interaction.isSelectMenu() && interaction.values[0].includes('switchto')) {

			if (profileData?.uuid !== undefined) {

				renameSync(`./database/profiles/${profileData.uuid}.json`, `./database/profiles/inactiveProfiles/${profileData.uuid}.json`);
			}

			const name = interaction.values[0].split('-').slice(1, -1).join('-');

			/** @type {import('../../typedef').ProfileSchema} */
			const newProfileData = /** @type {import('../../typedef').ProfileSchema} */ (await otherProfileModel.findOne({
				userId: message.author.id,
				serverId: message.guild.id,
				name: interaction.values[0].endsWith('-0') ? name : null,
			}));

			if (interaction.values[0].endsWith('-0')) {

				renameSync(`./database/profiles/inactiveProfiles/${newProfileData.uuid}.json`, `./database/profiles/${newProfileData.uuid}.json`);

				try {

					for (const role of newProfileData.roles) {

						if (message.member.roles.cache.has(role.roleId) === false) {

							message.member.roles.add(role.roleId);
						}
					}
				}
				catch (error) {

					await checkRoleCatchBlock(error, message, message.member);
				}
			}

			try {

				for (const role of profileData?.roles || []) {

					const isInNewRoles = newProfileData !== null && newProfileData.roles.some(r => r.roleId === role.roleId && r.wayOfEarning === role.wayOfEarning && r.requirement === role.requirement);
					if (isInNewRoles === false && message.member.roles.cache.has(role.roleId)) {

						message.member.roles.remove(role.roleId);
					}
				}
			}
			catch (error) {

				await checkRoleCatchBlock(error, message, message.member);
			}

			setTimeout(async () => {

				await interaction
					.followUp({
						content: `You successfully switched to \`${name}\`!`,
						ephemeral: true,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
			}, 500);
		}
	}
};

/**
 * It takes in a profile, a list of inactive profiles, and a page number, and returns a menu with the
 * profile and inactive profiles as options.
 * @param {import('../../typedef').ProfileSchema} profileData - The profile data of the user who is currently logged in.
 * @param {Array<import('../../typedef').ProfileSchema>} inactiveUserProfiles - An array of all the user's inactive profiles.
 * @param {number} accountsPage - The current page of accounts the user is on.
 * @returns {import('discord.js').MessageSelectMenu} A MessageSelectMenu object
 */
function getAccountsPage(profileData, inactiveUserProfiles, accountsPage) {

	const accountsMenu = new MessageSelectMenu({
		customId: 'accounts-options',
		placeholder: 'Select an account',
	});

	if (profileData !== null) { accountsMenu.addOptions({ label: profileData.name, value: `switchto-${profileData.name}-0` }); }

	for (const profile of inactiveUserProfiles) {

		accountsMenu.addOptions({ label: profile.name, value: `switchto-${profile.name}-0` });
	}

	accountsMenu.addOptions({ label: 'Empty Slot', value: 'switchto-Empty Slot-1' });

	if (accountsMenu.options.length > 25) {

		accountsMenu.options = accountsMenu.options.splice(accountsPage * 24, (accountsPage + 1) * 24);
		accountsMenu.addOptions({ label: 'Show more accounts', value: 'accounts_page', description: `You are currently on page ${accountsPage + 1}`, emoji: '📋' });
	}

	return accountsMenu;
}

