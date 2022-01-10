const config = require('../../config.json');
const profileModel = require('../../models/profileSchema');
const arrays = require('../../utils/arrays');

module.exports = {
	name: 'name',
	async sendMessage(client, message, argumentsArray, profileData) {

		const species = arrays.species(profileData);

		try {

			profileData = await profileModel
				.findOne({
					userId: message.author.id,
					serverId: message.guild.id,
				})
				.catch((error) => {
					throw new Error(error);
				});

			const profileInventoryArray = [[], [], [], []];
			if (!profileData) {

				for (let i = 0; i < arrays.commonPlantNamesArray.length; i++) {

					profileInventoryArray[0].push(0);
				}

				for (let i = 0; i < arrays.uncommonPlantNamesArray.length; i++) {
					profileInventoryArray[1].push(0);
				}

				for (let i = 0; i < arrays.rarePlantNamesArray.length; i++) {
					profileInventoryArray[2].push(0);
				}

				for (let i = 0; i < species.nameArray.length; i++) {
					profileInventoryArray[3].push(0);
				}

				const profile = await profileModel
					.create({
						userId: message.author.id,
						serverId: message.guild.id,
						name: '',
						description: '',
						color: config.default_color,
						species: '',
						rank: 'Youngling',
						avatarURL: message.author.avatarURL(),
						levels: 1,
						experience: 0,
						health: 100,
						energy: 100,
						hunger: 100,
						thirst: 100,
						maxHealth: 100,
						maxEnergy: 100,
						maxHunger: 100,
						maxThirst: 100,
						isResting: false,
						hasCooldown: false,
						hasQuest: false,
						currentRegion: 'sleeping dens',
						unlockedRanks: 0,
						pronounArray: ['they', 'them', 'their', 'theirs', 'themselves', 'plural'],
						injuryArray: [0, 0, 0, 0, 0],
						inventoryArray: profileInventoryArray,
					})
					.catch((error) => {
						throw new Error(error);
					});

				profile
					.save()
					.catch((error) => {
						throw new Error(error);
					});
			}
		}
		catch (err) {

			console.log(err);

			return await message
				.reply({
					embeds: [{
						color: config.error_color,
						title: 'En error occured trying to change your name.',
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
		}

		const name = argumentsArray.join(' ').charAt(0).toUpperCase() + argumentsArray.join(' ').slice(1);

		if (!name.length) {

			return await message
				.reply({
					embeds: [{
						color: config.default_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: 'Use this command to name or rename your character. Here is how to use it:',
						description: '\n\nrp name [name]\nReplace [name] with the desired name.',
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
		}

		if (name.length > 25) {

			return await message
				.reply({
					embeds: [{
						color: config.error_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: 'Names can only be up to 25 characters long.',
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
		}

		console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): name changed from \x1b[33m${profileData.name} \x1b[0mto \x1b[33m${name} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
		await profileModel
			.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { name: name } },
				{ new: true },
			)
			.catch((error) => {
				throw new Error(error);
			});

		await message
			.reply({
				embeds: [{
					color: config.default_color,
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					description: `*A stranger carefully steps over the pack's borders. Their face seems friendly. Curious eyes watch them as they come close to the Alpha.* "Welcome," *the Alpha says.* "What is your name?" \n**"${name},"** *the creature responds.*`,
					footer: { text: 'To continue setting up your profile, type "rp species"' },
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
	},
};
