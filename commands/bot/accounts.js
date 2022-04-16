// @ts-check
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const startCooldown = require('../../utils/startCooldown');
const { profileModel, otherProfileModel } = require('../../models/profileModel');
const { renameSync } = require('fs');
const { createCommandCollector } = require('../../utils/commandCollector');
const { checkRoleCatchBlock } = require('../../utils/checkRoleRequirements');
const { hasCooldown } = require('../../utils/checkValidity');
const { stopResting } = require('../../utils/executeResting');

module.exports.name = 'accounts';
module.exports.aliases = ['switch'];

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {Partial<import('../../typedef').ProfileSchema & {id?: string}>} profileData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, profileData) => {

	/** @type {Array<Partial<import('../../typedef').ProfileSchema & {id?: string}>>} */
	const inactiveUserProfiles = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await otherProfileModel.find({
		userId: message.author.id,
		serverId: message.guild.id,
	}));

	if (inactiveUserProfiles.length === 0 && await hasNotCompletedAccount(message, /** @type {import('../../typedef').ProfileSchema} */ (profileData))) {

		return;
	}

	if (profileData !== null) {

		if (await hasCooldown(message, /** @type {import('../../typedef').ProfileSchema} */ (profileData), [module.exports.name])) {

			return;
		}

		if (profileData.isResting === true) {

			profileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { isResting: false } },
			));

			stopResting(message.author.id, message.guild.id);
		}

		profileData = await startCooldown(message, /** @type {import('../../typedef').ProfileSchema} */ (profileData));
	}
	else {

		profileData = { name: 'Empty Slot', id: '1' };
	}

	/** @type {Array<Required<import('discord.js').BaseMessageComponentOptions> & import('discord.js').MessageActionRowOptions>} */
	const components = [{
		type: 'ACTION_ROW',
		components: [{
			type: 'BUTTON',
			customId: `switchto-${profileData.name}-${profileData.id || '0'}`,
			label: profileData.name,
			disabled: true,
			style: 'SECONDARY',
		}],
	}];

	inactiveUserProfiles.push({ name: 'Empty Slot', id: '2' });
	inactiveUserProfiles.push({ name: 'Empty Slot', id: '3' });
	inactiveUserProfiles.length = 2;

	for (const profile of inactiveUserProfiles) {

		components[0].components.push({
			type: 'BUTTON',
			customId: `switchto-${profile.name}-${profile.id || '0'}`,
			label: profile.name,
			style: 'SECONDARY',
		});
	}

	const botReply = await message
		.reply({
			content: 'Please choose an account that you want to switch to.',
			components: components,
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	createCommandCollector(message.author.id, message.guild.id, botReply);
	const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.customId.includes('switchto') && i.user.id === message.author.id;

	/** @type {import('discord.js').MessageComponentInteraction | undefined} } */
	const interaction = await botReply
		.awaitMessageComponent({ filter, time: 12000 })
		.catch(() => { return undefined; });

	await botReply
		.edit({
			components: [],
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});

	if (interaction === undefined) {

		return;
	}

	if (profileData.uuid !== undefined) {

		renameSync(`./database/profiles/${profileData.uuid}.json`, `./database/profiles/inactiveProfiles/${profileData.uuid}.json`);

		for (const role of profileData.roles) {

			if (message.member.roles.cache.has(role.roleId) === true) {

				try {

					await message.member.roles.remove(role.roleId);
				}
				catch (error) {

					await checkRoleCatchBlock(error, message, message.member);
				}
			}
		}
	}

	const name = interaction.customId.split('-').slice(1, -1).join('-');

	if (interaction.customId.endsWith('-0')) {

		/** @type {import('../../typedef').ProfileSchema} */
		const newProfileData = /** @type {import('../../typedef').ProfileSchema} */ (await otherProfileModel.findOne({
			userId: message.author.id,
			serverId: message.guild.id,
			name: name,
		}));

		renameSync(`./database/profiles/inactiveProfiles/${newProfileData.uuid}.json`, `./database/profiles/${newProfileData.uuid}.json`);

		for (const role of newProfileData.roles) {

			if (message.member.roles.cache.has(role.roleId) === false) {

				try {

					await message.member.roles.add(role.roleId);
				}
				catch (error) {

					await checkRoleCatchBlock(error, message, message.member);
				}
			}
		}
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
};