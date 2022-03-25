const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid } = require('../../utils/checkValidity');
const { generateRandomNumber } = require('../../utils/randomizers');
const startCooldown = require('../../utils/startCooldown');
const config = require('../../config.json');
const profileModel = require('../../models/profileModel');

module.exports = {
	name: 'hug',
	aliases: ['snuggle'],
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await isInvalid(message, profileData, embedArray, [module.exports.name])) {

			return;
		}

		profileData = await startCooldown(message, profileData);

		if (message.mentions.users.size > 0 && message.mentions.users.first().id === message.author.id) {

			const selfHugURLs = [
				'https://c.tenor.com/kkW-x5TKP-YAAAAC/seal-hug.gif',
				'https://c.tenor.com/a2ZPJZC3E50AAAAC/duck-sleeping.gif',
				'https://c.tenor.com/uPyoU80DaMsAAAAd/yawn-pampered-pandas.gif',
				'https://c.tenor.com/P5lPftY1nzUAAAAd/tired-exhausted.gif'];

			const embed = {
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				image: { url: selfHugURLs[generateRandomNumber(selfHugURLs.length, 0)] },
			};

			return await message
				.reply({
					embeds: [...embedArray, embed],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if (message.mentions.users.size <= 0) {

			const embed = {
				color: config.error_color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				title: 'Please mention a user that you want to hug!',
			};

			return await message
				.reply({
					embeds: [...embedArray, embed],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		const partnerProfileData = await profileModel.findOne({
			userId: message.mentions.users.first().id,
			serverId: message.guild.id,
		});

		if (!partnerProfileData || partnerProfileData.name === '' || partnerProfileData.species === '') {

			const embed = {
				color: config.error_color,
				author: { name: message.guild.name, icon_url: message.guild.iconURL() },
				title: 'The mentioned user has no account :(',
			};

			return await message
				.reply({
					embeds: [...embedArray, embed],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus != 404) {
						throw new Error(error);
					}
				});
		}

		const botReply = await message
			.reply({
				embeds: [...embedArray, {
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `${message.mentions.users.first().toString()}, do you accept the hug?`,
				}],
				components: [{
					type: 'ACTION_ROW',
					components: [{
						type: 'BUTTON',
						customId: 'hug-accept',
						label: 'Accept',
						emoji: { name: '🫂' },
						style: 'SUCCESS',
					}, {
						type: 'BUTTON',
						customId: 'hug-decline',
						label: 'Decline',
						style: 'DANGER',
					}],
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		const filter = i => i.user.id == message.mentions.users.first().id;

		botReply
			.awaitMessageComponent({ filter, time: 120000 })
			.then(async interaction => {

				if (interaction.customId === 'hug-decline') {

					return Promise.reject();
				}

				const hugURLs = [
					'https://c.tenor.com/h94rl66G50cAAAAC/hug-cats.gif',
					'https://c.tenor.com/-YZ5lgNG7ecAAAAd/yes-love.gif',
					'https://c.tenor.com/K-mORy7U1SsAAAAd/wolf-animal.gif',
					'https://c.tenor.com/x2Ne9xx0SBgAAAAC/funny-animals-monkey-hug.gif',
					'https://c.tenor.com/a8H63f_WrqEAAAAC/border-collie-hug.gif',
					'https://c.tenor.com/jQud2Zph9OoAAAAC/animal-animals.gif',
					'https://c.tenor.com/tyK64-bjkikAAAAC/sweet-animals-cute.gif',
					'https://c.tenor.com/K2uYNMCeqe4AAAAC/bear-hug.gif',
					'https://c.tenor.com/j9ovpes78QsAAAAd/huge-hug-bromance.gif',
					'https://c.tenor.com/EKlPRdcuoccAAAAC/otter-cute.gif',
					'https://c.tenor.com/N-MAzVmbytEAAAAd/cat-dog.gif',
					'https://c.tenor.com/WvsUTL2ocVkAAAAd/cute-cats-cuddling-cats.gif',
					'https://c.tenor.com/8SjdZ9f64s8AAAAd/animals-kiss.gif',
					'https://c.tenor.com/VOLRmvc9PawAAAAd/cute-animals.gif',
					'https://c.tenor.com/N4wxlSS6s6YAAAAd/wake-up-360baby-pandas.gif',
				];

				return botReply
					.edit({
						embeds: [...embedArray, {
							color: profileData.color,
							author: { name: profileData.name, icon_url: profileData.avatarURL },
							image: { url: hugURLs[generateRandomNumber(hugURLs.length, 0)] },
						}],
						components: [],
						failIfNotExists: false,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			})
			.catch(async () => {
				return await botReply
					.edit({
						embeds: [...embedArray, {
							color: profileData.color,
							author: { name: profileData.name, icon_url: profileData.avatarURL },
							description:`${message.mentions.users.first().toString()} did not accept the hug.`,
						}],
						components: [],
						failIfNotExists: false,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			});

		return;
	},
};