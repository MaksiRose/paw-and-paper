const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const startCooldown = require('../../utils/startCooldown');
const otherProfileModel = require('../../models/otherProfileModel');
const fs = require('fs');
const { createCommandCollector } = require('../../utils/commandCollector');
const { checkRoleCatchBlock } = require('../../utils/checkRoleRequirements');

module.exports = {
	name: 'accounts',
	aliases: ['switch'],
	async sendMessage(client, message, argumentsArray, profileData) {

		const inactiveUserProfiles = await otherProfileModel.find({
			userId: message.author.id,
			serverId: message.guild.id,
		});

		if (inactiveUserProfiles.length === 0 && await hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (profileData !== null) {

			profileData = await startCooldown(message, profileData);
		}
		else {

			profileData = { name: 'Empty Slot', id: '1' };
		}

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
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		createCommandCollector(message.author.id, message.guild.id, botReply);
		const filter = i => i.customId.includes('switchto') && i.user.id === message.author.id;

		const interaction = await botReply
			.awaitMessageComponent({ filter, time: 120000 })
			.catch(async () => { return null; });

		await botReply
			.edit({
				components: [],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		if (interaction === null) {

			return;
		}

		if (profileData.uuid !== undefined) {

			fs.renameSync(`./database/profiles/${profileData.uuid}.json`, `./database/profiles/inactiveProfiles/${profileData.uuid}.json`);

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

			const newProfileData = await otherProfileModel.findOne({
				userId: message.author.id,
				serverId: message.guild.id,
				name: name,
			});

			fs.renameSync(`./database/profiles/inactiveProfiles/${newProfileData.uuid}.json`, `./database/profiles/${newProfileData.uuid}.json`);
		}

		setTimeout(async () => {

			await interaction
				.followUp({
					content: `You successfully switched to \`${name}\`!`,
					ephemeral: true,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}, 500);
	},
};