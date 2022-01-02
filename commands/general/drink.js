const config = require('../../config.json');
const profileModel = require('../../models/profileSchema');
const checkAccountCompletion = require('../../utils/checkAccountCompletion');
const checkValidity = require('../../utils/checkValidity');

module.exports = {
	name: 'drink',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await checkAccountCompletion.hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await checkValidity.isInvalid(message, profileData, embedArray)) {

			return;
		}

		if (profileData.thirst >= profileData.maxThirst) {

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*Water sounds churned in ${profileData.name}'s ear, ${profileData.pronounArray[2]} mouth longing for just one more drink. It seems like ${profileData.pronounArray[0]} can never be as hydrated as ${profileData.pronounArray[0]} want${(profileData.pronounArray[5] == 'singular') ? '' : 's'}, but ${profileData.pronounArray[0]} ${(profileData.pronounArray[5] == 'singular') ? 's' : ''} ${profileData.pronounArray[0]} had plenty of water today.*`,
			});

			return await message
				.reply({
					embeds: embedArray,
				})
				.catch((error) => {
					if (error.httpStatus == 404) {
						console.log('Message already deleted');
					}
					else {
						throw new Error(error);
					}
				});
		}

		profileData = await profileModel
			.findOneAndUpdate(
				{
					userId: message.author.id,
					serverId: message.guild.id,
				},
				{
					$set: {
						currentRegion: 'lake',
						hasCooldown: true,
					},
				},
				{ upsert: true, new: true },
			)
			.catch((error) => {
				throw new Error(error);
			});


		embedArray.push({
			color: config.default_color,
			author: { name: message.guild.name, icon_url: message.guild.iconURL() },
			description: 'For the next 15 seconds, click the button as many times as you can!',
		});

		const botReply = await message
			.reply({
				embeds: embedArray,
				components: [{
					type: 'ACTION_ROW',
					components: [{
						type: 'BUTTON',
						customId: 'water',
						emoji: { name: '💧' },
						style: 'PRIMARY',
					}],
				}],
			})
			.catch((error) => {
				if (error.httpStatus == 404) {
					console.log('Message already deleted');
				}
				else {
					throw new Error(error);
				}
			});

		return await new Promise((resolve) => {

			const filter = i => i.customId === 'water' && i.user.id === message.author.id;

			const collector = message.channel.createMessageComponentCollector({ filter, time: 15000 });
			collector.on('end', async collected => {

				let thirstPoints = Loottable(3, collected.size);

				if (profileData.thirst + thirstPoints > profileData.maxThirst) {

					thirstPoints -= (profileData.thirst + thirstPoints) - profileData.maxThirst;
				}

				profileData = await profileModel
					.findOneAndUpdate(
						{ userId: message.author.id, serverId: message.guild.id },
						{
							$inc: { thirst: +thirstPoints },
							$set: { hasCooldown: true },
						},
						{ upsert: true, new: true },
					)
					.catch((error) => {
						throw new Error(error);
					});

				embedArray.splice(-1, 1, {
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*${profileData.name} scurries over to the river and takes hasty gulps. The fresh water runs down ${profileData.pronounArray[2]} throat and fills ${profileData.pronounArray[2]} body with new energy.*`,
					footer: { text: `+${thirstPoints} thirst (${profileData.thirst}/${profileData.maxThirst})` },
				});

				await botReply
					.edit({ embeds: embedArray, components: [] })
					.catch((error) => {
						if (error.httpStatus == 404) {
							console.log('Message already deleted');
						}
						else {
							throw new Error(error);
						}
					});

				return resolve();
			});
		});

		function Loottable(max, min) { return Math.floor(Math.random() * max + min); }
	},
};